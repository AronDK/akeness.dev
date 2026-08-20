const value = (configured: string | undefined, fallback = "") =>
  configured?.trim() || fallback

/**
 * Public site settings. Configure these in a local `.env` file; the app stays
 * useful with the generic defaults in this module.
 *
 * Vite exposes VITE_* values to the browser, so they must never contain
 * credentials or other secrets.
 */
export const siteConfig = {
  name: value(import.meta.env.VITE_SITE_NAME, "Portfolio"),
  owner: value(import.meta.env.VITE_SITE_OWNER, "Portfolio Owner"),
  email: value(import.meta.env.VITE_SITE_EMAIL),
  githubUrl: value(import.meta.env.VITE_GITHUB_URL),
  githubLabel: value(import.meta.env.VITE_GITHUB_LABEL, "GitHub"),
  linkedinUrl: value(import.meta.env.VITE_LINKEDIN_URL),
  linkedinLabel: value(import.meta.env.VITE_LINKEDIN_LABEL, "LinkedIn"),
  resumeUrl: value(import.meta.env.VITE_RESUME_URL),
  bio: value(
    import.meta.env.VITE_SITE_BIO,
    "A terminal-inspired portfolio template for work, writing, and notes.",
  ),
  location: value(import.meta.env.VITE_SITE_LOCATION),
  terminalHost: value(import.meta.env.VITE_TERMINAL_HOST, "portfolio.local"),
  directoryName: value(import.meta.env.VITE_SITE_PATH, "portfolio"),
}
