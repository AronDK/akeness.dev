import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react"
import {
  entries,
  rootReadme,
  type Entry,
  type VirtualFile,
} from "../data/content"
import { siteConfig } from "../config/site"

interface TerminalProps {
  onOpenFile: (id: string) => void
}

type Directory = "root" | "blog" | "project" | "experience"
type TerminalFile = Entry | VirtualFile

interface TranscriptItem {
  id: number
  command?: string
  directory?: Directory
  output?: string
}

interface CommandResult {
  output?: string
  nextDirectory?: Directory
  openFileId?: string
}

interface CompletionCandidate {
  value: string
  label: string
}

interface Completion {
  base: string
  candidates: CompletionCandidate[]
  appendSpace?: boolean
}

const rowHeight = 20
const collapsedRows = 1
const maximumVisibleRows = 5

const directoryLabels: Record<Directory, string> = {
  root: "~",
  blog: "~/blog",
  project: "~/project",
  experience: "~/experience",
}

const directoryCandidates: CompletionCandidate[] = [
  { value: "blog", label: "blog/" },
  { value: "project", label: "project/" },
  { value: "experience", label: "experience/" },
  { value: "..", label: "../" },
  { value: "~", label: "~/" },
]

const commandCandidates: CompletionCandidate[] = [
  { value: "cd", label: "cd" },
  { value: "help", label: "help" },
  { value: "ls", label: "ls" },
]

function filesIn(directory: Directory): TerminalFile[] {
  if (directory === "root") return [rootReadme]
  return entries.filter((entry) => entry.type === directory)
}

function listDirectory(directory: Directory): string {
  if (directory === "root") {
    return [rootReadme.filename, "blog/", "project/", "experience/"].join("  ")
  }

  const files = filesIn(directory).map((entry) => entry.filename)
  return files.join("  ") || "(empty)"
}

function resolveDirectory(target: string): Directory | undefined {
  const normalized = target.replace(/\/+$/, "").toLowerCase()

  if (normalized === "" || normalized === "." || normalized === "~") {
    return "root"
  }

  if (
    normalized === "blog" ||
    normalized === "project" ||
    normalized === "experience"
  ) {
    return normalized
  }

  if (normalized === "projects") return "project"
  return undefined
}

function runCommand(command: string, directory: Directory): CommandResult {
  const parts = command.split(/\s+/)
  const executable = parts[0]
  const args = parts.slice(1)

  if (executable === "help") {
    return args.length > 0
      ? { output: "help: this command does not accept arguments" }
      : {
          output:
            "available commands:\n  ls                 list files and folders\n  cd <directory>     change directory\n  help               show this help\n  <filename>.md      open a Markdown file\n  Tab                autocomplete commands, folders, and files",
        }
  }

  if (executable === "ls") {
    return args.length > 0
      ? { output: "ls: this simulated terminal does not support arguments" }
      : { output: listDirectory(directory) }
  }

  if (executable === "cd") {
    if (args.length === 0) return { output: "cd: missing directory" }
    if (args.length > 1) return { output: "cd: too many arguments" }

    const target = args[0]
    if (target === "..") {
      return { nextDirectory: "root" }
    }

    const nextDirectory = resolveDirectory(target)
    return nextDirectory
      ? { nextDirectory }
      : { output: `cd: no such directory: ${target}` }
  }

  if (/\.md$/i.test(executable) && args.length === 0) {
    const file = filesIn(directory).find(
      (entry) => entry.filename.toLowerCase() === executable.toLowerCase(),
    )

    return file
      ? { output: `opened ${file.filename}`, openFileId: file.id }
      : { output: `file not found: ${executable}` }
  }

  return {
    output: 'command not found: type "help" to see avaliable commands',
  }
}

function commonPrefix(values: string[]): string {
  if (values.length === 0) return ""

  let prefix = values[0]
  for (const value of values.slice(1)) {
    let index = 0
    while (
      index < prefix.length &&
      index < value.length &&
      prefix[index] === value[index]
    ) {
      index += 1
    }
    prefix = prefix.slice(0, index)
  }

  return prefix
}

function getCompletion(
  input: string,
  directory: Directory,
): Completion | undefined {
  const cdMatch = input.match(/^(\s*cd\s+)(\S*)$/i)
  if (cdMatch) {
    const fragment = cdMatch[2].toLowerCase()
    return {
      base: cdMatch[1],
      candidates: directoryCandidates.filter((candidate) =>
        candidate.value.toLowerCase().startsWith(fragment),
      ),
    }
  }

  if (/\s/.test(input)) return undefined

  const fragment = input.toLowerCase()
  const fileCandidates = filesIn(directory).map((entry) => ({
    value: entry.filename,
    label: entry.filename,
  }))
  const candidates = [...commandCandidates, ...fileCandidates].filter(
    (candidate) => candidate.value.toLowerCase().startsWith(fragment),
  )

  return {
    base: "",
    candidates,
    appendSpace: candidates.length === 1 && candidates[0].value === "cd",
  }
}

function Prompt({ directory }: { directory: Directory }) {
  return (
    <span
      aria-hidden="true"
      style={{ whiteSpace: "nowrap", userSelect: "none" }}
    >
      <span style={{ color: "#8FCEF3" }}>root</span>
      <span style={{ color: "#41484D" }}>@</span>
      <span style={{ color: "#C0C7CD" }}>{siteConfig.terminalHost}</span>
      <span style={{ color: "#8FCEF3" }}>:{directoryLabels[directory]}</span>
      <span style={{ color: "#41484D" }}> $</span>
    </span>
  )
}

export default function Terminal({ onOpenFile }: TerminalProps) {
  const [directory, setDirectory] = useState<Directory>("root")
  const [input, setInput] = useState("")
  const [transcript, setTranscript] = useState<TranscriptItem[]>([])
  const [lastTabKey, setLastTabKey] = useState<string | null>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const nextTranscriptId = useRef(0)

  const transcriptRowCount = transcript.reduce((total, item) => {
    const commandRows = item.command ? 1 : 0
    const outputRows = item.output ? item.output.split("\n").length : 0
    return total + commandRows + outputRows
  }, 0)
  const visibleRows = Math.min(
    maximumVisibleRows,
    Math.max(
      collapsedRows,
      collapsedRows + transcriptRowCount,
      input.trim() ? collapsedRows + 1 : collapsedRows,
    ),
  )

  useEffect(() => {
    const transcriptElement = transcriptRef.current
    if (transcriptElement) {
      transcriptElement.scrollTop = transcriptElement.scrollHeight
    }
  }, [transcript, visibleRows])

  const appendTranscript = (item: Omit<TranscriptItem, "id">) => {
    nextTranscriptId.current += 1
    setTranscript((current) => [
      ...current,
      { ...item, id: nextTranscriptId.current },
    ])
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const command = input.trim()
    if (command === "") return

    const result = runCommand(command, directory)
    appendTranscript({ command, directory, output: result.output })
    setInput("")
    setLastTabKey(null)
    if (result.nextDirectory) {
      setDirectory(result.nextDirectory)
    }

    if (result.openFileId) {
      onOpenFile(result.openFileId)
    }
  }

  const handleTab = () => {
    const completion = getCompletion(input, directory)

    if (!completion || completion.candidates.length === 0) {
      setLastTabKey(null)
      return
    }

    const values = completion.candidates.map((candidate) => candidate.value)
    const completedValue =
      values.length === 1 ? values[0] : commonPrefix(values)
    const nextInput = `${completion.base}${completedValue}${
      completion.appendSpace ? " " : ""
    }`
    const key = `${nextInput}\u0000${values.join("\u0000")}`

    if (values.length > 1 && lastTabKey === key && input === nextInput) {
      appendTranscript({
        output: completion.candidates
          .map((candidate) => candidate.label)
          .join("  "),
      })
      setLastTabKey(null)
      return
    }

    setInput(nextInput)
    setLastTabKey(values.length > 1 ? key : null)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Tab") {
      event.preventDefault()
      handleTab()
    }
  }

  return (
    <section
      aria-label="Portfolio terminal"
      onClick={() => inputRef.current?.focus()}
      style={{
        color: "#C0C7CD",
        display: "flex",
        flexDirection: "column",
        fontFamily: "inherit",
        fontSize: "0.7rem",
        height: rowHeight * visibleRows,
        lineHeight: `${rowHeight}px`,
        overflow: "hidden",
        transition: "height 180ms ease",
      }}
    >
      <div
        ref={transcriptRef}
        aria-live="polite"
        aria-relevant="additions text"
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          overflowX: "hidden",
          overflowY: "auto",
          paddingRight: "4px",
          scrollbarColor: "#41484D transparent",
          scrollbarWidth: "thin",
        }}
      >
        {transcript.map((item) => (
          <div key={item.id}>
            {item.command && (
              <div style={{ display: "flex", gap: "6px", minWidth: 0 }}>
                <Prompt directory={item.directory ?? directory} />
                <span
                  style={{
                    color: "#DFE3E7",
                    minWidth: 0,
                    overflowWrap: "anywhere",
                  }}
                >
                  {item.command}
                </span>
              </div>
            )}
            {item.output && (
              <div
                style={{
                  color: item.command ? "#8d949a" : "#C0C7CD",
                  overflowWrap: "anywhere",
                  whiteSpace: "pre-wrap",
                }}
              >
                {item.output}
              </div>
            )}
          </div>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          alignItems: "center",
          display: "flex",
          flex: `0 0 ${rowHeight}px`,
          gap: "6px",
          minWidth: 0,
        }}
      >
        <Prompt directory={directory} />
        <input
          ref={inputRef}
          aria-label={`Terminal command. Current directory ${directoryLabels[directory]}. Type help for available commands.`}
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          onChange={(event) => {
            setInput(event.target.value)
            setLastTabKey(null)
          }}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          type="text"
          value={input}
          style={{
            background: "transparent",
            border: 0,
            color: "#DFE3E7",
            flex: "1 1 auto",
            font: "inherit",
            lineHeight: "inherit",
            minWidth: 0,
            outline: "none",
            padding: 0,
          }}
        />
      </form>
    </section>
  )
}
