import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { catalog } from '@workspace/rule-data'
import { listsPackage, ourPackageJsonFile, PACKAGE_JSON, type PackageJsonFile, readPackageJsonFile, THIS_PACKAGE, versionOf } from '../../core/package-json-files.ts'
import { messageOf } from '../caught-errors.ts'
import { gitTopLevelUnlessGitIsMissing } from '../check/git-changes.ts'
import { EXIT_CLEAN, EXIT_FINDINGS } from '../exit-codes.ts'
import { foldersUpTo } from '../folders.ts'
import type { Outcome } from '../outcome.ts'
import { textOfLines } from '../printed-lines.ts'
import { INIT_CONFIG_FILE, initConfigText } from './config-text.ts'
import { withDevDependency } from './package-json-edit.ts'
import { packageManagerOf } from './package-manager.ts'
import { configExists, type EntryWritten, initStdoutLines, noPackageJson, nothingWritten, outsideGitNote, typesNodeNote } from './texts.ts'
import { type FileWrite, writeAllOrNone } from './write-all-or-none.ts'

const TYPES_NODE = '@types/node'
const CARET = '^'

/**
 * `agents-inc-lint init` (spec-cli.md "I: init"): writes agents-inc.lint.mts and adds this package
 * to devDependencies in the package of the folder, and changes nothing else. It never installs.
 * `cwd` is the folder it runs in: it names the files it writes as that folder sees them.
 */
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

/**
 * What init prints once it has written (spec-cli.md "I: init", steps 4 and 6), worked out before
 * it writes: a package.json it cannot read on the way up refuses the run with nothing written.
 */
function printedOnceWritten(cwd: string, entry: EntryWritten): Outcome {
  const gitTopLevel = gitTopLevelUnlessGitIsMissing(cwd)
  const folders = gitTopLevel === null ? [cwd] : foldersUpTo(cwd, gitTopLevel)
  return {
    stdout: textOfLines(initStdoutLines(entry, THIS_PACKAGE, INIT_CONFIG_FILE, packageManagerOf(folders))),
    stderr: textOfLines(notesOf(cwd, gitTopLevel, folders)),
    exitCode: EXIT_CLEAN,
  }
}

/** q-i1: exit 1, and nothing changed. */
function configExistsOutcome(cwd: string): Outcome {
  return { stdout: '', stderr: textOfLines([configExists(INIT_CONFIG_FILE, cwd)]), exitCode: EXIT_FINDINGS }
}

/** Keeps an entry the package already lists, at its range (q-i4); else adds this package's version as a caret range. */
function entryToWrite(packageJson: PackageJsonFile): EntryWritten {
  if (dependsOn(packageJson, THIS_PACKAGE)) return { kind: 'kept' }
  return { kind: 'added', range: `${CARET}${versionOf(ourPackageJsonFile())}` }
}

/** package.json where init adds the entry, then the config. */
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

/** Outside git (q-i8), and @types/node listed in no package.json from the folder up to the git top level (q-i9). */
function notesOf(cwd: string, gitTopLevel: string | null, folders: readonly string[]): string[] {
  return [
    ...(gitTopLevel === null ? [outsideGitNote(cwd)] : []),
    ...(folders.some(listsTypesNode) ? [] : [typesNodeNote(INIT_CONFIG_FILE)]),
  ]
}

/** Whether the folder's package.json, where it has one, lists @types/node as a dependency (q-i9). */
function listsTypesNode(folder: string): boolean {
  const path = join(folder, PACKAGE_JSON)
  if (!existsSync(path)) return false
  return dependsOn(readPackageJsonFile(path), TYPES_NODE)
}

/** Whether the package.json lists the package in dependencies or devDependencies. */
function dependsOn({ dependencies, devDependencies }: PackageJsonFile, packageName: string): boolean {
  return listsPackage(dependencies, packageName) || listsPackage(devDependencies, packageName)
}
