import { copyFile, mkdir, stat } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const sourceDirectory = dirname(fileURLToPath(import.meta.url))
const projectDirectory = resolve(sourceDirectory, "..")
const source = resolve(projectDirectory, "private/resume/resume.pdf")
const destination = resolve(projectDirectory, "dist/resume.pdf")

try {
  await stat(source)
  await mkdir(dirname(destination), { recursive: true })
  await copyFile(source, destination)
} catch (error) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT"
  ) {
    // The public template remains buildable when private source is absent.
  } else {
    throw error
  }
}
