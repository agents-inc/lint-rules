import type { Linter } from 'eslint'

export function rulesRunIn(stats: Readonly<Linter.Stats>): string[] {
  return [...new Set(stats.times.passes.flatMap((pass) => Object.keys(pass.rules ?? {})))].toSorted()
}
