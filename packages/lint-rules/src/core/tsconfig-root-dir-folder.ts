import { existsSync, statSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { consumerConfigFiles } from '@workspace/rule-data/consumer-config-files'
import { configErrorIn } from './config-error.ts'

/**
 * The types judge a literal alone, and `tsconfigRootDir` is mostly computed (`import.meta.dirname`, a path call), so
 * it is checked as the config loads to be the absolute path of an existing folder: otherwise it would surface later
 * as an error blaming another file, or as none.
 */
export function refuseATsconfigRootDirThatIsNoFolder(tsconfigRootDir: string): void {
  const problem = whyNoFolderIsAt(tsconfigRootDir)
  if (problem !== null) throw configErrorIn(consumerConfigFiles.lintRules, `tsconfigRootDir: "${tsconfigRootDir}" ${problem}`)
}

/** Null where an absolute path names an existing folder. */
function whyNoFolderIsAt(path: string): string | null {
  if (!isAbsolute(path)) return 'is not an absolute path'
  if (!existsSync(path)) return 'does not exist'
  if (!statSync(path).isDirectory()) return 'is not a folder'
  return null
}
