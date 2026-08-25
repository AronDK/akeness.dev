import {
  useEffect,
  useState,
  type AnimationEvent,
} from "react"
import Terminal from "./Terminal"
import { sidePanelSize } from "./sidePanel"

interface TerminalNavigatorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenFile: (id: string) => void
}

const EXIT_ANIMATION_FALLBACK_MS = 320

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

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT")
  )
}

export default function TerminalNavigator({
  open,
  onOpenChange,
  onOpenFile,
}: TerminalNavigatorProps) {
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
      if (event.key === "Escape" && open) {
        onOpenChange(false)
        return
      }

      if (
        event.key !== "]" ||
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

  const close = () => onOpenChange(false)

  const handleAnimationEnd = (event: AnimationEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || open || !isClosing) return

    setIsClosing(false)
    setIsMounted(false)
  }

  return (
    <>
      <button
        type="button"
        className="terminal-tab"
        title="Open terminal (])"
        onClick={() => onOpenChange(true)}
        style={{
          position: "fixed",
          left: 0,
          top: "calc(50% + 58px)",
          transform: "translateY(-50%)",
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "12px 7px 12px 5px",
          background: "rgba(15, 20, 23, 0.92)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderTop: "1px solid rgba(65,72,77,0.8)",
          borderRight: "1px solid rgba(65,72,77,0.8)",
          borderBottom: "1px solid rgba(65,72,77,0.8)",
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
        <ChevronRightIcon />
        <span style={{ transform: "rotate(180deg)" }}>terminal</span>
      </button>

      {isMounted && (
        <div
          aria-hidden="true"
          className="terminal-click-away"
          onClick={close}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "transparent",
          }}
        />
      )}

      <section
        role="dialog"
        aria-label="Portfolio terminal"
        aria-modal="false"
        hidden={!isMounted}
        className={`terminal-island${isClosing ? " terminal-island-closing" : ""}`}
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
          transformOrigin: "left calc(50% + 58px)",
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
            terminal — interactive shell
          </span>
          <button
            type="button"
            aria-label="Close terminal"
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

        <div style={{ flex: "1 1 auto", minHeight: 0, padding: "14px 16px" }}>
          <Terminal
            onOpenFile={onOpenFile}
            autoFocus={open && isMounted && !isClosing}
          />
        </div>
      </section>
    </>
  )
}
