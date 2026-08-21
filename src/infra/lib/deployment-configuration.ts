import { isValidProxyPublicKey, parseAllowedOrigins } from "../lambda/config"
import { isValidEmailAddress } from "../lambda/validation"

export interface ContactDeploymentConfiguration {
  recipientEmail: string
  fromEmail: string
  allowedOrigins: string[]
  proxyPublicKey: string
}

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`${name} must be set in the ignored src/.env file`)
  }

  return value
}

export function loadContactDeploymentConfiguration(): ContactDeploymentConfiguration {
  const recipientEmail = requiredEnvironmentValue("CONTACT_RECIPIENT_EMAIL")
  const fromEmail = requiredEnvironmentValue("SES_FROM_EMAIL")
  const proxyPublicKey = requiredEnvironmentValue("CONTACT_PROXY_PUBLIC_KEY")

  if (
    !isValidEmailAddress(recipientEmail) ||
    !isValidEmailAddress(fromEmail) ||
    !isValidProxyPublicKey(proxyPublicKey)
  ) {
    throw new Error(
      "CONTACT_RECIPIENT_EMAIL, SES_FROM_EMAIL, and CONTACT_PROXY_PUBLIC_KEY must be valid",
    )
  }

  return {
    recipientEmail,
    fromEmail,
    allowedOrigins: parseAllowedOrigins(
      requiredEnvironmentValue("ALLOWED_ORIGINS"),
    ),
    proxyPublicKey,
  }
}
