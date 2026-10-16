import { rmSync } from 'node:fs'

// The files check writes for itself (its temporary oxlint config and its scratch git folder), so that
// whichever way the run ends, a second signal included, none is left behind.
const pending = new Set<string>()

/** Records a file check is about to write and must remove before it exits. */
export function leftoverToRemove(path: string): string {
  pending.add(path)
  return path
}

/** Removes the file or folder and stops tracking it. */
export function removeLeftover(path: string): void {
  rmSync(path, { force: true, recursive: true })
  pending.delete(path)
}

export function removeLeftovers(): void {
  pending.forEach(removeLeftover)
}
