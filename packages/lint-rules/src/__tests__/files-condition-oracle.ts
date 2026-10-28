import { matchesGlob } from 'node:path'
import type { FilesCondition, FilesTerm } from '../core/file-conditions.ts'

const NEGATION = '!'
// ESLint drops a leading `./` from a glob before it matches one.
const LEADING_DOT_SLASH = './'

/**
* Read file by file, with no algebra: a file meets a term where it matches every glob of `all` (a negated one by
* missing it) and none of `none`, and the condition where it meets one of its terms.
*/
export function filesTheConditionMatches(condition: FilesCondition, files: readonly string[]): string[] {
  return files.filter((file) => condition.some((term) => meetsTerm(file, term)))
}

function meetsTerm(file: string, { all, none }: FilesTerm): boolean {
  return all.every((glob) => (glob.startsWith(NEGATION) ? !doesMatch(file, glob.slice(NEGATION.length)) : doesMatch(file, glob))) && none.every((glob) => !doesMatch(file, glob))
}

function doesMatch(file: string, glob: string): boolean {
  return matchesGlob(file, glob.startsWith(LEADING_DOT_SLASH) ? glob.slice(LEADING_DOT_SLASH.length) : glob)
}
