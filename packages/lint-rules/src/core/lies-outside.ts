import { isAbsolute, sep } from 'node:path'

const PARENT_DIRECTORY = '..'

/** A path relative to a folder leads up out of it, or onto another drive. A name that only starts with two dots, as `..x.ts` does, is inside. */
export function liesOutside(relativePath: string): boolean {
  return relativePath === PARENT_DIRECTORY || relativePath.startsWith(`${PARENT_DIRECTORY}${sep}`) || isAbsolute(relativePath)
}
