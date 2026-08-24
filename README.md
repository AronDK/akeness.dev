# akeness.dev

A terminal-inspired React portfolio template. The runnable application and its
tooling live in [`src/`](src/); the repository root is intentionally limited to
this README and `.gitignore`.

## Run locally

```sh
cd src
pnpm install
pnpm dev
```

Build a production bundle with `pnpm build` from `src/`.

## Configure a site

Set optional display values in a local `src/.env` file. The UI hides social and
contact links when their corresponding values are empty. Set `VITE_RESUME_URL`
to the HTTPS resume location to make the résumé control an active download
link.

`VITE_*` environment variables are embedded in the client bundle. They keep
this public repository free of personal settings, but they are **not** a place
for credentials, API keys, or other secrets.

## Contact-form email delivery

The contact form sends JSON to the HTTPS URL in `VITE_CONTACT_API_URL`.
Production uses the site-origin `/contact` route. On a visitor's first request,
the Cloudflare Worker presents a Turnstile entry gate. It validates the
single-use token server-side, including its action and hostname, then issues a
signed, secure, host-only `HttpOnly` session cookie that lasts 12 hours. The
site and `/contact` both require that cookie. The Worker then signs the exact
three-field contact payload and proxies it to the AWS API. The Lambda accepts
only signed Worker requests, so knowing the API Gateway URL alone cannot bypass
the human check.

The AWS CDK application lives in [`src/infra/`](src/infra/) and provisions a
Regional API Gateway REST API, `POST /contact`, a TypeScript Lambda sender,
SES permissions constrained to the configured sender and recipient, API and
Lambda log retention, and a Regional WAF rate-based rule using the verified
forwarded client IP.

Copy [`src/.env.example`](src/.env.example) to the ignored `src/.env` file and
set these values locally. Do not commit `src/.env`.

```dotenv
CONTACT_RECIPIENT_EMAIL=
SES_FROM_EMAIL=
ALLOWED_ORIGINS=
CONTACT_PROXY_PUBLIC_KEY=
VITE_RESUME_URL=
VITE_CONTACT_API_URL=
TURNSTILE_SITE_KEY=
```

- `CONTACT_RECIPIENT_EMAIL` is the private destination for contact messages.
- `SES_FROM_EMAIL` is a separately configured sender email identity. It is
  used as SES `From`.
- `ALLOWED_ORIGINS` is a comma-separated list of exact frontend origins. Use
  HTTPS origins in production. HTTP is accepted only for loopback development
  origins.
- `CONTACT_PROXY_PUBLIC_KEY` is the base64 SPKI public half of a generated
  Ed25519 signing key. It is not secret, but remains deployment configuration.
- `VITE_RESUME_URL` and `VITE_CONTACT_API_URL` are public browser settings.
  Production should point the latter at the same-origin Worker route, such as
  `https://your-domain.example/contact`.
- `TURNSTILE_SITE_KEY` is the public site key rendered by the Worker entry
  gate. It is not a secret, but keep it in noncommitted deployment
  configuration so it is not embedded in tracked source.

The visitor email address is included in the plain-text message body. It is
never used as the SES `From` or `Reply-To` address.

### Cloudflare Turnstile and Worker configuration

Create a managed Turnstile widget with exact production and development
hostnames. Configure its public site key on the Worker as `TURNSTILE_SITE_KEY`.
The Worker verifies each entry-gate token server-side with the expected
`site-access` action and hostname before setting the access-session cookie.
The contact request contains only `name`, `email`, and `message`; it is allowed
only after that session check succeeds.

Set these as Cloudflare Worker secrets, never `VITE_*` values or tracked
configuration:

```text
TURNSTILE_SECRET
CONTACT_PROXY_PRIVATE_KEY
CONTACT_API_URL
ACCESS_GATE_SECRET
```

Set these Worker bindings from noncommitted deployment configuration:

```text
ALLOWED_ORIGINS
TURNSTILE_EXPECTED_ACTION
TURNSTILE_HOSTNAMES
TURNSTILE_SITE_KEY
```

`CONTACT_PROXY_PRIVATE_KEY` must be the private JWK corresponding to
`CONTACT_PROXY_PUBLIC_KEY`. Rotate the pair together: publish a new Worker
private key and deploy the matching CDK public key before retiring the old
pair.

Set `TURNSTILE_EXPECTED_ACTION` to `site-access`. Set `ACCESS_GATE_SECRET` to
a newly generated, high-entropy Worker secret. Rotating it revokes existing
entry-gate sessions immediately.

Before deploying, configure SES in `ap-southeast-2`:

1. Verify the sender identity represented by `SES_FROM_EMAIL`. For production,
   verify the sending domain and configure DKIM, a custom MAIL FROM subdomain,
   SPF, and DMARC.
2. While the SES account is in the sandbox, verify both the sender and the
   recipient email identities. SES will not deliver to an unverified recipient
   in sandbox mode.
3. Request SES production access before relying on delivery to unverified
   recipients.

Install and validate the infrastructure locally:

```sh
cd src/infra
pnpm install
pnpm test
pnpm typecheck
pnpm synth
```

After reviewing the synthesized changes and with deployment approval, deploy
with the intended profile and Region:

```sh
cd src/infra
pnpm cdk deploy --profile AronDK --region ap-southeast-2
```

Set the resulting `ContactApiUrl` as the Worker-only `CONTACT_API_URL` secret,
then rebuild and deploy the frontend through its existing hosting workflow.

## Content and local files

The tracked [`src/data/content.ts`](src/data/content.ts) loads private content,
images, and local notes from `src/private/`; that directory is git-ignored. The
app loads local Markdown from this virtual filesystem at build time:

```text
src/private/nerdblog/
├── readme.md
├── Blog/
├── Projects/
└── Experiences/
```

Each Markdown file may begin with simple frontmatter such as `title`, `date`,
`summary`, `role`, `stack`, `tag`, and `readtime`. A root `readme.md` and any
entries you want to publish must be present locally; the site intentionally has
no generic content fallback.

Markdown supports standard and GitHub-flavoured formatting, fenced code blocks
with syntax highlighting, and images. Keep post images under
`src/private/nerdblog/` and reference them relative to the Markdown file so
Vite includes them in the deployed build:

```text
src/private/nerdblog/Blog/
├── cloudflare-notes.md
└── images/
    └── cloudflare-notes-flow.webp
```

````md
![Request flow](./images/cloudflare-notes-flow.webp)

```ts
export const origin = "https://akeness.dev"
```
````
