import { describe, expect, it } from "vitest"
import {
  CONTACT_LIMITS,
  ContactValidationError,
  parseContactRequest,
} from "../lambda/validation"

const contentType = "application/json; charset=utf-8"

describe("parseContactRequest", () => {
  it("accepts exactly the expected fields and trims them", () => {
    const request = parseContactRequest(
      JSON.stringify({
        name: "  Visitor  ",
        email: "  visitor@example.com  ",
        message: "  Hello from the form.  ",
      }),
      contentType,
    )

    expect(request).toEqual({
      name: "Visitor",
      email: "visitor@example.com",
      message: "Hello from the form.",
    })
  })

  it.each([
    ["an unexpected field", { name: "Visitor", email: "visitor@example.com", message: "Hi", role: "admin" }],
    ["a malformed email", { name: "Visitor", email: "visitor@invalid", message: "Hi" }],
    ["a header-injection email", { name: "Visitor", email: "visitor@example.com\r\nBcc: anyone@example.com", message: "Hi" }],
    ["a too-long message", { name: "Visitor", email: "visitor@example.com", message: "a".repeat(CONTACT_LIMITS.message + 1) }],
  ])("rejects %s", (_reason, body) => {
    expect(() => parseContactRequest(JSON.stringify(body), contentType)).toThrow(
      ContactValidationError,
    )
  })

  it("rejects non-JSON content and base64 payloads", () => {
    expect(() => parseContactRequest("name=Visitor", "text/plain")).toThrow(
      ContactValidationError,
    )
    expect(() =>
      parseContactRequest(
        JSON.stringify({
          name: "Visitor",
          email: "visitor@example.com",
          message: "Hi",
        }),
        contentType,
        true,
      ),
    ).toThrow(ContactValidationError)
  })
})
