import type { ProjectFiles } from '../../../src/__tests__/temp-projects.ts'

/** Where Stryker makes its copies of the repo, from the folder it runs in. */
export const STRYKER_TEMP_FOLDER = '.stryker-tmp'
// mkdtemp adds six characters to each.
const COPY_NAME_PREFIX = 'sandbox-'
const BACKUP_NAME_PREFIX = 'backup-'
const MANIFEST = 'package.json'
const MANIFEST_TEXT = '{ "name": "scratch-repo", "private": true }\n'
const NOT_A_FOLDER_TEXT = 'a file, not a copy of the repo\n'

/** A copy of the repo as Stryker names one, from the repo root. */
export function strykerCopy(suffix: string): string {
  return `${STRYKER_TEMP_FOLDER}/${COPY_NAME_PREFIX}${suffix}`
}

/** The folder Stryker's inPlace mode keeps the original files in while it mutates the repo itself, from the repo root. */
export function strykerBackup(suffix: string): string {
  return `${STRYKER_TEMP_FOLDER}/${BACKUP_NAME_PREFIX}${suffix}`
}

/** The repo's own files. */
export function repoFiles(): ProjectFiles {
  return { [MANIFEST]: MANIFEST_TEXT }
}

/** Each copy holds the repo's files, as a copy of the whole repo does. */
export function filesOfCopies(copies: readonly string[]): ProjectFiles {
  return Object.fromEntries(copies.map((copy) => [`${copy}/${MANIFEST}`, MANIFEST_TEXT]))
}

/** The backup holds the repo's original files. */
export function filesOfABackup(backup: string): ProjectFiles {
  return { [`${backup}/${MANIFEST}`]: MANIFEST_TEXT }
}

/** A plain file at the path given, where Stryker would make a copy. */
export function fileNamedLike(copy: string): ProjectFiles {
  return { [copy]: NOT_A_FOLDER_TEXT }
}
