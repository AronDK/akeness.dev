import { useEffect, useRef, useState } from "react"
import ContactModal from "./components/ContactModal"
import MarkdownEntry from "./components/MarkdownEntry"
import Waybar from "./components/Waybar"
import YaziNavigator from "./components/YaziNavigator"
import { siteConfig } from "./config/site"
import { blogs, experiences, projects, rootReadme } from "./data/content"

const ChevronRightIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

const heroTags = [
  "react",
  "typescript",
  "design systems",
  "writing",
  "accessibility",
]

export default function App() {
  const [contactOpen, setContactOpen] = useState(false)
  const [yaziOpen, setYaziOpen] = useState(false)
  const mainRef = useRef<HTMLDivElement>(null)
  const orderedEntries = [...blogs, ...projects, ...experiences]

  const scrollTo = (id: string) => {
    if (id === rootReadme.id) {
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }

    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  useEffect(() => {
    document.title = siteConfig.name
  }, [])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContactOpen(false)
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 80% 0%, #263d4b 0%, #0f1417 42%, #0b1013 100%)",
      }}
    >
      <div
        ref={mainRef}
        style={{ position: "relative", zIndex: 1, minHeight: "100vh" }}
      >
        <Waybar
          onContactOpen={() => setContactOpen(true)}
          onOpenFile={scrollTo}
        />

        <main
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "0 16px 80px",
          }}
        >
          <div
            className="glass waybar-shadow"
            style={{
              maxWidth: "900px",
              width: "100%",
              borderRadius: "12px",
              border: "1px solid rgba(65,72,77,0.5)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "8px 16px",
                borderBottom: "1px solid rgba(65,72,77,0.5)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(15,20,23,0.3)",
              }}
            >
              <span style={{ color: "#41484D", fontSize: "0.67rem" }}>
                <span style={{ color: "#8FCEF3" }}>~</span>/
                {siteConfig.directoryName}/
                <span style={{ color: "#C0C7CD" }}>README.md</span>
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  color: "#41484D",
                  fontSize: "0.6rem",
                }}
              >
                {orderedEntries.length} entries
              </span>
            </div>

            <div
              style={{
                padding: "28px 32px",
                borderBottom: "1px solid rgba(65,72,77,0.35)",
              }}
            >
              <div className="prose-terminal">
                <h1 style={{ marginTop: 0 }}>{siteConfig.name}</h1>
                <p style={{ maxWidth: "64ch" }}>{siteConfig.bio}</p>
                <p style={{ maxWidth: "64ch", color: "#C0C7CD" }}>
                  Browse entries through the{" "}
                  <button
                    type="button"
                    onClick={() => setYaziOpen(true)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: "0 2px",
                      fontFamily: "inherit",
                      fontSize: "inherit",
                      color: "#8FCEF3",
                      cursor: "pointer",
                      textDecoration: "underline",
                      textUnderlineOffset: "3px",
                      textDecorationColor: "rgba(143,206,243,0.4)",
                    }}
                  >
                    Yazi file navigator
                  </button>{" "}
                  on the left, or press{" "}
                  <button
                    type="button"
                    onClick={() => setYaziOpen(true)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "3px",
                      background: "rgba(143,206,243,0.08)",
                      border: "1px solid rgba(143,206,243,0.25)",
                      borderRadius: "5px",
                      padding: "1px 7px 1px 5px",
                      fontFamily: "inherit",
                      fontSize: "0.75rem",
                      color: "#8FCEF3",
                      cursor: "pointer",
                      verticalAlign: "middle",
                    }}
                  >
                    <ChevronRightIcon /> yazi
                  </button>{" "}
                  to explore by category and preview a file before jumping.
                </p>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "6px",
                    marginTop: "4px",
                  }}
                >
                  {heroTags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        padding: "2px 8px",
                        borderRadius: "4px",
                        border: "1px solid rgba(65,72,77,0.6)",
                        color: "#8d949a",
                        fontSize: "0.65rem",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {orderedEntries.map((entry) => (
              <MarkdownEntry key={entry.id} entry={entry} />
            ))}

            <footer
              style={{
                padding: "20px 32px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                borderTop: "1px solid rgba(65,72,77,0.3)",
                flexWrap: "wrap",
              }}
            >
              <span style={{ color: "#41484D", fontSize: "0.65rem" }}>
                <span style={{ color: "#8FCEF3" }}>{siteConfig.owner}</span> ·{" "}
                {new Date().getFullYear()}
              </span>
              {siteConfig.githubUrl && (
                <>
                  <span style={{ color: "#41484D", fontSize: "0.65rem" }}>
                    ·
                  </span>
                  <a
                    href={siteConfig.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#8d949a",
                      fontSize: "0.65rem",
                      textDecoration: "none",
                    }}
                  >
                    {siteConfig.githubLabel}
                  </a>
                </>
              )}
              <button
                type="button"
                onClick={() => setContactOpen(true)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#8d949a",
                  fontSize: "0.65rem",
                  fontFamily: "inherit",
                  cursor: "pointer",
                  padding: 0,
                  textDecoration: "underline",
                  textUnderlineOffset: "2px",
                }}
              >
                contact
              </button>
            </footer>
          </div>
        </main>
      </div>

      <YaziNavigator
        onSelect={scrollTo}
        open={yaziOpen}
        onOpenChange={setYaziOpen}
      />
      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </div>
  )
}
