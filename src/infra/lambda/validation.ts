export interface ContactMessage {
  name: string
  email: string
  message: string
}

export type ContactValidationReason =
  | "base64_body"
  | "invalid_email"
  | "invalid_json"
  | "invalid_message"
  | "invalid_name"
  | "invalid_object"
  | "missing_body"
  | "unexpected_fields"
  | "unsupported_content_type"

export const CONTACT_LIMITS = {
  name: 120,
  email: 254,
  message: 5_000,
} as const

const EMAIL_PATTERN =
  /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i

export class ContactValidationError extends Error {
  constructor(readonly reason: ContactValidationReason) {
    super("Invalid contact request")
    this.name = "ContactValidationError"
  }
}

export function findHeader(
  headers: Record<string, string | undefined> | null | undefined,
  headerName: string,
): string | undefined {
  if (!headers) return undefined

  const requestedHeader = headerName.toLowerCase()
  const entry = Object.entries(headers).find(
    ([name]) => name.toLowerCase() === requestedHeader,
  )

  return entry?.[1]
}

export function isValidEmailAddress(value: string): boolean {
  return (
    value.length <= CONTACT_LIMITS.email &&
    !/[\r\n\u0000]/u.test(value) &&
    EMAIL_PATTERN.test(value)
  )
}

function invalidRequest(reason: ContactValidationReason): never {
  throw new ContactValidationError(reason)
}

function parseJsonObject(body: string): Record<string, unknown> {
  let parsed: unknown

  try {
    parsed = JSON.parse(body)
  } catch {
    return invalidRequest("invalid_json")
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed) ||
    Object.getPrototypeOf(parsed) !== Object.prototype
  ) {
    return invalidRequest("invalid_object")
  }

  return parsed as Record<string, unknown>
}

function normalizedString(
  value: unknown,
  maxLength: number,
  reason: ContactValidationReason,
  allowLineBreaks = false,
): string {
  if (typeof value !== "string") invalidRequest(reason)

  const trimmed = value.trim()

  if (
    trimmed.length === 0 ||
    trimmed.length > maxLength ||
    /\u0000/u.test(trimmed) ||
    (!allowLineBreaks && /[\r\n]/u.test(trimmed))
  ) {
    invalidRequest(reason)
  }

  return trimmed
}

export function parseContactRequest(
  body: string | null,
  contentType: string | undefined,
  isBase64Encoded = false,
): ContactMessage {
  const mediaType = contentType?.split(";", 1)[0]?.trim().toLowerCase()

  if (mediaType !== "application/json") invalidRequest("unsupported_content_type")
  if (!body) invalidRequest("missing_body")
  if (isBase64Encoded) invalidRequest("base64_body")

  const payload = parseJsonObject(body)
  const allowedFields = new Set(["name", "email", "message"])

  if (
    Object.keys(payload).length !== allowedFields.size ||
    Object.keys(payload).some((field) => !allowedFields.has(field))
  ) {
    return invalidRequest("unexpected_fields")
  }

  const name = normalizedString(payload.name, CONTACT_LIMITS.name, "invalid_name")
  const email = normalizedString(payload.email, CONTACT_LIMITS.email, "invalid_email")
  const message = normalizedString(
    payload.message,
    CONTACT_LIMITS.message,
    "invalid_message",
    true,
  )

  if (!isValidEmailAddress(email)) invalidRequest("invalid_email")

  return { name, email, message }
}
