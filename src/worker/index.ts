interface AssetsBinding {
  fetch(request: Request): Promise<Response>
}

interface Env {
  ACCESS_GATE_SECRET?: string
  ALLOWED_ORIGINS: string
  ASSETS?: AssetsBinding
  CONTACT_API_URL: string
  CONTACT_PROXY_PRIVATE_KEY: string
  TURNSTILE_EXPECTED_ACTION: string
  TURNSTILE_HOSTNAMES: string
  TURNSTILE_SECRET: string
  TURNSTILE_SITE_KEY: string
}

interface ContactRequest {
  name: string
  email: string
  message: string
}

interface AccessVerificationRequest {
  turnstileToken: string
}

interface EmbeddedAsset {
  body: string
  contentType: string
}

interface EmbeddedAssetsGlobal {
  __AKENESS_STATIC_ASSETS__?: Record<string, EmbeddedAsset>
}

const MAX_CONTACT_REQUEST_BYTES = 25_000
const MAX_GATE_REQUEST_BYTES = 4_096
const MAX_TURNSTILE_TOKEN_LENGTH = 2_048
const ATTESTATION_TTL_SECONDS = 60
const ACCESS_GATE_TTL_SECONDS = 43_200
const ACCESS_GATE_COOKIE_NAME = "__Host-akeness_access"
const encoded = new TextEncoder()
const embeddedAssetBodies = new Map<string, Uint8Array>()

function jsonResponse(
  status: number,
  body: Record<string, string>,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  })
}

function parsedOrigins(value: string): Set<string> {
  return new Set(
    value
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  )
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("Origin")

  if (!origin || !parsedOrigins(env.ALLOWED_ORIGINS).has(origin)) {
    return {}
  }

  return {
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  }
}

function allowedOrigin(request: Request, env: Env): boolean {
  const origin = request.headers.get("Origin")
  return Boolean(origin && parsedOrigins(env.ALLOWED_ORIGINS).has(origin))
}

function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("Origin")
  return origin === new URL(request.url).origin
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

function hasOnlyStringFields(
  value: unknown,
  fields: readonly string[],
): boolean {
  if (!isPlainRecord(value)) return false

  return (
    Object.keys(value).length === fields.length &&
    Object.keys(value).every((field) => fields.includes(field)) &&
    fields.every((field) => typeof value[field] === "string")
  )
}

function isContactRequest(value: unknown): value is ContactRequest {
  return hasOnlyStringFields(value, ["name", "email", "message"])
}

function isAccessVerificationRequest(
  value: unknown,
): value is AccessVerificationRequest {
  return (
    isPlainRecord(value) &&
    hasOnlyStringFields(value, ["turnstileToken"]) &&
    typeof value.turnstileToken === "string" &&
    value.turnstileToken.length > 0 &&
    value.turnstileToken.length <= MAX_TURNSTILE_TOKEN_LENGTH
  )
}

function isIpHeaderSafe(value: string | null): value is string {
  return Boolean(
    value &&
      value.length <= 64 &&
      /^[0-9A-Fa-f:.]+$/u.test(value) &&
      !/[\r\n\u0000]/u.test(value),
  )
}

function toBase64Url(data: ArrayBuffer | Uint8Array): string {
  let binary = ""
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/u, "")
}

function fromBase64Url(value: string): Uint8Array | undefined {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return undefined

  const padding = "=".repeat((4 - (value.length % 4)) % 4)

  try {
    const binary = atob(value.replace(/-/gu, "+").replace(/_/gu, "/") + padding)
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
  } catch {
    return undefined
  }
}

function toOwnedArrayBuffer(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength)
  copy.set(value)
  return copy.buffer
}

function cookieValue(
  cookieHeader: string | null,
  name: string,
): string | undefined {
  if (!cookieHeader) return undefined

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=")
    if (separator === -1) continue

    const cookieName = part.slice(0, separator).trim()
    if (cookieName === name) return part.slice(separator + 1).trim()
  }

  return undefined
}

function accessGateCookie(session: string): string {
  return [
    `${ACCESS_GATE_COOKIE_NAME}=${session}`,
    `Max-Age=${ACCESS_GATE_TTL_SECONDS}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
  ].join("; ")
}

async function accessGateKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoded.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  )
}

async function createAccessSession(env: Env): Promise<string> {
  const secret = env.ACCESS_GATE_SECRET
  if (!secret || secret.length < 32) {
    throw new Error("Access gate secret is not configured")
  }

  const nonceBytes = new Uint8Array(18)
  crypto.getRandomValues(nonceBytes)

  const expiresAt = Math.floor(Date.now() / 1_000) + ACCESS_GATE_TTL_SECONDS
  const signingInput = ["v1", String(expiresAt), toBase64Url(nonceBytes)].join(
    ".",
  )
  const signature = await crypto.subtle.sign(
    "HMAC",
    await accessGateKey(secret),
    encoded.encode(signingInput),
  )

  return `${signingInput}.${toBase64Url(signature)}`
}

async function hasValidAccessSession(
  request: Request,
  env: Env,
): Promise<boolean> {
  const secret = env.ACCESS_GATE_SECRET
  if (!secret || secret.length < 32) return false

  const session = cookieValue(
    request.headers.get("Cookie"),
    ACCESS_GATE_COOKIE_NAME,
  )
  if (!session) return false

  const [version, expiresAtValue, nonce, signatureValue, ...rest] =
    session.split(".")
  if (
    rest.length > 0 ||
    version !== "v1" ||
    !/^\d{10,11}$/u.test(expiresAtValue) ||
    !/^[A-Za-z0-9_-]{16,64}$/u.test(nonce) ||
    !signatureValue
  ) {
    return false
  }

  const expiresAt = Number(expiresAtValue)
  const now = Math.floor(Date.now() / 1_000)
  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= now ||
    expiresAt > now + ACCESS_GATE_TTL_SECONDS + 60
  ) {
    return false
  }

  const signature = fromBase64Url(signatureValue)
  if (!signature) return false

  try {
    return await crypto.subtle.verify(
      "HMAC",
      await accessGateKey(secret),
      toOwnedArrayBuffer(signature),
      encoded.encode([version, expiresAtValue, nonce].join(".")),
    )
  } catch {
    console.error(
      JSON.stringify({ event: "access_session_verification_failed" }),
    )
    return false
  }
}

function embeddedAssets(): Record<string, EmbeddedAsset> {
  return (
    (globalThis as typeof globalThis & EmbeddedAssetsGlobal)
      .__AKENESS_STATIC_ASSETS__ ?? {}
  )
}

function decodedAssetBody(pathname: string, asset: EmbeddedAsset): Uint8Array {
  const cached = embeddedAssetBodies.get(pathname)
  if (cached) return cached.slice()

  const binary = atob(asset.body)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  embeddedAssetBodies.set(pathname, bytes)
  return bytes.slice()
}

function embeddedAssetResponse(request: Request): Response | undefined {
  if (request.method !== "GET" && request.method !== "HEAD") return undefined

  const assets = embeddedAssets()
  const pathname = new URL(request.url).pathname
  const requestedPath = pathname === "/resume.pdf" ? "/resume" : pathname
  const directAsset =
    assets[requestedPath === "/" ? "/index.html" : requestedPath]
  const acceptsHtml = request.headers.get("Accept")?.includes("text/html")
  const asset = directAsset ?? (acceptsHtml ? assets["/index.html"] : undefined)

  if (!asset) return undefined

  const assetPath = directAsset
    ? requestedPath === "/"
      ? "/index.html"
      : requestedPath
    : "/index.html"
  const cacheControl = assetPath.startsWith("/assets/")
    ? "public, max-age=31536000, immutable"
    : asset.contentType.startsWith("text/html")
      ? "no-store"
      : "public, max-age=300"

  return new Response(
    request.method === "HEAD"
      ? null
      : decodedAssetBody(assetPath, asset) as unknown as BodyInit,
    {
      headers: {
        "Cache-Control": cacheControl,
        "Content-Type": asset.contentType,
        "X-Content-Type-Options": "nosniff",
      },
    },
  )
}

async function bodyHash(body: string): Promise<string> {
  return toBase64Url(
    await crypto.subtle.digest("SHA-256", encoded.encode(body)),
  )
}

async function signAttestation(
  body: string,
  clientIp: string,
  privateKeyJson: string,
): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1_000) + ATTESTATION_TTL_SECONDS
  const hash = await bodyHash(body)
  const signingInput = ["v1", String(expiresAt), hash, clientIp].join(".")
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    JSON.parse(privateKeyJson) as JsonWebKey,
    { name: "Ed25519" },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign(
    "Ed25519",
    privateKey,
    encoded.encode(signingInput),
  )

  return ["v1", String(expiresAt), hash, toBase64Url(signature)].join(".")
}

function expectedHostnames(env: Env): Set<string> {
  return new Set(
    env.TURNSTILE_HOSTNAMES.split(",")
      .map((hostname) => hostname.trim().toLowerCase())
      .filter(Boolean),
  )
}

async function verifyTurnstile(
  token: string,
  clientIp: string,
  env: Env,
): Promise<boolean> {
  if (
    !env.TURNSTILE_SECRET ||
    !env.TURNSTILE_EXPECTED_ACTION ||
    expectedHostnames(env).size === 0
  ) {
    console.error(JSON.stringify({ event: "turnstile_configuration_invalid" }))
    return false
  }

  let response: Response

  try {
    response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          secret: env.TURNSTILE_SECRET,
          response: token,
          remoteip: clientIp,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    )
  } catch {
    console.error(
      JSON.stringify({ event: "turnstile_verification_unavailable" }),
    )
    return false
  }

  if (!response.ok) {
    console.error(
      JSON.stringify({
        event: "turnstile_verification_unavailable",
        status: response.status,
      }),
    )
    return false
  }

  let result: unknown

  try {
    result = await response.json()
  } catch {
    console.error(JSON.stringify({ event: "turnstile_response_invalid" }))
    return false
  }

  if (!isPlainRecord(result)) return false

  const hostname =
    typeof result.hostname === "string" ? result.hostname.toLowerCase() : ""

  return (
    result.success === true &&
    result.action === env.TURNSTILE_EXPECTED_ACTION &&
    expectedHostnames(env).has(hostname)
  )
}

async function parsedJsonBody(
  request: Request,
  maxBytes: number,
): Promise<unknown | undefined> {
  const mediaType = request.headers
    .get("Content-Type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase()

  if (mediaType !== "application/json") return undefined

  let body: string

  try {
    body = await request.text()
  } catch {
    return undefined
  }

  if (body.length === 0 || encoded.encode(body).byteLength > maxBytes) {
    return undefined
  }

  try {
    return JSON.parse(body)
  } catch {
    return undefined
  }
}

function gateContentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}' https://challenges.cloudflare.com`,
    `style-src 'nonce-${nonce}'`,
    "connect-src 'self' https://challenges.cloudflare.com",
    "frame-src https://challenges.cloudflare.com",
    "img-src 'self' data:",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; ")
}

function safeScriptValue(value: string): string {
  return JSON.stringify(value).replace(/</gu, "\\u003c")
}

function accessGateResponse(env: Env): Response {
  if (!env.TURNSTILE_SITE_KEY) {
    console.error(JSON.stringify({ event: "turnstile_site_key_missing" }))
    return new Response("Service temporarily unavailable.", {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    })
  }

  const nonceBytes = new Uint8Array(18)
  crypto.getRandomValues(nonceBytes)
  const nonce = toBase64Url(nonceBytes)
  const siteKey = safeScriptValue(env.TURNSTILE_SITE_KEY)

  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Human verification</title>
    <style nonce="${nonce}">
      :root { color-scheme: dark; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      * { box-sizing: border-box; }
      body { min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 24px; background: #0f1417; color: #dfe3e7; }
      main { width: min(420px, 100%); padding: 28px; border: 1px solid #41484d; border-radius: 14px; background: #161b1e; box-shadow: 0 24px 80px rgba(0, 0, 0, .45); }
      p { color: #a9b0b5; font-size: .88rem; line-height: 1.6; }
      #turnstile-container { min-height: 65px; margin-top: 22px; }
      #verification-status { min-height: 1.5em; margin: 12px 0 0; color: #8fcef3; font-size: .78rem; }
      #verification-status[data-error="true"] { color: #e89b9b; }
    </style>
    <script nonce="${nonce}">
      (() => {
        const siteKey = ${siteKey};
        let widgetId;
        const setStatus = (message, isError = false) => {
          const status = document.getElementById("verification-status");
          if (!status) return;
          status.textContent = message;
          status.dataset.error = String(isError);
        };
        const reset = () => {
          if (widgetId && window.turnstile) window.turnstile.reset(widgetId);
        };
        window.onTurnstileLoad = () => {
          if (!window.turnstile) {
            setStatus("Human verification could not be loaded. Please refresh and try again.", true);
            return;
          }
          widgetId = window.turnstile.render("#turnstile-container", {
            sitekey: siteKey,
            action: "site-access",
            theme: "dark",
            "response-field": false,
            callback: async (token) => {
              setStatus("Verifying your browser...");
              try {
                const response = await fetch("/verify-access", {
                  method: "POST",
                  credentials: "same-origin",
                  headers: { "Content-Type": "application/json", "Accept": "application/json" },
                  body: JSON.stringify({ turnstileToken: token }),
                });
                if (!response.ok) throw new Error("verification rejected");
                window.location.reload();
              } catch {
                setStatus("Verification could not be completed. Please try again.", true);
                reset();
              }
            },
            "expired-callback": () => setStatus("Verification expired. Please try again.", true),
            "timeout-callback": () => setStatus("Verification timed out. Please try again.", true),
            "error-callback": () => setStatus("Human verification is unavailable. Please refresh and try again.", true),
          });
        };
      })();
    </script>
    <script nonce="${nonce}" src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&amp;render=explicit" defer></script>
  </head>
  <body>
    <main>
      <h1>Before you continue</h1>
      <p>Complete the quick human verification to access the site and keep its contact service protected.</p>
      <div id="turnstile-container" aria-label="Human verification"></div>
      <p id="verification-status" role="status" aria-live="polite">Loading human verification...</p>
    </main>
  </body>
</html>`,
    {
      headers: {
        "Cache-Control": "no-store",
        "Content-Security-Policy": gateContentSecurityPolicy(nonce),
        "Content-Type": "text/html; charset=utf-8",
        "Cross-Origin-Opener-Policy": "same-origin",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
      },
    },
  )
}

async function handleAccessVerification(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." })
  }

  if (!isSameOriginRequest(request)) {
    console.info(
      JSON.stringify({ event: "access_verification_origin_rejected" }),
    )
    return jsonResponse(403, { error: "Request not allowed." })
  }

  const payload = await parsedJsonBody(request, MAX_GATE_REQUEST_BYTES)
  if (!isAccessVerificationRequest(payload)) {
    return jsonResponse(400, { error: "Invalid request." })
  }

  const clientIp = request.headers.get("CF-Connecting-IP")?.trim() ?? null
  if (!isIpHeaderSafe(clientIp)) {
    console.error(
      JSON.stringify({ event: "access_verification_ip_unavailable" }),
    )
    return jsonResponse(503, {
      error: "Verification is temporarily unavailable.",
    })
  }

  if (!(await verifyTurnstile(payload.turnstileToken, clientIp, env))) {
    console.info(JSON.stringify({ event: "access_verification_rejected" }))
    return jsonResponse(403, { error: "Verification could not be completed." })
  }

  let session: string

  try {
    session = await createAccessSession(env)
  } catch {
    console.error(JSON.stringify({ event: "access_session_creation_failed" }))
    return jsonResponse(503, {
      error: "Verification is temporarily unavailable.",
    })
  }

  console.info(JSON.stringify({ event: "access_verification_accepted" }))
  return jsonResponse(200, { message: "Verification complete." }, {
    "Set-Cookie": accessGateCookie(session),
  })
}

async function handleContact(request: Request, env: Env): Promise<Response> {
  const cors = corsHeaders(request, env)

  if (request.method === "OPTIONS") {
    if (!allowedOrigin(request, env)) {
      return jsonResponse(403, { error: "Request not allowed." })
    }

    return new Response(null, {
      status: 204,
      headers: {
        "Cache-Control": "no-store",
        ...cors,
      },
    })
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." }, cors)
  }

  if (!allowedOrigin(request, env)) {
    console.info(JSON.stringify({ event: "contact_origin_rejected" }))
    return jsonResponse(403, { error: "Request not allowed." })
  }

  if (!(await hasValidAccessSession(request, env))) {
    console.info(JSON.stringify({ event: "contact_access_session_rejected" }))
    return jsonResponse(403, { error: "Request not allowed." }, cors)
  }

  const payload = await parsedJsonBody(request, MAX_CONTACT_REQUEST_BYTES)
  if (!isContactRequest(payload)) {
    return jsonResponse(400, { error: "Invalid request." }, cors)
  }

  const clientIp = request.headers.get("CF-Connecting-IP")?.trim() ?? null

  if (!isIpHeaderSafe(clientIp)) {
    console.error(JSON.stringify({ event: "client_ip_unavailable" }))
    return jsonResponse(
      503,
      { error: "Unable to send your message. Please try again." },
      cors,
    )
  }

  const contactBody = JSON.stringify({
    name: payload.name,
    email: payload.email,
    message: payload.message,
  })

  let attestation: string

  try {
    attestation = await signAttestation(
      contactBody,
      clientIp,
      env.CONTACT_PROXY_PRIVATE_KEY,
    )
  } catch {
    console.error(JSON.stringify({ event: "proxy_attestation_failed" }))
    return jsonResponse(
      503,
      { error: "Unable to send your message. Please try again." },
      cors,
    )
  }

  let upstream: Response

  try {
    upstream = await fetch(env.CONTACT_API_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Contact-Proxy-Attestation": attestation,
        "X-Forwarded-For": clientIp,
      },
      body: contactBody,
      signal: AbortSignal.timeout(12_000),
    })
  } catch {
    console.error(JSON.stringify({ event: "contact_upstream_unavailable" }))
    return jsonResponse(
      503,
      { error: "Unable to send your message. Please try again." },
      cors,
    )
  }

  if (upstream.status !== 202) {
    console.error(
      JSON.stringify({
        event: "contact_upstream_rejected",
        status: upstream.status,
      }),
    )
    return jsonResponse(
      503,
      { error: "Unable to send your message. Please try again." },
      cors,
    )
  }

  console.info(JSON.stringify({ event: "contact_accepted", status: 202 }))
  return jsonResponse(202, { message: "Your message has been sent." }, cors)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const pathname = new URL(request.url).pathname

    if (pathname === "/verify-access") {
      return handleAccessVerification(request, env)
    }

    if (pathname === "/contact") {
      return handleContact(request, env)
    }

    if (!(await hasValidAccessSession(request, env))) {
      if (request.method === "GET" || request.method === "HEAD") {
        return accessGateResponse(env)
      }

      return jsonResponse(403, { error: "Request not allowed." })
    }

    const embeddedAsset = embeddedAssetResponse(request)
    if (embeddedAsset) return embeddedAsset
    if (env.ASSETS) return env.ASSETS.fetch(request)

    return new Response("Not found.", {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    })
  },
}
