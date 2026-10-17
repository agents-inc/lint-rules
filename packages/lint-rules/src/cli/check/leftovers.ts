import { rmSync } from 'node:fs'

// Tracked so that however the run ends, a second signal included, none is left behind.
const pending = new Set<string>()

export function leftoverToRemove(path: string): string {
  pending.add(path)
  return path
}

export function removeLeftover(path: string): void {
  rmSync(path, { force: true, recursive: true })
  pending.delete(path)
}

export function removeLeftovers(): void {
  pending.forEach(removeLeftover)
}
