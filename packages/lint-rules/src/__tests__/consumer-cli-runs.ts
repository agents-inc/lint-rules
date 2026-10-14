import { relative, sep } from 'node:path'
import { beforeAll } from 'vitest'
import {
  describeFinding,
  describeOxlintFindings,
  type EslintCliOutcome,
  type EslintCliResult,
  eslintCliOutcomeOf,
  eslintFindingsIn,
  fatalMessagesIn,
  type OxlintCliOutcome,
  oxlintCliOutcomeOf,
  oxlintFindingsIn,
  oxlintFindingsWithSeverityIn,
} from './engine-clis.ts'
import type { EngineFinding, RuleByItsNames } from './findings-beside-the-team.ts'
import { INSTALLED_OXLINT, type LinkedPackage, type ProjectFiles, setUpTempProjects, THIS_PACKAGE, type TempProjects } from './temp-projects.ts'

/** What each engine's CLI made of a consumer's project, run from its root with the project's own config files. */
export type ConsumerCliRuns = { readonly projectDir: string; readonly oxlint: OxlintCliOutcome; readonly eslint: EslintCliOutcome }

/** What the ESLint CLI made of a consumer's project, run from its root with the project's own `eslint.config.mjs`. */
export type ConsumerEslintCliRun = Pick<ConsumerCliRuns, 'projectDir' | 'eslint'>

/** What one engine's CLI made of the project: each finding as `file:line rule`, sorted, or what it printed where it refused to run. */
export type EngineReport = { readonly refused: false; readonly findings: readonly string[] } | { readonly refused: true; readonly output: string }

/** As `runsBeforeTheSuite` in both-engines-runs.ts: a run that threw is kept as its error, so each test reports it as its own failure. */
type RunsBeforeTheSuite<Runs> =
  | { readonly outcome: 'not made' }
  | { readonly outcome: 'completed'; readonly runs: Runs }
  | { readonly outcome: 'failed'; readonly error: unknown }

const CONSUMER_CLI_RUNS_TIMEOUT_MS = 300_000
const LINKED_PACKAGES = [THIS_PACKAGE, INSTALLED_OXLINT]
const EVERYTHING = ['.']
const GLOB_SEPARATOR = '/'

/**
 * Makes the project before the suite, with the built package, oxlint and each package the team's
 * configs import installed, and runs the real oxlint CLI with the config file given and the real
 * ESLint CLI, which finds `eslint.config.mjs` itself, each over the whole project, as a team runs
 * them. Call it at the top of a describe block:
 * it registers that scope's hooks.
 */
export function setUpConsumerCliRuns(files: ProjectFiles, oxlintConfigFile: string, packagesTheTeamImports: readonly LinkedPackage[] = []): () => ConsumerCliRuns {
  return setUpRunsBeforeTheSuite((tempProjects) => {
    const projectDir = tempProjects.create({ files, linkedPackages: [...LINKED_PACKAGES, ...packagesTheTeamImports] })
    return { projectDir, oxlint: oxlintCliOutcomeOf(projectDir, oxlintConfigFile, EVERYTHING), eslint: eslintCliOutcomeOf(projectDir) }
  })
}

/**
 * Makes the project before the suite, with the built package and each package the team's config
 * imports installed, and runs the real ESLint CLI alone over the whole project from its root,
 * finding `eslint.config.mjs` itself, as a team runs it: for a project that runs no oxlint, or a test that reads ESLint alone. Call it at the top
 * of a describe block: it registers that scope's hooks.
 */
export function setUpConsumerEslintCliRun(files: ProjectFiles, packagesTheTeamImports: readonly LinkedPackage[] = []): () => ConsumerEslintCliRun {
  return setUpRunsBeforeTheSuite((tempProjects) => {
    const projectDir = tempProjects.create({ files, linkedPackages: [THIS_PACKAGE, ...packagesTheTeamImports] })
    return { projectDir, eslint: eslintCliOutcomeOf(projectDir) }
  })
}

/** What the ESLint CLI made of a consumer's project with our ESLint part merged into the team's config, and with the team's config alone. */
export type MergedAndTeamAloneEslintCliRuns = { readonly merged: ConsumerEslintCliRun; readonly teamAlone: ConsumerEslintCliRun }

/**
 * Makes the project before the suite, with the built package and each package the team's config
 * imports installed, and runs the real ESLint CLI over the whole project from its root twice, each
 * in a process of its own: with the project's own `eslint.config.mjs`, merging our ESLint part into
 * the team's config, and with the config file given, holding the team's config alone. Call it at
 * the top of a describe block: it registers that scope's hooks.
 */
export function setUpMergedAndTeamAloneEslintCliRuns(
  files: ProjectFiles,
  teamAloneConfigFile: string,
  packagesTheTeamImports: readonly LinkedPackage[],
): () => MergedAndTeamAloneEslintCliRuns {
  return setUpRunsBeforeTheSuite((tempProjects) => {
    const projectDir = tempProjects.create({ files, linkedPackages: [THIS_PACKAGE, ...packagesTheTeamImports] })
    return {
      merged: { projectDir, eslint: eslintCliOutcomeOf(projectDir) },
      teamAlone: { projectDir, eslint: eslintCliOutcomeOf(projectDir, teamAloneConfigFile) },
    }
  })
}

/** The config files a run of both CLIs lints with: oxlint's, and ESLint's, which finds `eslint.config.mjs` itself where none is named. */
export type CliConfigFiles = { readonly oxlintConfigFile: string; readonly eslintConfigFile?: string }

/** What both CLIs made of a consumer's project with our parts merged into the team's configs, and with the team's configs alone. */
export type MergedAndTeamAloneCliRuns = { readonly merged: ConsumerCliRuns; readonly teamAlone: ConsumerCliRuns }

/**
 * Makes the project before the suite, with the built package, oxlint and each package the team's
 * configs import installed, and runs both real CLIs over the whole project from its root twice, each
 * run in a process of its own: with the merged configs and with the team's configs alone, as the
 * config files given name them. A config either CLI refuses is kept as its refusal. Call it at the
 * top of a describe block: it registers that scope's hooks.
 */
export function setUpMergedAndTeamAloneCliRuns(
  files: ProjectFiles,
  configFiles: { readonly merged: CliConfigFiles; readonly teamAlone: CliConfigFiles },
  packagesTheTeamImports: readonly LinkedPackage[] = [],
): () => MergedAndTeamAloneCliRuns {
  return setUpRunsBeforeTheSuite((tempProjects) => {
    const projectDir = tempProjects.create({ files, linkedPackages: [...LINKED_PACKAGES, ...packagesTheTeamImports] })
    return { merged: cliRunsWith(projectDir, configFiles.merged), teamAlone: cliRunsWith(projectDir, configFiles.teamAlone) }
  })
}

function cliRunsWith(projectDir: string, { oxlintConfigFile, eslintConfigFile }: CliConfigFiles): ConsumerCliRuns {
  return { projectDir, oxlint: oxlintCliOutcomeOf(projectDir, oxlintConfigFile, EVERYTHING), eslint: eslintCliOutcomeOf(projectDir, eslintConfigFile) }
}

/** Every finding either CLI reports, under the engine's own name for the rule, with its message: throws where either could not run. */
export function bothEnginesFindingsOf(runs: ConsumerCliRuns): EngineFinding[] {
  return [...eslintEngineFindingsOf(runs), ...oxlintEngineFindingsOf(runs)]
}

/** Every finding oxlint reports, under its code for the rule (`eslint(no-debugger)`), with its message: throws where it refused the config. */
export function oxlintEngineFindingsOf({ projectDir, oxlint }: ConsumerCliRuns): EngineFinding[] {
  if (oxlint.outcome === 'refused') throw new Error(`oxlint could not run on ${projectDir}: ${oxlint.output}`)
  return oxlint.run.report.diagnostics.map(({ code, filename, message, labels: [firstLabel] }) => ({
    engine: 'oxlint',
    file: filename,
    rule: code,
    line: firstLabel === undefined ? null : firstLabel.span.line,
    message,
  }))
}

/** oxlint's findings of the rule given, under any of its names, as `file:line code severity`, sorted: throws where it refused the config. */
export function oxlintFindingsWithSeverityOf({ projectDir, oxlint }: ConsumerCliRuns, { names }: RuleByItsNames): string[] {
  if (oxlint.outcome === 'refused') throw new Error(`oxlint could not run on ${projectDir}: ${oxlint.output}`)
  return describeOxlintFindings(oxlintFindingsWithSeverityIn(oxlint.run.report).filter(({ rule }) => names.includes(rule)))
}

/** oxlint's report: its findings under its codes for the rules (`eslint(no-debugger)`), or what it printed where it refused the config. */
export function oxlintReportOf({ oxlint }: ConsumerCliRuns): EngineReport {
  if (oxlint.outcome === 'refused') return { refused: true, output: oxlint.output }
  return { refused: false, findings: oxlintFindingsIn(oxlint.run.report).map(describeFinding) }
}

/** ESLint's report: its findings under its rule IDs, or what it printed where it could not run. */
export function eslintReportOf({ projectDir, eslint }: ConsumerEslintCliRun): EngineReport {
  if (eslint.outcome === 'refused') return { refused: true, output: eslint.output }
  return { refused: false, findings: eslintFindingsIn(eslint.results, projectDir).map(describeFinding) }
}

/** `file: message` for every fatal ESLint message, a parse error included: throws where ESLint could not run, which no list of messages describes. */
export function eslintFatalMessagesOf({ projectDir, eslint }: ConsumerEslintCliRun): string[] {
  return fatalMessagesIn(eslintResultsOf({ projectDir, eslint }), projectDir)
}

/** Every finding a rule reports in ESLint, with its message, for `findingsByFileAndRule`: throws where ESLint could not run. */
export function eslintEngineFindingsOf({ projectDir, eslint }: ConsumerEslintCliRun): EngineFinding[] {
  return eslintResultsOf({ projectDir, eslint }).flatMap((result) =>
    result.messages.flatMap(({ ruleId, line, message }): EngineFinding[] =>
      ruleId === null ? [] : [{ engine: 'eslint', file: projectPathOf(result.filePath, projectDir), rule: ruleId, line, message }],
    ),
  )
}

/** The files ESLint linted, each one it gives a result for, by its path in the project, sorted: throws where ESLint could not run. */
export function eslintLintedFilesOf({ projectDir, eslint }: ConsumerEslintCliRun): string[] {
  return eslintResultsOf({ projectDir, eslint })
    .map((result) => projectPathOf(result.filePath, projectDir))
    .toSorted()
}

function eslintResultsOf({ projectDir, eslint }: ConsumerEslintCliRun): readonly EslintCliResult[] {
  if (eslint.outcome === 'refused') throw new Error(`ESLint could not run on ${projectDir}: ${eslint.output}`)
  return eslint.results
}

/**
 * The runs `make` makes in the project it creates, before the suite: read after it, a run that threw
 * throws as each test's own failure, since vitest reports a test whose beforeAll threw as skipped.
 * Call it at the top of a describe block: it registers that scope's hooks.
 */
export function setUpRunsBeforeTheSuite<Runs>(make: (tempProjects: TempProjects) => Runs): () => Runs {
  const tempProjects = setUpTempProjects()
  let runsBeforeTheSuite: RunsBeforeTheSuite<Runs> = { outcome: 'not made' }

  beforeAll(() => {
    try {
      runsBeforeTheSuite = { outcome: 'completed', runs: make(tempProjects) }
    } catch (error) {
      runsBeforeTheSuite = { outcome: 'failed', error }
    }
  }, CONSUMER_CLI_RUNS_TIMEOUT_MS)

  return () => {
    if (runsBeforeTheSuite.outcome === 'failed') {
      throw new Error('the engines could not be run on the project before the suite', { cause: runsBeforeTheSuite.error })
    }
    if (runsBeforeTheSuite.outcome === 'not made') throw new Error('the runs were read outside the suite that made them')
    return runsBeforeTheSuite.runs
  }
}

function projectPathOf(filePath: string, projectDir: string): string {
  return relative(projectDir, filePath).split(sep).join(GLOB_SEPARATOR)
}
