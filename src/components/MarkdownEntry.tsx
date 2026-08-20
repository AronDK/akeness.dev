import type React from "react"
import { type Entry } from "../data/content"
import { siteConfig } from "../config/site"

interface MarkdownEntryProps {
  entry: Entry
}

function sectionLabel(entry: Entry): string {
  if (entry.type === "blog") return "Blog"
  if (entry.type === "experience") return "Experience"
  return "Projects"
}

function typeBadgeStyle(type: string): React.CSSProperties {
  const isBlog = type === "blog"
  return {
    padding: "2px 9px",
    borderRadius: "4px",
    background: isBlog ? "rgba(143,206,243,0.12)" : "rgba(65,72,77,0.35)",
    color: isBlog ? "#8FCEF3" : "#C0C7CD",
    fontSize: "0.65rem",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    border: `1px solid ${isBlog ? "rgba(143,206,243,0.25)" : "#41484D"}`,
  }
}

export default function MarkdownEntry({ entry }: MarkdownEntryProps) {
  const lines = entry.body.split("\n")

  return (
    <section
      id={entry.id}
      style={{ borderBottom: "1px solid rgba(65,72,77,0.35)" }}
    >
      {/* Path header bar */}
      <div
        style={{
          padding: "7px 16px",
          borderBottom: "1px solid rgba(65,72,77,0.4)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "rgba(15,20,23,0.3)",
        }}
      >
        <span style={{ color: "#41484D", fontSize: "0.67rem" }}>
          <span style={{ color: "#8FCEF3" }}>~</span>/{siteConfig.directoryName}
          /
          <span style={{ color: "#C0C7CD", opacity: 0.7 }}>
            {sectionLabel(entry)}/
          </span>
          <span style={{ color: "#DFE3E7" }}>{entry.filename}</span>
        </span>
        <span
          style={{ marginLeft: "auto", color: "#41484D", fontSize: "0.6rem" }}
        >
          {entry.date}
          {entry.readTime ? ` · ~${entry.readTime}` : ""}
        </span>
      </div>

      <div style={{ padding: "24px 32px" }}>
        {/* Entry meta */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "16px",
            flexWrap: "wrap",
          }}
        >
          <span style={typeBadgeStyle(entry.type)}>{entry.type}</span>
          <span style={{ color: "#41484D", fontSize: "0.7rem" }}>·</span>
          <span style={{ color: "#8d949a", fontSize: "0.7rem" }}>
            {entry.date}
          </span>
          {entry.readTime && (
            <>
              <span style={{ color: "#41484D", fontSize: "0.7rem" }}>·</span>
              <span style={{ color: "#8d949a", fontSize: "0.7rem" }}>
                ~{entry.readTime}
              </span>
            </>
          )}
          {entry.tag != null && <EntryTag tag={entry.tag} />}
        </div>

        {/* Rendered body */}
        <div className="prose-terminal">
          <MarkdownRenderer lines={lines} />
        </div>
      </div>
    </section>
  )
}

function EntryTag({ tag }: { tag: NonNullable<Entry["tag"]> }) {
  if (typeof tag === "string") {
    return <span style={{ color: "#8d949a", fontSize: "0.65rem" }}>#{tag}</span>
  }
  return (
    <a
      href={`#${tag.projectId}`}
      style={{
        color: "#8FCEF3",
        fontSize: "0.65rem",
        textDecoration: "none",
        borderRadius: "4px",
        padding: "1px 6px",
        background: "rgba(143,206,243,0.06)",
        outline: "1px solid rgba(143,206,243,0.2)",
        transition: "background 0.12s",
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLAnchorElement).style.background =
          "rgba(143,206,243,0.14)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLAnchorElement).style.background =
          "rgba(143,206,243,0.06)")
      }
    >
      ↗ {tag.project}
    </a>
  )
}

function MarkdownRenderer({ lines }: { lines: string[] }) {
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i])
        i++
      }
      elements.push(
        <pre key={i}>
          {lang && (
            <div
              style={{
                color: "#41484D",
                fontSize: "0.6rem",
                marginBottom: "6px",
                letterSpacing: "0.06em",
              }}
            >
              {lang}
            </div>
          )}
          <code>{codeLines.join("\n")}</code>
        </pre>,
      )
      i++
      continue
    }

    if (line.startsWith("### ")) {
      elements.push(<h3 key={i}>{renderInline(line.slice(4))}</h3>)
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={i}>{renderInline(line.slice(3))}</h2>)
    } else if (line.startsWith("# ")) {
      elements.push(<h1 key={i}>{renderInline(line.slice(2))}</h1>)
    } else if (line.startsWith("> ")) {
      elements.push(
        <blockquote
          key={i}
          style={{
            borderLeft: "3px solid #41484D",
            paddingLeft: "12px",
            color: "#8d949a",
            fontStyle: "italic",
            margin: "8px 0",
            fontSize: "0.83rem",
          }}
        >
          {renderInline(line.slice(2))}
        </blockquote>,
      )
    } else if (line.startsWith("---")) {
      elements.push(<hr key={i} />)
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = []
      while (
        i < lines.length &&
        (lines[i].startsWith("- ") || lines[i].startsWith("* "))
      ) {
        items.push(lines[i].slice(2))
        i++
      }
      elements.push(
        <ul key={`ul-${i}`}>
          {items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ul>,
      )
      continue
    } else if (line.trim() !== "") {
      elements.push(<p key={i}>{renderInline(line)}</p>)
    }

    i++
  }

  return <>{elements}</>
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
    const codeMatch = remaining.match(/`([^`]+)`/)
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/)

    type Candidate = {
      type: string
      match: RegExpMatchArray
      index: number
    }
    const candidates: Candidate[] = []
    if (boldMatch)
      candidates.push({
        type: "bold",
        match: boldMatch,
        index: boldMatch.index!,
      })
    if (codeMatch)
      candidates.push({
        type: "code",
        match: codeMatch,
        index: codeMatch.index!,
      })
    if (linkMatch)
      candidates.push({
        type: "link",
        match: linkMatch,
        index: linkMatch.index!,
      })

    if (candidates.length === 0) {
      parts.push(<span key={key++}>{remaining}</span>)
      break
    }

    const first = candidates.reduce((a, b) => (a.index <= b.index ? a : b))

    if (first.index > 0) {
      parts.push(<span key={key++}>{remaining.slice(0, first.index)}</span>)
    }

    if (first.type === "bold") {
      parts.push(
        <strong key={key++} style={{ color: "#DFE3E7", fontWeight: 700 }}>
          {first.match[1]}
        </strong>,
      )
    } else if (first.type === "code") {
      parts.push(<code key={key++}>{first.match[1]}</code>)
    } else if (first.type === "link") {
      parts.push(
        <a
          key={key++}
          href={first.match[2]}
          target="_blank"
          rel="noopener noreferrer"
        >
          {first.match[1]}
        </a>,
      )
    }

    remaining = remaining.slice(first.index + first.match[0].length)
  }

  return parts
}
