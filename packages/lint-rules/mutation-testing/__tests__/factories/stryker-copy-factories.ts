import type { ProjectFiles } from '../../../src/__tests__/temp-projects.ts'

export const STRYKER_TEMP_FOLDER = '.stryker-tmp'
// mkdtemp adds six characters to each.
const COPY_NAME_PREFIX = 'sandbox-'
const BACKUP_NAME_PREFIX = 'backup-'
const MANIFEST = 'package.json'
const MANIFEST_TEXT = '{ "name": "scratch-repo", "private": true }\n'
const NOT_A_FOLDER_TEXT = 'a file, not a copy of the repo\n'

export function strykerCopy(suffix: string): string {
  return `${STRYKER_TEMP_FOLDER}/${COPY_NAME_PREFIX}${suffix}`
}

/** The folder Stryker's inPlace mode keeps the original files in while it mutates the repo itself, from the repo root. */
export function strykerBackup(suffix: string): string {
  return `${STRYKER_TEMP_FOLDER}/${BACKUP_NAME_PREFIX}${suffix}`
}

export function repoFiles(): ProjectFiles {
  return { [MANIFEST]: MANIFEST_TEXT }
}

export function filesOfCopies(copies: readonly string[]): ProjectFiles {
  return Object.fromEntries(copies.map((copy) => [`${copy}/${MANIFEST}`, MANIFEST_TEXT]))
}

export function filesOfABackup(backup: string): ProjectFiles {
  return { [`${backup}/${MANIFEST}`]: MANIFEST_TEXT }
}

export function fileNamedLike(copy: string): ProjectFiles {
  return { [copy]: NOT_A_FOLDER_TEXT }
}
