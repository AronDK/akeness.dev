import { useState, type ReactNode } from "react"
import { siteConfig } from "../config/site"

interface WaybarProps {
  onContactOpen: () => void
}

const profileImages = import.meta.glob<string>(
  "../private/assets/profile.{avif,jpeg,jpg,png,webp}",
  {
    eager: true,
    import: "default",
    query: "?url",
  },
)
const profileImage = Object.values(profileImages)[0]

const GitHubIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.745 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
)

const LinkedInIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
)

const MailIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
)

const FileDownIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="12" y1="18" x2="12" y2="12" />
    <line x1="9" y1="15" x2="12" y2="18" />
    <line x1="15" y1="15" x2="12" y2="18" />
  </svg>
)

const MapPinIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
)

export default function Waybar({ onContactOpen }: WaybarProps) {
  const [profileImageFailed, setProfileImageFailed] = useState(false)
  const avatarLetters = siteConfig.owner
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase()

  return (
    <header className="w-full flex justify-center px-4 pt-5 pb-2">
      <div
        className="glass waybar-shadow w-full max-w-5xl rounded-2xl border px-6 py-4"
        style={{ borderColor: "#41484D", borderRadius: "22px" }}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div
              aria-label="Site avatar"
              className="shrink-0 rounded-full flex items-center justify-center"
              style={{
                width: 72,
                height: 72,
                background: "linear-gradient(145deg, #334952, #1d272d)",
                border: "1px solid rgba(143,206,243,0.28)",
                color: "#8FCEF3",
                fontSize: "1.1rem",
                fontWeight: 700,
                overflow: "hidden",
              }}
            >
              {profileImage && !profileImageFailed ? (
                <img
                  src={profileImage}
                  alt={`${siteConfig.owner} profile`}
                  onError={() => setProfileImageFailed(true)}
                  style={{ height: "100%", objectFit: "cover", width: "100%" }}
                />
              ) : (
                avatarLetters || "~"
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  style={{
                    color: "#DFE3E7",
                    fontWeight: 700,
                    fontSize: "1.05rem",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {siteConfig.owner}
                </span>
                {siteConfig.email && (
                  <>
                    <span style={{ color: "#41484D", fontSize: "0.8rem" }}>
                      —
                    </span>
                    <a
                      href={`mailto:${siteConfig.email}`}
                      style={{
                        color: "#8FCEF3",
                        fontSize: "0.78rem",
                        fontWeight: 500,
                        textDecoration: "none",
                      }}
                    >
                      {siteConfig.email}
                    </a>
                  </>
                )}
              </div>
              <div
                style={{
                  color: "#C0C7CD",
                  fontSize: "0.8rem",
                  marginTop: "2px",
                }}
              >
                {siteConfig.bio}
              </div>
              {siteConfig.location && (
                <div
                  style={{
                    color: "#41484D",
                    fontSize: "0.73rem",
                    marginTop: "3px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <MapPinIcon />
                  <span style={{ color: "#8d949a" }}>
                    {siteConfig.location}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {siteConfig.githubUrl && (
              <WaybarLink
                href={siteConfig.githubUrl}
                icon={<GitHubIcon />}
                label={siteConfig.githubLabel}
              />
            )}
            {siteConfig.linkedinUrl && (
              <WaybarLink
                href={siteConfig.linkedinUrl}
                icon={<LinkedInIcon />}
                label={siteConfig.linkedinLabel}
              />
            )}
            <button
              type="button"
              onClick={onContactOpen}
              className="waybar-btn"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "5px 12px",
                borderRadius: "8px",
                border: "1px solid #41484D",
                background: "rgba(143,206,243,0.08)",
                color: "#8FCEF3",
                fontSize: "0.75rem",
                fontFamily: "inherit",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <MailIcon />
              contact
            </button>
            {siteConfig.resumeUrl ? (
              <WaybarLink
                href={siteConfig.resumeUrl}
                icon={<FileDownIcon />}
                label="résumé"
                download
              />
            ) : (
              <button
                type="button"
                disabled
                title="Set VITE_RESUME_URL in .env to enable this download"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 12px",
                  borderRadius: "8px",
                  border: "1px solid rgba(65,72,77,0.5)",
                  background: "transparent",
                  color: "#8d949a",
                  fontSize: "0.75rem",
                  fontFamily: "inherit",
                  fontWeight: 500,
                  opacity: 0.62,
                  cursor: "not-allowed",
                }}
              >
                <FileDownIcon />
                résumé
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

function WaybarLink({
  href,
  icon,
  label,
  download = false,
}: {
  href: string
  icon: ReactNode
  label: string
  download?: boolean
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      download={download || undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "5px 12px",
        borderRadius: "8px",
        border: "1px solid #41484D",
        background: "transparent",
        color: "#C0C7CD",
        fontSize: "0.75rem",
        fontFamily: "inherit",
        fontWeight: 500,
        textDecoration: "none",
      }}
    >
      {icon}
      {label}
    </a>
  )
}
