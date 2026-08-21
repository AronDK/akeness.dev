import { isValidEmailAddress } from "./validation"

export interface ContactRuntimeConfig {
  recipientEmail: string
  fromEmail: string
  allowedOrigins: string[]
  proxyPublicKey: string
}

function requiredValue(
  environment: NodeJS.ProcessEnv,
  variableName: string,
): string {
  const value = environment[variableName]?.trim()

  if (!value) {
    throw new Error(`${variableName} must be configured`)
  }

  return value
}

function normalizeOrigin(value: string): string {
  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw new Error("ALLOWED_ORIGINS contains an invalid origin")
  }

  const isLoopbackHost =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]"

  if (
    url.origin === "null" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" && isLoopbackHost))
  ) {
    throw new Error("ALLOWED_ORIGINS must contain explicit HTTPS origins")
  }

  return url.origin
}

export function parseAllowedOrigins(value: string): string[] {
  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map(normalizeOrigin)

  if (origins.length === 0 || new Set(origins).size !== origins.length) {
    throw new Error("ALLOWED_ORIGINS must contain one or more unique origins")
  }

  return origins
}

export function isValidProxyPublicKey(value: string): boolean {
  if (!/^[A-Za-z0-9+/]+={0,2}$/u.test(value)) return false

  try {
    return Buffer.from(value, "base64").length === 44
  } catch {
    return false
  }
}

export function getContactRuntimeConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ContactRuntimeConfig {
  const recipientEmail = requiredValue(environment, "CONTACT_RECIPIENT_EMAIL")
  const fromEmail = requiredValue(environment, "SES_FROM_EMAIL")
  const proxyPublicKey = requiredValue(environment, "CONTACT_PROXY_PUBLIC_KEY")

  if (
    !isValidEmailAddress(recipientEmail) ||
    !isValidEmailAddress(fromEmail) ||
    !isValidProxyPublicKey(proxyPublicKey)
  ) {
    throw new Error("Contact email configuration is invalid")
  }

  return {
    recipientEmail,
    fromEmail,
    allowedOrigins: parseAllowedOrigins(
      requiredValue(environment, "ALLOWED_ORIGINS"),
    ),
    proxyPublicKey,
  }
}
