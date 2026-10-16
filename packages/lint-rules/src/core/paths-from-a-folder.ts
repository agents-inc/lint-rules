import { dirname } from 'node:path'

/** An absolute directory and each one above it, up to `top` where that lies at or above it, else up to the filesystem's root. */
export function directoriesUpFrom(directory: string, top?: string): string[] {
  const parent = dirname(directory)
  if (directory === top || parent === directory) return [directory]
  return [directory, ...directoriesUpFrom(parent, top)]
}
