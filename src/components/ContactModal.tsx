import {
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react"
import { siteConfig } from "../config/site"

interface ContactModalProps {
  open: boolean
  onClose: () => void
}

interface ContactDetailProps {
  label: string
  value: string
  href: string
}

interface FieldProps {
  label: string
  children: ReactNode
}

type SubmissionState = "idle" | "submitting" | "success" | "error"

const XIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

export default function ContactModal({ open, onClose }: ContactModalProps) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [submissionState, setSubmissionState] =
    useState<SubmissionState>("idle")
  const [submissionError, setSubmissionError] = useState<string | null>(null)

  if (!open) return null

  const closeModal = () => {
    if (submissionState === "submitting") return
    setSubmissionState("idle")
    setSubmissionError(null)
    onClose()
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (submissionState === "submitting") return

    const apiUrl = import.meta.env.VITE_CONTACT_API_URL?.trim()

    try {
      if (!apiUrl || new URL(apiUrl).protocol !== "https:") {
        throw new Error("Contact API URL is not configured")
      }
    } catch {
      setSubmissionState("error")
      setSubmissionError(
        "Unable to send your message right now. Please try again.",
      )
      return
    }

    setSubmissionState("submitting")
    setSubmissionError(null)

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, message }),
      })

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("verification session expired")
        }

        throw new Error("Contact request failed")
      }

      setSubmissionState("success")
    } catch (error) {
      setSubmissionState("error")
      setSubmissionError(
        error instanceof Error &&
          error.message === "verification session expired"
          ? "Your verification session has expired. Reload the page and try again."
          : "Unable to send your message right now. Please try again.",
      )
    }
  }

  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    background: "rgba(15,20,23,0.8)",
    border: "1px solid #41484D",
    borderRadius: "7px",
    color: "#DFE3E7",
    fontSize: "0.8rem",
    fontFamily: "inherit",
    outline: "none",
  }

  const details = [
    siteConfig.email
      ? {
          label: "email",
          value: siteConfig.email,
          href: `mailto:${siteConfig.email}`,
        }
      : undefined,
    siteConfig.githubUrl
      ? {
          label: "code",
          value: siteConfig.githubLabel,
          href: siteConfig.githubUrl,
        }
      : undefined,
    siteConfig.linkedinUrl
      ? {
          label: "profile",
          value: siteConfig.linkedinLabel,
          href: siteConfig.linkedinUrl,
        }
      : undefined,
  ].filter((detail): detail is ContactDetailProps => Boolean(detail))

  return (
    <>
      <button
        type="button"
        aria-label="Close contact dialog"
        className="fade-in"
        onClick={closeModal}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 80,
          border: "none",
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          cursor: "default",
        }}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label="Contact"
        className="modal-fade-in"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          zIndex: 90,
          width: "min(480px, 90vw)",
          background: "rgba(22, 27, 30, 0.97)",
          backdropFilter: "blur(32px)",
          WebkitBackdropFilter: "blur(32px)",
          border: "1px solid #41484D",
          borderRadius: "14px",
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid rgba(65,72,77,0.5)",
          }}
        >
          <div>
            <span
              style={{ color: "#8FCEF3", fontSize: "0.75rem", fontWeight: 600 }}
            >
              contact
            </span>
            <span
              style={{
                color: "#41484D",
                fontSize: "0.7rem",
                marginLeft: "8px",
              }}
            >
              {siteConfig.email || "secure message delivery"}
            </span>
          </div>
          <button
            type="button"
            aria-label="Close contact dialog"
            onClick={closeModal}
            style={{
              background: "none",
              border: "none",
              color: "#8d949a",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              borderRadius: "4px",
            }}
          >
            <XIcon />
          </button>
        </div>

        <div style={{ padding: "20px 20px 24px" }}>
          {submissionState === "success" ? (
            <div
              className="fade-in"
              role="status"
              aria-live="polite"
              style={{ textAlign: "center", padding: "24px 0" }}
            >
              <div
                style={{
                  color: "#8FCEF3",
                  fontSize: "1.4rem",
                  marginBottom: "8px",
                }}
              >
                !
              </div>
              <div
                style={{
                  color: "#DFE3E7",
                  fontSize: "0.85rem",
                  marginBottom: "4px",
                }}
              >
                Your message has been sent.
              </div>
              <div style={{ color: "#8d949a", fontSize: "0.75rem" }}>
                Thanks for getting in touch.
              </div>
              <button
                type="button"
                onClick={closeModal}
                style={{
                  marginTop: "20px",
                  padding: "7px 20px",
                  borderRadius: "7px",
                  border: "1px solid #41484D",
                  background: "transparent",
                  color: "#C0C7CD",
                  fontSize: "0.75rem",
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                close
              </button>
            </div>
          ) : (
            <>
              {details.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    marginBottom: "18px",
                    padding: "10px 12px",
                    background: "rgba(15,20,23,0.5)",
                    borderRadius: "8px",
                    border: "1px solid rgba(65,72,77,0.4)",
                    flexWrap: "wrap",
                  }}
                >
                  {details.map((detail) => (
                    <ContactDetail key={detail.label} {...detail} />
                  ))}
                </div>
              )}

              <form
                onSubmit={handleSubmit}
                aria-busy={submissionState === "submitting"}
              >
                <div
                  style={{ display: "flex", gap: "10px", marginBottom: "10px" }}
                >
                  <Field label="name">
                    <input
                      type="text"
                      name="name"
                      autoComplete="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Your name"
                      style={inputStyle}
                      required
                      maxLength={120}
                      disabled={submissionState === "submitting"}
                    />
                  </Field>
                  <Field label="email">
                    <input
                      type="email"
                      name="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      style={inputStyle}
                      required
                      maxLength={254}
                      disabled={submissionState === "submitting"}
                    />
                  </Field>
                </div>
                <Field label="message">
                  <textarea
                    name="message"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="What's on your mind?"
                    rows={4}
                    style={{
                      ...inputStyle,
                      resize: "vertical",
                      lineHeight: "1.6",
                    }}
                    required
                    maxLength={5000}
                    disabled={submissionState === "submitting"}
                  />
                </Field>
                {submissionState === "error" && (
                  <p
                    role="alert"
                    style={{
                      color: "#E89B9B",
                      fontSize: "0.75rem",
                      margin: "12px 0 0",
                    }}
                  >
                    {submissionError}
                  </p>
                )}
                {submissionState === "submitting" && (
                  <p
                    role="status"
                    aria-live="polite"
                    style={{
                      color: "#8d949a",
                      fontSize: "0.75rem",
                      margin: "12px 0 0",
                    }}
                  >
                    Sending your message...
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submissionState === "submitting"}
                  style={{
                    width: "100%",
                    marginTop: "14px",
                    padding: "9px",
                    borderRadius: "8px",
                    border: "1px solid rgba(143,206,243,0.4)",
                    background: "rgba(143,206,243,0.12)",
                    color: "#8FCEF3",
                    fontSize: "0.78rem",
                    fontFamily: "inherit",
                    fontWeight: 600,
                    cursor:
                      submissionState === "submitting" ? "wait" : "pointer",
                    letterSpacing: "0.04em",
                    opacity: submissionState === "submitting" ? 0.7 : 1,
                  }}
                >
                  {submissionState === "submitting"
                    ? "sending..."
                    : "send message"}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </>
  )
}

function Field({ label, children }: FieldProps) {
  return (
    <label style={{ display: "block", flex: 1 }}>
      <span
        style={{
          color: "#8d949a",
          fontSize: "0.65rem",
          display: "block",
          marginBottom: "4px",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}

function ContactDetail({ label, value, href }: ContactDetailProps) {
  return (
    <div>
      <div
        style={{
          color: "#41484D",
          fontSize: "0.6rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: "2px",
        }}
      >
        {label}
      </div>
      <a
        href={href}
        target={href.startsWith("mailto:") ? undefined : "_blank"}
        rel={href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
        style={{
          color: "#8FCEF3",
          fontSize: "0.72rem",
          textDecoration: "none",
        }}
      >
        {value}
      </a>
    </div>
  )
}
