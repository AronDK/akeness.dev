import { createHash, generateKeyPairSync, sign } from "node:crypto"
import { SendEmailCommand } from "@aws-sdk/client-sesv2"
import { describe, expect, it, vi } from "vitest"
import {
  handleContactRequest,
  type ContactApiEvent,
  type ContactHandlerDependencies,
} from "../lambda/handler"

const { privateKey, publicKey } = generateKeyPairSync("ed25519")
const proxyPublicKey = publicKey
  .export({ format: "der", type: "spki" })
  .toString("base64")
const clientIp = "203.0.113.8"

const dependencies = (): ContactHandlerDependencies => ({
  emailClient: {
    send: vi.fn().mockResolvedValue({ MessageId: "test-message" }),
  },
  getConfig: () => ({
    recipientEmail: "recipient@example.com",
    fromEmail: "sender@example.com",
    allowedOrigins: ["https://portfolio.example.com"],
    proxyPublicKey,
  }),
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
})

const validEvent = {
  httpMethod: "POST",
  headers: {
    "content-type": "application/json",
    origin: "https://portfolio.example.com",
  },
  body: JSON.stringify({
    name: "Visitor",
    email: "visitor@example.com",
    message: "Please get in touch.",
  }),
  requestContext: { requestId: "request-123" },
}

function attestedEvent(event: ContactApiEvent): ContactApiEvent {
  const body = event.body ?? ""
  const expiresAt = Math.floor(Date.now() / 1_000) + 60
  const bodyHash = createHash("sha256").update(body, "utf8").digest("base64url")
  const signingInput = ["v1", String(expiresAt), bodyHash, clientIp].join(".")
  const signature = sign(null, Buffer.from(signingInput), privateKey).toString(
    "base64url",
  )

  return {
    ...event,
    headers: {
      ...event.headers,
      "x-contact-proxy-attestation": [
        "v1",
        String(expiresAt),
        bodyHash,
        signature,
      ].join("."),
      "x-forwarded-for": clientIp,
    },
  }
}

describe("handleContactRequest", () => {
  it("sends a plain-text SES message and returns generic success", async () => {
    const testDependencies = dependencies()

    const response = await handleContactRequest(
      attestedEvent(validEvent),
      testDependencies,
    )

    expect(response.statusCode).toBe(202)
    expect(JSON.parse(response.body)).toEqual({
      message: "Your message has been sent.",
    })
    expect(response.headers["Access-Control-Allow-Origin"]).toBe(
      "https://portfolio.example.com",
    )
    expect(testDependencies.emailClient.send).toHaveBeenCalledTimes(1)

    const command = vi.mocked(testDependencies.emailClient.send).mock.calls[0][0]
    expect(command).toBeInstanceOf(SendEmailCommand)
    expect(command.input).toMatchObject({
      FromEmailAddress: "sender@example.com",
      Destination: { ToAddresses: ["recipient@example.com"] },
      Content: {
        Simple: {
          Subject: { Data: "New website contact message" },
        },
      },
    })
    expect(command.input.ReplyToAddresses).toBeUndefined()
  })

  it("returns a generic failure without throwing when SES rejects the send", async () => {
    const testDependencies = dependencies()
    vi.mocked(testDependencies.emailClient.send).mockRejectedValueOnce(
      new Error("SES unavailable"),
    )

    const response = await handleContactRequest(
      attestedEvent(validEvent),
      testDependencies,
    )

    expect(response.statusCode).toBe(500)
    expect(JSON.parse(response.body)).toEqual({
      error: "Unable to send your message.",
    })
    expect(testDependencies.logger.error).toHaveBeenCalledWith(
      "email_send_failed",
      { requestId: "request-123", errorCode: "unknown" },
    )
  })

  it("logs only a safe validation reason for invalid requests", async () => {
    const testDependencies = dependencies()

    const response = await handleContactRequest(
      attestedEvent({
        ...validEvent,
        body: JSON.stringify({
          name: "Visitor",
          email: "visitor@invalid",
          message: "Please get in touch.",
        }),
      }),
      testDependencies,
    )

    expect(response.statusCode).toBe(400)
    expect(testDependencies.logger.info).toHaveBeenCalledWith(
      "request_rejected",
      { requestId: "request-123", reason: "invalid_email" },
    )
    expect(testDependencies.emailClient.send).not.toHaveBeenCalled()
  })

  it("rejects requests that do not come through the signed proxy", async () => {
    const testDependencies = dependencies()

    const response = await handleContactRequest(validEvent, testDependencies)

    expect(response.statusCode).toBe(403)
    expect(JSON.parse(response.body)).toEqual({ error: "Request not allowed." })
    expect(testDependencies.logger.info).toHaveBeenCalledWith(
      "proxy_attestation_rejected",
      { requestId: "request-123" },
    )
    expect(testDependencies.emailClient.send).not.toHaveBeenCalled()
  })
})
