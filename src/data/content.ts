export type EntryType = "project" | "blog" | "experience"

export interface ProjectTag {
  project: string
  projectId: string
}

export type BlogTag = string | ProjectTag

export interface Entry {
  id: string
  type: EntryType
  filename: string
  title: string
  date: string
  readTime?: string
  tag?: BlogTag
  stack?: string[]
  role?: string
  summary: string
  body: string
}

export interface VirtualFile {
  id: string
  type: "root"
  filename: string
  title: string
  date?: string
  readTime?: string
  tag?: BlogTag
  stack?: string[]
  summary: string
}

type ParsedDocument = Entry | VirtualFile

const privateMarkdown = import.meta.glob("../private/nerdblog/**/*.md", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>

const fallbackReadme: VirtualFile = {
  id: "readme",
  type: "root",
  filename: "readme.md",
  title: "Portfolio template",
  summary:
    "This is the root README for the site. Select “jump to section” to return to the top of the document.",
}

const fallbackEntries: Entry[] = [
  {
    id: "interface-library",
    type: "project",
    filename: "interface-library.md",
    title: "Interface library",
    date: "2026-01",
    stack: ["React", "TypeScript", "Design tokens"],
    role: "Sample project",
    summary:
      "A fictional example of a reusable component library with accessible defaults and a documented visual language.",
    body: `# Interface library

**Role:** Sample project
**Stack:** React · TypeScript · Design tokens

## Overview

This generic entry demonstrates the Markdown format used by the template. Replace it with a real project before publishing your own site.

## Notes

- Components share a small, intentional set of tokens.
- Keyboard interaction is considered alongside visual states.
- Documentation is kept close to the implementation.`,
  },
  {
    id: "research-dashboard",
    type: "project",
    filename: "research-dashboard.md",
    title: "Research dashboard",
    date: "2025-11",
    stack: ["TypeScript", "Data visualisation", "Testing"],
    role: "Sample project",
    summary:
      "A fictional dashboard example that turns a recurring research workflow into a clear, reviewable interface.",
    body: `# Research dashboard

**Role:** Sample project
**Stack:** TypeScript · Data visualisation · Testing

## Overview

This placeholder describes an interface for comparing source material, tracking open questions, and sharing a concise status view.

## Design principle

Make the next action obvious, keep raw details available, and avoid hiding uncertainty behind a polished chart.`,
  },
  {
    id: "designing-navigation",
    type: "blog",
    filename: "designing-navigation.md",
    title: "Designing navigation with a useful mental model",
    date: "2026-02-10",
    readTime: "4 min",
    tag: "design",
    summary:
      "A sample article about using a familiar model to make a content-dense interface easier to explore.",
    body: `# Designing navigation with a useful mental model

**Published:** 2026-02-10 · **~4 min read**
**Tags:** \`design\` \`navigation\`

---

Good navigation gives people enough context to decide where to go next. Familiar shapes, clear labels, and reversible actions are more useful than novelty for its own sake.

## A small rule

Show the current location, make neighbouring locations visible, and keep a clear way back.`,
  },
  {
    id: "working-in-public",
    type: "blog",
    filename: "working-in-public.md",
    title: "A small note on publishing work",
    date: "2025-12-02",
    readTime: "3 min",
    tag: "practice",
    summary:
      "A sample note on keeping public examples useful without exposing private context or credentials.",
    body: `# A small note on publishing work

**Published:** 2025-12-02 · **~3 min read**
**Tags:** \`practice\` \`writing\`

---

Public examples work best when they are easy to understand, safe to share, and clear about what has been simplified.

## Before publishing

- Remove credentials and personal contact details.
- Replace private content with representative examples.
- Test a fresh clone before sharing the repository.`,
  },
]

function parseFrontmatter(raw: string) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match)
    return { metadata: {} as Record<string, string>, body: raw.trim() }

  const metadata = match[1]
    .split(/\r?\n/)
    .reduce<Record<string, string>>((current, line) => {
      const separator = line.indexOf(":")
      if (separator === -1) return current

      const key = line.slice(0, separator).trim().toLowerCase()
      const value = line.slice(separator + 1).trim()
      if (key && value) current[key] = value
      return current
    }, {})

  return { metadata, body: match[2].trim() }
}

function titleFromFilename(filename: string) {
  return filename
    .replace(/\.md$/i, "")
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ")
}

function summaryFromBody(body: string) {
  return (
    body
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("#") && !line.startsWith("**"))
      ?.replace(/`/g, "") || "No preview is available for this file yet."
  )
}

function parsePrivateDocument(
  path: string,
  raw: string,
): ParsedDocument | undefined {
  const relativePath = path.split("/nerdblog/")[1]
  if (!relativePath) return undefined

  const { metadata, body } = parseFrontmatter(raw)
  const parts = relativePath.split("/")
  const filename = parts.at(-1)
  if (!filename) return undefined

  const id = metadata.id || filename.replace(/\.md$/i, "")
  const title = metadata.title || titleFromFilename(filename)
  const summary = metadata.summary || summaryFromBody(body)

  if (parts.length === 1 && filename === "readme.md") {
    return {
      id,
      type: "root",
      filename,
      title,
      summary,
      date: metadata.date,
      readTime: metadata.readtime,
      tag: metadata.tag,
      stack: metadata.stack
        ?.split("|")
        .map((item) => item.trim())
        .filter(Boolean),
    }
  }

  const type =
    parts[0] === "project"
      ? "project"
      : parts[0] === "blog"
        ? "blog"
        : parts[0] === "experience"
          ? "experience"
          : undefined
  if (!type) return undefined

  return {
    id,
    type,
    filename,
    title,
    date: metadata.date || "undated",
    readTime: metadata.readtime,
    tag: metadata.tag,
    stack: metadata.stack
      ?.split("|")
      .map((item) => item.trim())
      .filter(Boolean),
    role: metadata.role,
    summary,
    body,
  }
}

const privateDocuments = Object.entries(privateMarkdown)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([path, raw]) => parsePrivateDocument(path, raw))
  .filter((document): document is ParsedDocument => Boolean(document))

export const rootReadme =
  privateDocuments.find(
    (document): document is VirtualFile => document.type === "root",
  ) ?? fallbackReadme

const privateEntries = privateDocuments.filter(
  (document): document is Entry => document.type !== "root",
)

export const entries =
  privateEntries.length > 0 ? privateEntries : fallbackEntries
export const projects = entries.filter((entry) => entry.type === "project")
export const blogs = entries.filter((entry) => entry.type === "blog")
export const experiences = entries.filter(
  (entry) => entry.type === "experience",
)
