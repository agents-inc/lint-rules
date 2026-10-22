import { sep } from 'node:path'

const FORWARD_SLASH = '/'

/** The path with forward slashes, as a glob or an engine's report gives it. */
export function slashSeparated(path: string): string {
  return path.split(sep).join(FORWARD_SLASH)
}
