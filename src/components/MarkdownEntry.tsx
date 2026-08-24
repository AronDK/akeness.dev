import {
  Children,
  isValidElement,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
} from "react"
import ReactMarkdown from "react-markdown"
import rehypeHighlight from "rehype-highlight"
import remarkGfm from "remark-gfm"
import { resolveMarkdownImage, type Entry } from "../data/content"
import { siteConfig } from "../config/site"

interface MarkdownEntryProps {
  entry: Entry
}

function sectionLabel(entry: Entry): string {
  if (entry.type === "blog") return "Blog"
  if (entry.type === "experience") return "Experience"
  return "Projects"
}

function typeBadgeStyle(type: string): CSSProperties {
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
          <MarkdownRenderer entry={entry} />
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

type MarkdownAnchorProps = ComponentPropsWithoutRef<"a"> & { node?: unknown }
type MarkdownImageProps = ComponentPropsWithoutRef<"img"> & { node?: unknown }
type MarkdownPreProps = ComponentPropsWithoutRef<"pre"> & { node?: unknown }

export function MarkdownRenderer({
  entry,
}: {
  entry: Pick<Entry, "body" | "sourcePath">
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeHighlight, { detect: true }]]}
      components={{
        a: MarkdownLink,
        img: (props) => <MarkdownImage entry={entry} {...props} />,
        pre: MarkdownPre,
      }}
    >
      {entry.body}
    </ReactMarkdown>
  )
}

function MarkdownLink({
  node: _node,
  href,
  children,
  ...props
}: MarkdownAnchorProps) {
  const isExternal = /^https?:\/\//i.test(href ?? "")

  return (
    <a
      {...props}
      href={href}
      {...(isExternal
        ? { target: "_blank", rel: "noopener noreferrer" }
        : undefined)}
    >
      {children}
    </a>
  )
}

function MarkdownImage({
  entry,
  node: _node,
  src,
  alt,
  ...props
}: MarkdownImageProps & { entry: Pick<Entry, "sourcePath"> }) {
  const imageSource =
    typeof src === "string" ? resolveMarkdownImage(entry, src) : undefined

  if (!imageSource) return null

  return (
    <img
      {...props}
      src={imageSource}
      alt={alt ?? ""}
      loading="lazy"
      decoding="async"
    />
  )
}

function MarkdownPre({ children, node: _node, ...props }: MarkdownPreProps) {
  const language = languageFromCode(children)

  return (
    <pre {...props}>
      {language && <span className="code-language">{language}</span>}
      {children}
    </pre>
  )
}

function languageFromCode(children: ReactNode) {
  const code = Children.toArray(children).find(isValidElement)
  const className = isValidElement<{ className?: string }>(code)
    ? code.props.className
    : undefined

  return className?.match(/(?:^|\s)language-([^\s]+)/)?.[1]
}
