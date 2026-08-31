import {
  useEffect,
  useState,
  type AnimationEvent,
  type MouseEvent,
} from "react"
import {
  entries,
  projects,
  blogs,
  experiences,
  rootReadme,
  type Entry,
  type VirtualFile,
} from "../data/content"
import { sidePanelSize } from "./sidePanel"

interface YaziNavigatorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (id: string) => void
}

type RootDir = "all" | "blog" | "project" | "experience"
type NavigatorFile = Entry | VirtualFile

interface RootDirEntry {
  id: RootDir
  label: string
  count: number
}

const EXIT_ANIMATION_FALLBACK_MS = 320

const FolderIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
)

const FileIcon = () => (
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
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
)

const ChevronRightIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
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

const CloseIcon = () => (
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
    <line x1="6" y1="18" x2="18" y2="6" />
  </svg>
)

const rootDirs: RootDirEntry[] = [
  { id: "all", label: "All", count: entries.length + 1 },
  { id: "blog", label: "Blog", count: blogs.length },
  { id: "project", label: "Projects", count: projects.length },
  { id: "experience", label: "Experiences", count: experiences.length },
]

function getFiles(dir: RootDir): NavigatorFile[] {
  if (dir === "blog") return blogs
  if (dir === "project") return projects
  if (dir === "experience") return experiences
  return [rootReadme, ...entries]
}

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT")
  )
}

export default function YaziNavigator({
  open,
  onOpenChange,
  onSelect,
}: YaziNavigatorProps) {
  const [activeDir, setActiveDir] = useState<RootDir>("all")
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [isRootReadmeSelected, setIsRootReadmeSelected] = useState(false)
  const [isMounted, setIsMounted] = useState(open)
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    if (open) {
      setIsMounted(true)
      setIsClosing(false)
    } else if (isMounted) {
      setIsClosing(true)
    }
  }, [isMounted, open])

  useEffect(() => {
    if (!isClosing) return

    const timeout = window.setTimeout(() => {
      setIsClosing(false)
      setIsMounted(false)
    }, EXIT_ANIMATION_FALLBACK_MS)

    return () => window.clearTimeout(timeout)
  }, [isClosing])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false)
        return
      }

      if (
        event.key !== "[" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTypingTarget(event.target)
      ) {
        return
      }

      event.preventDefault()
      onOpenChange(!open)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onOpenChange, open])

  const files = isRootReadmeSelected ? [] : getFiles(activeDir)
  const selectedEntry = isRootReadmeSelected
    ? rootReadme
    : activeFile
      ? files.find((entry) => entry.id === activeFile)
      : null

  const close = () => onOpenChange(false)

  const handleFileSelect = (id: string) => {
    if (id !== rootReadme.id) setIsRootReadmeSelected(false)
    setActiveFile(id)
  }

  const handleRootReadmeSelect = () => {
    setActiveDir("all")
    setActiveFile(rootReadme.id)
    setIsRootReadmeSelected(true)
  }

  const handleJumpToSection = (id: string) => {
    onSelect(id)
    close()
  }

  const handleAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || open || !isClosing) return

    setIsClosing(false)
    setIsMounted(false)
  }

  const handleFileHover = (
    event: MouseEvent<HTMLButtonElement>,
    id: string,
    hovered: boolean,
  ) => {
    if (activeFile === id) return
    event.currentTarget.style.background = hovered
      ? "rgba(255,255,255,0.03)"
      : "transparent"
  }

  return (
    <>
      <button
        type="button"
        className="yazi-tab"
        title="Open file navigator"
        onClick={() => onOpenChange(true)}
        style={{
          position: "fixed",
          left: 0,
          top: "calc(50% - 42px)",
          transform: "translateY(-50%)",
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "12px 7px 12px 5px",
          background: "rgba(15, 20, 23, 0.92)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderTop: "1px solid rgba(143,206,243,0.5)",
          borderRight: "1px solid rgba(143,206,243,0.5)",
          borderBottom: "1px solid rgba(143,206,243,0.5)",
          borderLeft: "none",
          borderRadius: "0 10px 10px 0",
          color: "#8FCEF3",
          cursor: "pointer",
          writingMode: "vertical-rl",
          textOrientation: "mixed",
          fontSize: "0.65rem",
          fontFamily: "inherit",
          fontWeight: 600,
          letterSpacing: "0.1em",
          transition: "box-shadow 0.15s, border-color 0.15s, background 0.15s",
        }}
      >
        <ChevronRightIcon size={12} />
        <span style={{ transform: "rotate(180deg)" }}>yazi</span>
      </button>

      {isMounted && (
        <>
          <div
            aria-hidden="true"
            className="yazi-click-away"
            onClick={close}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 60,
              background: "transparent",
            }}
          />

          <div
            role="dialog"
            aria-label="Yazi file navigator"
            aria-modal="false"
            className={`yazi-island${isClosing ? " yazi-island-closing" : ""}`}
            onAnimationEnd={handleAnimationEnd}
            style={{
              position: "fixed",
              left: 0,
              top: "50%",
              zIndex: 70,
              ...sidePanelSize,
              display: "flex",
              flexDirection: "column",
              transform: "translateY(-50%)",
              transformOrigin: "left calc(50% - 42px)",
              overflow: "hidden",
              background: "rgba(15, 20, 23, 0.96)",
              backdropFilter: "blur(32px)",
              WebkitBackdropFilter: "blur(32px)",
              borderTop: "1px solid #41484D",
              borderRight: "1px solid #41484D",
              borderBottom: "1px solid #41484D",
              borderLeft: "none",
              borderRadius: "0 14px 14px 0",
              boxShadow: "18px 20px 54px rgba(0,0,0,0.35)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderBottom: "1px solid rgba(65,72,77,0.6)",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  color: "#8FCEF3",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                }}
              >
                yazi — file navigator
              </span>
              <button
                type="button"
                aria-label="Close file navigator"
                onClick={close}
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
                <CloseIcon />
              </button>
            </div>

            <div
              className="yazi-columns-scroll"
              style={{
                display: "flex",
                flex: 1,
                minHeight: 0,
                overflowX: "auto",
                overflowY: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flex: 1,
                  minWidth: "640px",
                  minHeight: 0,
                }}
              >
                <div
                  style={{
                    width: 160,
                    flexShrink: 0,
                    overflowY: "auto",
                    padding: "8px 0",
                    borderRight: "1px solid rgba(65,72,77,0.5)",
                  }}
                >
                  <ColumnLabel>root</ColumnLabel>
                  {rootDirs.map((dir) => (
                    <button
                      type="button"
                      key={dir.id}
                      onClick={() => {
                        setActiveDir(dir.id)
                        setActiveFile(null)
                        setIsRootReadmeSelected(false)
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: "7px",
                        padding: "6px 10px",
                        background:
                          activeDir === dir.id
                            ? "rgba(143,206,243,0.12)"
                            : "transparent",
                        borderTop: "none",
                        borderRight: "none",
                        borderBottom: "none",
                        borderLeft: `2px solid ${
                          activeDir === dir.id ? "#8FCEF3" : "transparent"
                        }`,
                        color: activeDir === dir.id ? "#8FCEF3" : "#C0C7CD",
                        fontSize: "0.75rem",
                        fontFamily: "inherit",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.12s",
                      }}
                    >
                      <FolderIcon />
                      <span style={{ flex: 1 }}>{dir.label}</span>
                      <span style={{ color: "#41484D", fontSize: "0.6rem" }}>
                        {dir.count}
                      </span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleRootReadmeSelect}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "7px",
                      marginTop: "6px",
                      padding: "7px 10px",
                      background: isRootReadmeSelected
                        ? "rgba(143,206,243,0.12)"
                        : "transparent",
                      borderTop: "1px solid rgba(65,72,77,0.5)",
                      borderRight: "none",
                      borderBottom: "none",
                      borderLeft: `2px solid ${
                        isRootReadmeSelected ? "#8FCEF3" : "transparent"
                      }`,
                      color: isRootReadmeSelected ? "#DFE3E7" : "#C0C7CD",
                      fontSize: "0.72rem",
                      fontFamily: "inherit",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ color: "#8FCEF3", opacity: 0.7 }}>
                      <FileIcon />
                    </span>
                    <span style={{ wordBreak: "break-all" }}>
                      {rootReadme.filename}
                    </span>
                  </button>
                </div>

                <div
                  style={{
                    width: 220,
                    flexShrink: 0,
                    overflowY: "auto",
                    padding: "8px 0",
                    borderRight: "1px solid rgba(65,72,77,0.5)",
                  }}
                >
                  {!isRootReadmeSelected && (
                    <ColumnLabel>{activeDir}</ColumnLabel>
                  )}
                  {files.map((entry) => (
                    <button
                      type="button"
                      key={entry.id}
                      onClick={() => handleFileSelect(entry.id)}
                      onMouseEnter={(event) =>
                        handleFileHover(event, entry.id, true)
                      }
                      onMouseLeave={(event) =>
                        handleFileHover(event, entry.id, false)
                      }
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "7px",
                        padding: "7px 10px",
                        background:
                          activeFile === entry.id
                            ? "rgba(143,206,243,0.1)"
                            : "transparent",
                        borderTop: "none",
                        borderRight: "none",
                        borderBottom: "none",
                        borderLeft: `2px solid ${
                          activeFile === entry.id ? "#8FCEF3" : "transparent"
                        }`,
                        color: activeFile === entry.id ? "#DFE3E7" : "#C0C7CD",
                        fontSize: "0.72rem",
                        fontFamily: "inherit",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.12s",
                        lineHeight: 1.35,
                      }}
                    >
                      <span
                        style={{
                          marginTop: "1px",
                          color:
                            entry.type === "blog" || entry.type === "root"
                              ? "#8FCEF3"
                              : "#C0C7CD",
                          opacity: 0.7,
                          flexShrink: 0,
                        }}
                      >
                        <FileIcon />
                      </span>
                      <span style={{ wordBreak: "break-all" }}>
                        {entry.filename}
                      </span>
                    </button>
                  ))}
                </div>

                <div
                  style={{
                    flex: 1,
                    minWidth: 260,
                    overflowY: "auto",
                    padding: "12px 14px",
                  }}
                >
                  {selectedEntry ? (
                    <FilePreview
                      entry={selectedEntry}
                      onJumpToSection={handleJumpToSection}
                    />
                  ) : (
                    <div
                      style={{
                        color: "#41484D",
                        fontSize: "0.72rem",
                        paddingTop: "8px",
                      }}
                    >
                      <ColumnLabel>preview</ColumnLabel>
                      select a file to preview
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div
              style={{
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: "16px",
                padding: "5px 14px",
                borderTop: "1px solid rgba(65,72,77,0.5)",
              }}
            >
              <span style={{ color: "#41484D", fontSize: "0.63rem" }}>
                <span style={{ color: "#8FCEF3" }}>{files.length}</span> items
              </span>
              <span style={{ color: "#41484D", fontSize: "0.63rem" }}>
                press <span style={{ color: "#C0C7CD" }}>esc</span> or click
                outside to close
              </span>
            </div>
          </div>
        </>
      )}
    </>
  )
}

function ColumnLabel({ children }: { children: string }) {
  return (
    <div
      style={{
        padding: "0 8px 6px",
        color: "#41484D",
        fontSize: "0.6rem",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  )
}

function FilePreview({
  entry,
  onJumpToSection,
}: {
  entry: NavigatorFile
  onJumpToSection: (id: string) => void
}) {
  return (
    <div>
      <ColumnLabel>preview</ColumnLabel>
      <div
        style={{
          color: "#8FCEF3",
          fontSize: "0.82rem",
          fontWeight: 700,
          marginBottom: "4px",
        }}
      >
        {entry.filename}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
          marginBottom: "10px",
        }}
      >
        <span
          style={{
            padding: "2px 7px",
            borderRadius: "4px",
            background: "rgba(143,206,243,0.1)",
            color: "#8FCEF3",
            fontSize: "0.65rem",
            border: "1px solid rgba(143,206,243,0.2)",
          }}
        >
          {entry.type}
        </span>
        {entry.date && (
          <span
            style={{ color: "#41484D", fontSize: "0.67rem", padding: "2px 0" }}
          >
            {entry.date}
          </span>
        )}
        {entry.readTime && (
          <span
            style={{ color: "#8d949a", fontSize: "0.67rem", padding: "2px 0" }}
          >
            ~{entry.readTime}
          </span>
        )}
      </div>
      <p
        style={{
          color: "#C0C7CD",
          fontSize: "0.75rem",
          lineHeight: 1.65,
          marginBottom: "12px",
        }}
      >
        {entry.summary}
      </p>
      {entry.stack && (
        <div style={{ marginBottom: "8px" }}>
          <ColumnLabel>stack</ColumnLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {entry.stack.map((stackItem) => (
              <span
                key={stackItem}
                style={{
                  padding: "1px 6px",
                  borderRadius: "3px",
                  background: "rgba(65,72,77,0.4)",
                  color: "#C0C7CD",
                  fontSize: "0.65rem",
                  border: "1px solid #41484D",
                }}
              >
                {stackItem}
              </span>
            ))}
          </div>
        </div>
      )}
      {entry.tag && (
        <div style={{ display: "flex", gap: "4px" }}>
          {typeof entry.tag === "string" ? (
            <span style={{ color: "#8d949a", fontSize: "0.65rem" }}>
              #{entry.tag}
            </span>
          ) : (
            <span style={{ color: "#8FCEF3", fontSize: "0.65rem" }}>
              ↗ {entry.tag.project}
            </span>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => onJumpToSection(entry.id)}
        style={{
          marginTop: "14px",
          display: "flex",
          alignItems: "center",
          gap: "5px",
          padding: "6px 12px",
          borderRadius: "6px",
          border: "1px solid #41484D",
          background: "rgba(143,206,243,0.08)",
          color: "#8FCEF3",
          fontSize: "0.7rem",
          fontFamily: "inherit",
          cursor: "pointer",
        }}
      >
        jump to section <ChevronRightIcon size={12} />
      </button>
    </div>
  )
}
