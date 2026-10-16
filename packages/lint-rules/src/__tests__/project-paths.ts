import { relative, sep } from 'node:path'

// Imported by project-service-verdicts-process.ts too, which Node runs outside vitest: it imports nothing of the tests'.

const GLOB_SEPARATOR = '/'

/** The file's path in the project, with forward slashes, as a glob or an engine's report gives it. */
export function projectPathOf(filePath: string, projectDir: string): string {
  return relative(projectDir, filePath).split(sep).join(GLOB_SEPARATOR)
}
