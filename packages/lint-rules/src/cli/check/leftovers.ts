import { rmSync } from 'node:fs'

// Tracked so that however the run ends, a second signal included, none is left behind. A second signal
// ends the process at once (main.ts), so the paths must be where its listener reaches them: here.
const pending = new Set<string>()

export function leftoverToRemove(path: string): string {
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- the second signal's listener removes what this set holds, and it reaches no value the run returned
  pending.add(path)
  return path
}

// eslint-disable-next-line functional/no-return-void -- it removes the path on disk, where a later run would find it: a value it returned would remove nothing
export function removeLeftover(path: string): void {
  rmSync(path, { force: true, recursive: true })
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- as on add
  pending.delete(path)
}

// eslint-disable-next-line functional/no-return-void -- as removeLeftover
export function removeLeftovers(): void {
  for (const path of pending) removeLeftover(path)
}
