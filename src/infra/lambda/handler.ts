import {
  createHash,
  createPublicKey,
  timingSafeEqual,
  verify,
} from "node:crypto"
import {
  SendEmailCommand,
  SESv2Client,
  type SendEmailCommandInput,
} from "@aws-sdk/client-sesv2"
import { getContactRuntimeConfig, type ContactRuntimeConfig } from "./config"
import {
  ContactValidationError,
  findHeader,
  parseContactRequest,
  type ContactMessage,
} from "./validation"

export interface ContactApiEvent {
  httpMethod: string
  headers: Record<string, string | undefined> | null
  body: string | null
  isBase64Encoded?: boolean
  requestContext?: {
    requestId?: string
  }
}

export interface ContactApiResponse {
  statusCode: number
  headers: Record<string, string>
  body: string
}

export interface EmailClient {
  send(command: SendEmailCommand): Promise<unknown>
}

export interface ContactLogger {
  info(event: string, fields: Record<string, string | number>): void
  error(event: string, fields: Record<string, string | number>): void
}

export interface ContactHandlerDependencies {
  emailClient: EmailClient
  getConfig: () => ContactRuntimeConfig
  logger: ContactLogger
}

const sesClient = new SESv2Client({
  region: process.env.AWS_REGION,
  maxAttempts: 1,
})

const SES_ERROR_CODES = new Set([
  "AccessDeniedException",
  "BadRequestException",
  "LimitExceededException",
  "MailFromDomainNotVerifiedException",
  "MessageRejected",
  "SendingPausedException",
  "TooManyRequestsException",
])

const ATTESTATION_MAX_FUTURE_SECONDS = 75

const structuredLogger: ContactLogger = {
  info(event, fields) {
    console.log(
      JSON.stringify({
        level: "INFO",
        service: "contact-form",
        event,
        ...fields,
      }),
    )
  },
  error(event, fields) {
    console.error(
      JSON.stringify({
        level: "ERROR",
        service: "contact-form",
        event,
        ...fields,
      }),
    )
  },
}

function requestIdFor(event: ContactApiEvent): string {
  return event.requestContext?.requestId ?? "unknown"
}

function safeSesErrorCode(error: unknown): string {
  if (!error || typeof error !== "object" || !("name" in error)) {
    return "unknown"
  }

  const errorName = error.name
  return typeof errorName === "string" && SES_ERROR_CODES.has(errorName)
    ? errorName
    : "unknown"
}

function isValidForwardedIp(value: string | undefined): value is string {
  return Boolean(
    value &&
      value.length <= 64 &&
      /^[0-9A-Fa-f:.]+$/u.test(value) &&
      !/[\r\n\u0000]/u.test(value),
  )
}

function forwardedIpFor(event: ContactApiEvent): string | undefined {
  const firstForwardedIp = findHeader(event.headers, "x-forwarded-for")
    ?.split(",", 1)[0]
    ?.trim()

  return isValidForwardedIp(firstForwardedIp) ? firstForwardedIp : undefined
}

function equalHash(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  )
}

export function hasValidProxyAttestation(
  event: ContactApiEvent,
  configuration: ContactRuntimeConfig,
  now = Math.floor(Date.now() / 1_000),
): boolean {
  const attestation = findHeader(
    event.headers,
    "x-contact-proxy-attestation",
  )
  const clientIp = forwardedIpFor(event)
  const body = event.body

  if (!attestation || !clientIp || body === null || event.isBase64Encoded) {
    return false
  }

  const parts = attestation.split(".")
  if (parts.length !== 4) return false

  const [version, expiresAtText, signedBodyHash, signature] = parts
  if (
    version !== "v1" ||
    !/^[1-9][0-9]{9,10}$/u.test(expiresAtText) ||
    !/^[A-Za-z0-9_-]{43}$/u.test(signedBodyHash) ||
    !/^[A-Za-z0-9_-]{86}$/u.test(signature)
  ) {
    return false
  }

  const expiresAt = Number(expiresAtText)
  if (
    !Number.isSafeInteger(expiresAt) ||
    String(expiresAt) !== expiresAtText ||
    expiresAt < now ||
    expiresAt > now + ATTESTATION_MAX_FUTURE_SECONDS
  ) {
    return false
  }

  const actualBodyHash = createHash("sha256")
    .update(body, "utf8")
    .digest("base64url")

  if (!equalHash(signedBodyHash, actualBodyHash)) {
    return false
  }

  const signingInput = ["v1", expiresAtText, actualBodyHash, clientIp].join(".")

  try {
    const publicKey = createPublicKey({
      key: Buffer.from(configuration.proxyPublicKey, "base64"),
      format: "der",
      type: "spki",
    })

    return verify(
      null,
      Buffer.from(signingInput, "utf8"),
      publicKey,
      Buffer.from(signature, "base64url"),
    )
  } catch {
    return false
  }
}

function corsHeaders(
  origin: string | undefined,
  configuration: ContactRuntimeConfig,
): Record<string, string> {
  if (!origin || !configuration.allowedOrigins.includes(origin)) {
    return {}
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  }
}

function jsonResponse(
  statusCode: number,
  body: Record<string, string>,
  cors: Record<string, string>,
): ContactApiResponse {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...cors,
    },
    body: JSON.stringify(body),
  }
}

function preflightResponse(cors: Record<string, string>): ContactApiResponse {
  return {
    statusCode: 204,
    headers: {
      "Cache-Control": "no-store",
      Vary: "Origin",
      ...cors,
    },
    body: "",
  }
}

function emailCommand(
  contact: ContactMessage,
  configuration: ContactRuntimeConfig,
): SendEmailCommandInput {
  return {
    FromEmailAddress: configuration.fromEmail,
    Destination: {
      ToAddresses: [configuration.recipientEmail],
    },
    Content: {
      Simple: {
        Subject: {
          Charset: "UTF-8",
          Data: "New website contact message",
        },
        Body: {
          Text: {
            Charset: "UTF-8",
            Data: [
              "A visitor submitted the website contact form.",
              "",
              `Name: ${contact.name}`,
              `Email: ${contact.email}`,
              "",
              "Message:",
              contact.message,
            ].join("\n"),
          },
        },
      },
    },
  }
}

export async function handleContactRequest(
  event: ContactApiEvent,
  dependencies: ContactHandlerDependencies,
): Promise<ContactApiResponse> {
  const requestId = requestIdFor(event)
  let configuration: ContactRuntimeConfig

  try {
    configuration = dependencies.getConfig()
  } catch {
    dependencies.logger.error("configuration_invalid", { requestId })
    return jsonResponse(500, { error: "Unable to send your message." }, {})
  }

  const origin = findHeader(event.headers, "origin")
  const cors = corsHeaders(origin, configuration)

  if (origin && Object.keys(cors).length === 0) {
    dependencies.logger.info("origin_rejected", { requestId })
    return jsonResponse(403, { error: "Request not allowed." }, {})
  }

  if (event.httpMethod === "OPTIONS") {
    dependencies.logger.info("preflight_allowed", { requestId })
    return preflightResponse(cors)
  }

  if (event.httpMethod !== "POST") {
    dependencies.logger.info("method_rejected", { requestId })
    return jsonResponse(405, { error: "Method not allowed." }, cors)
  }

  if (!hasValidProxyAttestation(event, configuration)) {
    dependencies.logger.info("proxy_attestation_rejected", { requestId })
    return jsonResponse(403, { error: "Request not allowed." }, cors)
  }

  let contact: ContactMessage

  try {
    contact = parseContactRequest(
      event.body,
      findHeader(event.headers, "content-type"),
      event.isBase64Encoded,
    )
  } catch (error) {
    if (error instanceof ContactValidationError) {
      dependencies.logger.info("request_rejected", {
        requestId,
        reason: error.reason,
      })
      return jsonResponse(400, { error: "Invalid request." }, cors)
    }

    dependencies.logger.error("request_processing_failed", { requestId })
    return jsonResponse(500, { error: "Unable to send your message." }, cors)
  }

  try {
    await dependencies.emailClient.send(
      new SendEmailCommand(emailCommand(contact, configuration)),
    )
  } catch (error) {
    dependencies.logger.error("email_send_failed", {
      requestId,
      errorCode: safeSesErrorCode(error),
    })
    return jsonResponse(500, { error: "Unable to send your message." }, cors)
  }

  dependencies.logger.info("email_accepted", { requestId, statusCode: 202 })
  return jsonResponse(202, { message: "Your message has been sent." }, cors)
}

export const handler = (event: ContactApiEvent) =>
  handleContactRequest(event, {
    emailClient: sesClient,
    getConfig: getContactRuntimeConfig,
    logger: structuredLogger,
  })
