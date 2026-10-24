import type { MutateEntry } from '../../kept-lines.ts'

export function wholeFile(file: string): MutateEntry {
  return { file }
}

export function linesOf(file: string, start: number, end: number): MutateEntry {
  return { file, lines: { start, end } }
}

export function filesOnDisk(files: readonly string[]): (file: string) => boolean {
  return (file) => files.includes(file)
}
