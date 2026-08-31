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
  sourcePath?: string
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
  body: string
  sourcePath: string
}

type ParsedDocument = Entry | VirtualFile

const privateMarkdown = import.meta.glob("../private/nerdblog/**/*.md", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>

const privateMarkdownImages = import.meta.glob(
  "../private/nerdblog/**/*.{avif,gif,jpeg,jpg,png,svg,webp}",
  {
    eager: true,
    import: "default",
    query: "?url",
  },
) as Record<string, string>

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

function normaliseRelativePath(path: string) {
  const segments: string[] = []

  for (const segment of path.split("/")) {
    if (!segment || segment === ".") continue

    if (segment === "..") {
      const previous = segments.at(-1)
      if (previous && previous !== "..") {
        segments.pop()
      } else {
        segments.push(segment)
      }
      continue
    }

    segments.push(segment)
  }

  return segments.join("/")
}

/**
 * Resolves an image path written relative to a private Markdown document to
 * Vite's emitted asset URL. Absolute and external URLs pass through unchanged.
 */
export function resolveMarkdownImage(
  entry: Pick<Entry, "sourcePath">,
  source: string,
) {
  if (
    !entry.sourcePath ||
    !source ||
    source.startsWith("/") ||
    source.startsWith("#") ||
    source.startsWith("//") ||
    /^[a-z][a-z\d+.-]*:/i.test(source)
  ) {
    return source
  }

  const match = source.match(/^([^?#]*)(.*)$/)
  const imagePath = match?.[1] ?? source
  const suffix = match?.[2] ?? ""
  let decodedImagePath = imagePath

  try {
    decodedImagePath = decodeURIComponent(imagePath)
  } catch {
    // Leave malformed percent escapes untouched so unresolved URLs still
    // degrade to the browser's normal handling below.
  }

  const documentDirectory = entry.sourcePath.slice(
    0,
    entry.sourcePath.lastIndexOf("/") + 1,
  )
  const resolvedPath = normaliseRelativePath(
    `${documentDirectory}${decodedImagePath}`,
  )

  if (!resolvedPath.startsWith("../private/nerdblog/")) return source

  const emittedUrl = privateMarkdownImages[resolvedPath]
  return emittedUrl ? `${emittedUrl}${suffix}` : source
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
      body,
      sourcePath: path,
    }
  }

  const type =
    parts[0] === "Projects"
      ? "project"
      : parts[0] === "Blog"
        ? "blog"
        : parts[0] === "Experiences"
          ? "experience"
          : undefined
  if (!type) return undefined

  return {
    id: `${type}-${id}`,
    type,
    filename,
    title,
    date: metadata.date || metadata["last reviewed"] || "undated",
    readTime: metadata.readtime,
    tag: metadata.tag,
    stack: metadata.stack
      ?.split("|")
      .map((item) => item.trim())
      .filter(Boolean),
    role: metadata.role,
    summary,
    body,
    sourcePath: path,
  }
}

const privateDocuments = Object.entries(privateMarkdown)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([path, raw]) => parsePrivateDocument(path, raw))
  .filter((document): document is ParsedDocument => Boolean(document))

const rootReadmeDocument = privateDocuments.find(
  (document): document is VirtualFile => document.type === "root",
)

if (!rootReadmeDocument) {
  throw new Error(
    "Missing src/private/nerdblog/readme.md. Nerdblog content is required.",
  )
}

export const rootReadme = rootReadmeDocument

const contentEntries = privateDocuments.filter(
  (document): document is Entry => document.type !== "root",
)

const monthIndex: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
}

function experienceDateRange(date: string) {
  const dates = [...date.matchAll(/\b([A-Za-z]{3})[A-Za-z]*\s+(\d{4})\b/g)].map(
    (match) => Date.UTC(Number(match[2]), monthIndex[match[1].toLowerCase()]),
  )

  return {
    start: dates[0] ?? Number.NEGATIVE_INFINITY,
    end: dates[1] ??
      (/present/i.test(date) ? Number.POSITIVE_INFINITY : dates[0]) ??
      Number.NEGATIVE_INFINITY,
  }
}

function compareExperiencesNewestFirst(left: Entry, right: Entry) {
  const leftRange = experienceDateRange(left.date)
  const rightRange = experienceDateRange(right.date)
  return rightRange.start - leftRange.start || rightRange.end - leftRange.end
}

export const projects = contentEntries.filter(
  (entry) => entry.type === "project",
)
export const blogs = contentEntries.filter((entry) => entry.type === "blog")
export const experiences = contentEntries
  .filter((entry) => entry.type === "experience")
  .sort(compareExperiencesNewestFirst)
export const entries = [...blogs, ...projects, ...experiences]
