import { extname, join, relative, resolve } from 'node:path'
import { catalog } from '@workspace/rule-data'
import { foundOr } from '@workspace/rule-data/collections'
import type { Linter } from 'eslint'
import { buildAgentConfigs } from '../../agent-configs.ts'
import { agentSettingsOf } from '../../agent-settings.ts'
import { configsReadFromTheGitTopLevel, type EngineConfigs, type EngineConfigsToRun } from '../../core/configs-read-from-the-git-top-level.ts'
import type { EslintPart } from '../../core/editor-parts.ts'
import { JS_AND_TS_EXTENSIONS } from '../../core/eslint-file-types.ts'
import { slashSeparated } from '../../core/slash-separated.ts'
import { EXIT_CLEAN } from '../exit-codes.ts'
import type { Outcome, StdoutIfStopped } from '../outcome.ts'
import { textOfLines } from '../printed-lines.ts'
import type { ChangedLines } from './changed-lines.ts'
import { componentFileBlocksOf, isAComponentExtension } from './component-files.ts'
import { eslintPartExportedBy, type FoundConfig, nearestConfig, refuseAnotherCopy } from './config-lookup.ts'
import { type EslintEngine, eslintEngineBuiltOnFirstUse, eslintEngineByFolder, eslintEngineFor } from './eslint-run.ts'
import { type FileReports, findingsIn } from './findings.ts'
import { applyFixes, type CheckedFile, type FixStepEngines, type FixStepResult, oxlintFixer, type RewrittenFiles } from './fix-step.ts'
import { type Snapshots, snapshotsOf, textOfFileAt } from './fix-writes.ts'
import { type ChangedFile, changedFilesIn, changedLinesOf, type GitRepo, gitRepoAt, gitTopLevelOf } from './git-changes.ts'
import { removeLeftovers } from './leftovers.ts'
import { firstNotCheckedOf, goneWhileCheckRan, type NotChecked, notCheckedEntriesOf } from './not-checked.ts'
import type { OxlintDiagnostic, OxlintReport } from './oxlint-output.ts'
import { fixRunConfigOf, lintRunConfigOf, oxlintLintRun, type TempOxlintConfig, tempOxlintConfigIn } from './oxlint-run.ts'
import { autofixedStdout, type CheckFinding, type CheckReport, checkReport } from './report.ts'
import { NOTHING_TO_CHECK, notInGit } from './texts.ts'
import { WITHHELD_FIXES } from './withheld-fixes.ts'

/** `file` is printed from the config's folder, with forward slashes (`..` first outside it). */
type FileInFolder = { readonly change: ChangedFile; readonly path: string; readonly file: string; readonly readByEslint: boolean }

type ScopedFile = FileInFolder & CheckedFile

type CheckRun = {
  readonly repo: GitRepo
  readonly configs: EngineConfigsToRun
  readonly eslint: EslintEngine
  readonly files: readonly ScopedFile[]
  readonly signal: AbortSignal
}

type LintResults = { readonly fixes: FixStepResult; readonly oxlintReport: OxlintReport }

/** A file's reports, or why there are none: it was gone by then. */
type ReportsOnAFile = { readonly reports: FileReports } | { readonly notChecked: NotChecked }

type AutofixedFiles = RewrittenFiles & { readonly named: () => string[] }

const EXTENSION_DOT = '.'

/**
 * Fixes, then lints, the changed JS, TS and component lines of the whole git repo with the nearest
 * agents-inc.lint.mts: oxlint run from the git top level, ESLint from the config's folder for the files
 * in it and from the git top level for the rest. Throws where it could not run, with `ifStopped` naming
 * the files it fixed by then.
 */
export async function checkIn(cwd: string, signal: AbortSignal, ifStopped: StdoutIfStopped): Promise<Outcome> {
  const gitTopLevel = gitTopLevelOf(cwd)
  if (gitTopLevel === null) throw new Error(notInGit(cwd))
  const config = nearestConfig(cwd, gitTopLevel)
  refuseAnotherCopy(config)
  const eslintPart = await eslintPartExportedBy(config)
  try {
    return await checkChanges(gitRepoAt(gitTopLevel), config, eslintPart, { signal, ifStopped })
  } finally {
    removeLeftovers()
  }
}

async function checkChanges(
  repo: GitRepo,
  config: FoundConfig,
  eslintPart: EslintPart,
  { signal, ifStopped }: { readonly signal: AbortSignal; readonly ifStopped: StdoutIfStopped },
): Promise<Outcome> {
  const changed = changedFilesIn(repo).flatMap((change) => lintedFileOf(repo, config, change))
  if (changed.length === 0) return nothingToCheck()

  const built = agentBuildOf(eslintPart)
  const configs = configsReadFromTheGitTopLevel(built, folderFromTheGitTopLevel(repo, config))
  const eslint = eslintEngineOf(repo, config, built, configs)
  // A file is read once git names it: one gone later is the fix step's, and the report's, to list.
  const beforeFixes = snapshotsOf(pathsOf(changed))
  const notIgnored = await filesNotIgnored(filesOnDiskWhenRead(changed, beforeFixes), eslint.isIgnored)
  const files = withChangedLines(repo, notIgnored)
  if (files.length === 0) return nothingToCheck()

  const run: CheckRun = { repo, configs, eslint, files, signal }
  const { stdout, exitCode } = await fixedThenReported(run, beforeFixes, autofixedFilesOf(files, ifStopped))
  return { stdout, stderr: '', exitCode }
}

async function fixedThenReported(run: CheckRun, beforeFixes: Snapshots, autofixed: AutofixedFiles): Promise<CheckReport> {
  const { repo, configs, files, signal } = run
  const oxlintConfig = tempOxlintConfigIn(repo.topLevel)
  const fixes = await applyFixes(files, beforeFixes, fixEnginesOf(run, oxlintConfig), { signal, rewritten: autofixed })
  const oxlintLint = await oxlintLintRun(oxlintConfig, lintRunConfigOf(configs.oxlint), pathsOf(files), signal)
  const reported = await Promise.all(files.map((file) => reportsOn(file, { fixes, oxlintReport: oxlintLint.report }, run)))
  return checkReport({
    findings: findingsOfTheFilesRead(reported),
    changedFileCount: files.length,
    autofixedFiles: autofixed.named(),
    notChecked: notCheckedEntriesOf(files, [...fixes.notChecked, ...filesGoneByTheReport(reported), ...oxlintLint.notChecked]),
  })
}

/** A file ESLint did not lint has none of its messages. */
async function reportsOn(scoped: ScopedFile, { fixes, oxlintReport }: LintResults, run: CheckRun): Promise<ReportsOnAFile> {
  const { path, file } = scoped
  const text = textOfFileAt(path)
  if (text === null) return { notChecked: goneWhileCheckRan(path) }
  const changed = changedLinesAfterTheFixes(scoped, fixes, run)
  const suppressionsAllowed = await run.eslint.allowsSuppressionsIn(path)
  return {
    reports: {
      file,
      text,
      changed,
      suppressionsAllowed,
      eslintMessages: eslintMessagesOn(fixes, scoped),
      oxlintDiagnostics: oxlintDiagnosticsOn(oxlintReport, run.repo.topLevel, path),
    },
  }
}

/** Read again where the fixes changed the file's text. */
function changedLinesAfterTheFixes({ path, changed }: ScopedFile, { textChangedIn }: FixStepResult, run: CheckRun): ChangedLines {
  return textChangedIn.includes(path) ? changedLinesReadAgain(run, path) : changed
}

function findingsOfTheFilesRead(reported: readonly ReportsOnAFile[]): CheckFinding[] {
  return reported.flatMap((said) => ('reports' in said ? findingsIn(said.reports, catalog) : []))
}

function filesGoneByTheReport(reported: readonly ReportsOnAFile[]): NotChecked[] {
  return reported.flatMap((said) => ('notChecked' in said ? [said.notChecked] : []))
}

function fixEnginesOf(run: CheckRun, oxlintConfig: TempOxlintConfig): FixStepEngines {
  const fixRunConfig = fixRunConfigOf(run.configs.oxlint, WITHHELD_FIXES, catalog)
  return {
    oxlint: oxlintFixer({ config: oxlintConfig, fixRunConfig }),
    eslint: run.eslint,
    changedLinesNow: (path) => changedLinesReadAgain(run, path),
  }
}

function changedLinesReadAgain({ repo, files }: CheckRun, path: string): ChangedLines {
  return changedLinesOf(repo, scopedFileAt(files, path).change)
}

function nothingToCheck(): Outcome {
  return { stdout: textOfLines([NOTHING_TO_CHECK]), stderr: '', exitCode: EXIT_CLEAN }
}

/** JS and TS files go to both engines, Vue, Svelte and Astro files to oxlint alone, and none of any other kind to either. */
function lintedFileOf(repo: GitRepo, config: FoundConfig, change: ChangedFile): FileInFolder[] {
  const extension = extname(change.path).slice(EXTENSION_DOT.length)
  const readByEslint = JS_AND_TS_EXTENSIONS.has(extension)
  if (!readByEslint && !isAComponentExtension(extension)) return []
  const path = join(repo.topLevel, change.path)
  return [{ change, path, file: slashSeparated(relative(config.folder, path)), readByEslint }]
}

/** The agent build, the component files' guard blocks first. */
function agentBuildOf(eslintPart: EslintPart): EngineConfigs {
  const agentSettings = agentSettingsOf(eslintPart)
  const built = buildAgentConfigs(agentSettings)
  return { ...built, eslint: [...componentFileBlocksOf(agentSettings), ...built.eslint] }
}

function eslintEngineOf(repo: GitRepo, config: FoundConfig, built: EngineConfigs, configs: EngineConfigsToRun): EslintEngine {
  return eslintEngineByFolder(config.folder, {
    inTheConfigFolder: eslintEngineBuiltOnFirstUse(() => eslintEngineFor(config.folder, built.eslint, WITHHELD_FIXES)),
    elsewhere: eslintEngineBuiltOnFirstUse(() => eslintEngineFor(repo.topLevel, configs.eslint, WITHHELD_FIXES)),
  })
}

/** Empty where the config sits at the git top level. */
function folderFromTheGitTopLevel({ topLevel }: GitRepo, { folder }: FoundConfig): string {
  return slashSeparated(relative(topLevel, folder))
}

function filesOnDiskWhenRead(files: readonly FileInFolder[], read: Snapshots): FileInFolder[] {
  return files.filter(({ path }) => read.has(path))
}

/** Both engines get this one list. */
async function filesNotIgnored(files: readonly FileInFolder[], isIgnored: (path: string) => Promise<boolean>): Promise<FileInFolder[]> {
  const ignored = await Promise.all(files.map(({ path }) => isIgnored(path)))
  return files.filter((_file, index) => ignored[index] === false)
}

function pathsOf(files: readonly FileInFolder[]): string[] {
  return files.map(({ path }) => path)
}

function withChangedLines(repo: GitRepo, files: readonly FileInFolder[]): ScopedFile[] {
  return files.map((file) => ({ ...file, changed: changedLinesOf(repo, file.change) }))
}

/** Each record updates `ifStopped`, so a stopped run still names every file it rewrote. */
function autofixedFilesOf(files: readonly ScopedFile[], ifStopped: StdoutIfStopped): AutofixedFiles {
  const rewritten = new Set<string>()
  const named = (): string[] => files.filter(({ path }) => rewritten.has(path)).map(({ file }) => file)
  return {
    record: (path) => {
      rewritten.add(path)
      ifStopped.update(autofixedStdout(named()))
    },
    named,
  }
}

function scopedFileAt(files: readonly ScopedFile[], path: string): ScopedFile {
  return foundOr(files.find((file) => file.path === path), `${path} is not among the files check lints`)
}

/** None where ESLint does not read the file, or failed on it, which the step lists as not checked. */
function eslintMessagesOn({ eslintMessages, notChecked }: FixStepResult, { path, readByEslint }: ScopedFile): readonly Linter.LintMessage[] {
  if (!readByEslint || firstNotCheckedOf(notChecked, path) !== undefined) return []
  return foundOr(eslintMessages.get(path), `ESLint gave no result for ${path}`)
}

/** oxlint names each file from the folder it ran in, the git top level. */
function oxlintDiagnosticsOn({ diagnostics }: OxlintReport, topLevel: string, path: string): readonly OxlintDiagnostic[] {
  return diagnostics.filter(({ filename }) => resolve(topLevel, filename) === path)
}
