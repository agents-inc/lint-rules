import type { RuleRoute } from '../catalog.ts'

// ESLint and oxlint read a glob led by this mark as taking back what an earlier glob matched.
const NEGATION_MARK = '!'

/**
 * `id files: glob` or `id ignores: glob` for each glob a shipped rule's files or ignores lead with
 * the negation mark, in route order. A `[!…]` class inside a glob negates one character, not the
 * glob, so it is not one.
 */
export function negatedShippedGlobsIn(routes: Iterable<RuleRoute>): string[] {
  return [...routes].flatMap(({ id, shipped }) => {
    if (shipped === null) return []
    return [
      ...negationsAmong(shipped.files).map((glob) => `${id} files: ${glob}`),
      ...negationsAmong(shipped.ignores).map((glob) => `${id} ignores: ${glob}`),
    ]
  })
}

function negationsAmong(globs: readonly string[] | null): string[] {
  if (globs === null) return []
  return globs.filter((glob) => glob.startsWith(NEGATION_MARK))
}
