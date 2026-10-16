import { dirname, relative } from 'node:path'
import { liesOutside } from '../core/lies-outside.ts'

/** Each folder from `from` up to `top`, both included: `from` alone where it is not inside `top`. */
export function foldersUpTo(from: string, top: string): string[] {
  const parent = dirname(from)
  if (from === top || parent === from || liesOutside(relative(top, from))) return [from]
  return [from, ...foldersUpTo(parent, top)]
}
