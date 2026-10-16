import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// Imported by merge-timing-process.ts and record-resolved-modules.ts, which Node runs outside vitest:
// it imports nothing of the tests'.

/** The URL of a built entry of this package, for `import()`. */
export function builtEntry(dist: string, file: string): string {
  return pathToFileURL(join(dist, file)).href
}
