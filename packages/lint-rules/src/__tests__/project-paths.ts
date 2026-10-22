import { relative } from 'node:path'
import { slashSeparated } from '../core/slash-separated.ts'

// Imported by project-service-verdicts-process.ts too, which Node runs outside vitest: it imports nothing of the tests'.

/** The file's path in the project, with forward slashes, as a glob or an engine's report gives it. */
export function projectPathOf(filePath: string, projectDir: string): string {
  return slashSeparated(relative(projectDir, filePath))
}
