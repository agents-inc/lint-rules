import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { catalog } from '@workspace/rule-data'
import { listsPackage, ourPackageJsonFile, PACKAGE_JSON, type PackageJsonFile, readPackageJsonFile, THIS_PACKAGE, versionOf } from '../../core/package-json-files.ts'
import { messageOf } from '../caught-errors.ts'
import { type WhereInitRuns, whereInitRuns } from '../check/git-changes.ts'
import { EXIT_CLEAN, EXIT_FINDINGS } from '../exit-codes.ts'
import { foldersUpTo } from '../folders.ts'
import type { Outcome } from '../outcome.ts'
import { textOfLines } from '../printed-lines.ts'
import { INIT_CONFIG_FILE, initConfigText } from './config-text.ts'
import { withDevDependency } from './package-json-edit.ts'
import { packageManagerOf } from './package-manager.ts'
import { configExists, type EntryWritten, GIT_COULD_NOT_RUN_NOTE, initStdoutLines, noPackageJson, nothingWritten, outsideGitNote, typesNodeNote } from './texts.ts'
import { type FileWrite, writeAllOrNone } from './write-all-or-none.ts'

const TYPES_NODE = '@types/node'
const CARET = '^'

/** Never installs. It names the files it writes as `cwd` sees them. */
export function initIn(cwd: string, signal: AbortSignal): Outcome {
  signal.throwIfAborted()
  const packageJsonPath = join(cwd, PACKAGE_JSON)
  if (!existsSync(packageJsonPath)) throw new Error(noPackageJson(cwd))
  const packageJson = readPackageJsonFile(packageJsonPath)
  if (existsSync(join(cwd, INIT_CONFIG_FILE))) return configExistsOutcome(cwd)

  const entry = entryToWrite(packageJson)
  const writes = writesFor(entry, packageJsonPath)
  const printed = printedOnceWritten(cwd, entry)
  writeEveryFileOrSayNoneChanged(writes)
  return printed
}

/** Worked out before writing, so an unreadable package.json refuses the run with nothing written. */
function printedOnceWritten(cwd: string, entry: EntryWritten): Outcome {
  const where = whereInitRuns(cwd)
  const folders = where.kind === 'in a repo' ? foldersUpTo(cwd, where.topLevel) : [cwd]
  return {
    stdout: textOfLines(initStdoutLines(entry, THIS_PACKAGE, INIT_CONFIG_FILE, packageManagerOf(folders))),
    stderr: textOfLines(notesOf(cwd, where, folders)),
    exitCode: EXIT_CLEAN,
  }
}

function configExistsOutcome(cwd: string): Outcome {
  return { stdout: '', stderr: textOfLines([configExists(INIT_CONFIG_FILE, cwd)]), exitCode: EXIT_FINDINGS }
}

/** Keeps a range the package already lists; else this package's version as a caret range. */
function entryToWrite(packageJson: PackageJsonFile): EntryWritten {
  if (dependsOn(packageJson, THIS_PACKAGE)) return { kind: 'kept' }
  return { kind: 'added', range: `${CARET}${versionOf(ourPackageJsonFile())}` }
}

/** package.json first, then the config. */
function writesFor(entry: EntryWritten, packageJsonPath: string): FileWrite[] {
  const packageJsonWrites = entry.kind === 'added' ? [packageJsonWithEntry(packageJsonPath, entry.range)] : []
  return [...packageJsonWrites, { path: INIT_CONFIG_FILE, text: initConfigText(catalog.rulesets) }]
}

function packageJsonWithEntry(packageJsonPath: string, range: string): FileWrite {
  return { path: PACKAGE_JSON, text: withDevDependency(readFileSync(packageJsonPath, 'utf8'), packageJsonPath, THIS_PACKAGE, range) }
}

function writeEveryFileOrSayNoneChanged(writes: readonly FileWrite[]): void {
  try {
    writeAllOrNone(writes)
  } catch (error) {
    throw new Error(nothingWritten(messageOf(error)), { cause: error })
  }
}

/** Outside git, or where git could not run, and @types/node listed in no package.json from the folder up to the git top level. */
function notesOf(cwd: string, where: WhereInitRuns, folders: readonly string[]): string[] {
  return [...gitNotesOf(cwd, where), ...typesNodeNotesOf(folders)]
}

function gitNotesOf(cwd: string, where: WhereInitRuns): string[] {
  switch (where.kind) {
    case 'in a repo':
      return []
    case 'outside a repo':
      return [outsideGitNote(cwd)]
    case 'git could not run':
      return [GIT_COULD_NOT_RUN_NOTE]
  }
}

function typesNodeNotesOf(folders: readonly string[]): string[] {
  return folders.some(listsTypesNode) ? [] : [typesNodeNote(INIT_CONFIG_FILE)]
}

function listsTypesNode(folder: string): boolean {
  const path = join(folder, PACKAGE_JSON)
  if (!existsSync(path)) return false
  return dependsOn(readPackageJsonFile(path), TYPES_NODE)
}

function dependsOn({ dependencies, devDependencies }: PackageJsonFile, packageName: string): boolean {
  return listsPackage(dependencies, packageName) || listsPackage(devDependencies, packageName)
}
