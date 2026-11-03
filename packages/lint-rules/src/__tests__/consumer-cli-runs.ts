import {
  describeFinding,
  describeOxlintFindings,
  type EngineFinding,
  type EslintCliOutcome,
  eslintCliOutcomeOf,
  eslintEngineFindingsIn,
  eslintFindingsIn,
  fatalMessagesIn,
  type OxlintCliOutcome,
  type OxlintCliRun,
  oxlintCliOutcomeOf,
  oxlintEngineFindingsIn,
  oxlintFindingsIn,
  oxlintFindingsWithSeverityIn,
} from './engine-clis.ts'
import type { RuleByItsNames } from './findings-beside-the-team.ts'
import { projectPathOf } from './project-paths.ts'
import { setUpRunsBeforeTheSuite } from './runs-before-the-suite.ts'
import { CONSUMER_INSTALL, type LinkedPackage, type ProjectFiles, THIS_PACKAGE } from './temp-projects.ts'

export type ConsumerCliRuns = { readonly projectDir: string; readonly oxlint: OxlintCliOutcome; readonly eslint: EslintCliOutcome }

export type ConsumerEslintCliRun = Pick<ConsumerCliRuns, 'projectDir' | 'eslint'>

/** Each finding as `file:line rule`, sorted, or what the CLI printed where it refused to run. */
export type EngineReport = { readonly refused: false; readonly findings: readonly string[] } | { readonly refused: true; readonly output: string }

const EVERYTHING = ['.']

/** Runs the real oxlint and ESLint CLIs over the project, as a team runs them. Registers hooks: call it in a describe block. */
export function setUpConsumerCliRuns(files: ProjectFiles, oxlintConfigFile: string, packagesTheTeamImports: readonly LinkedPackage[] = []): () => ConsumerCliRuns {
  return setUpRunsBeforeTheSuite((tempProjects) => {
    const projectDir = tempProjects.create({ files, linkedPackages: [...CONSUMER_INSTALL, ...packagesTheTeamImports] })
    return { projectDir, oxlint: oxlintCliOutcomeOf(projectDir, oxlintConfigFile, EVERYTHING), eslint: eslintCliOutcomeOf(projectDir) }
  })
}

/** As `setUpConsumerCliRuns`, ESLint alone. Registers hooks: call it in a describe block. */
export function setUpConsumerEslintCliRun(files: ProjectFiles, packagesTheTeamImports: readonly LinkedPackage[] = []): () => ConsumerEslintCliRun {
  return setUpRunsBeforeTheSuite((tempProjects) => {
    const projectDir = tempProjects.create({ files, linkedPackages: [THIS_PACKAGE, ...packagesTheTeamImports] })
    return { projectDir, eslint: eslintCliOutcomeOf(projectDir) }
  })
}

export type MergedAndTeamAloneEslintCliRuns = { readonly merged: ConsumerEslintCliRun; readonly teamAlone: ConsumerEslintCliRun }

/** The ESLint CLI twice, each in its own process: merged, then the team's config alone. Registers hooks: call it in a describe block. */
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

/** ESLint finds `eslint.config.mjs` itself where no file is named. */
export type CliConfigFiles = { readonly oxlintConfigFile: string; readonly eslintConfigFile?: string }

export type MergedAndTeamAloneCliRuns = { readonly merged: ConsumerCliRuns; readonly teamAlone: ConsumerCliRuns }

/**
* Both CLIs twice, each in its own process: merged, then the team's configs alone; a refused config is kept as
* its refusal. Registers hooks: call it in a describe block.
*/
export function setUpMergedAndTeamAloneCliRuns(
  files: ProjectFiles,
  configFiles: { readonly merged: CliConfigFiles; readonly teamAlone: CliConfigFiles },
  packagesTheTeamImports: readonly LinkedPackage[] = [],
): () => MergedAndTeamAloneCliRuns {
  return setUpRunsBeforeTheSuite((tempProjects) => {
    const projectDir = tempProjects.create({ files, linkedPackages: [...CONSUMER_INSTALL, ...packagesTheTeamImports] })
    return { merged: cliRunsWith(projectDir, configFiles.merged), teamAlone: cliRunsWith(projectDir, configFiles.teamAlone) }
  })
}

function cliRunsWith(projectDir: string, { oxlintConfigFile, eslintConfigFile }: CliConfigFiles): ConsumerCliRuns {
  return { projectDir, oxlint: oxlintCliOutcomeOf(projectDir, oxlintConfigFile, EVERYTHING), eslint: eslintCliOutcomeOf(projectDir, eslintConfigFile) }
}

/** Under each engine's own rule name, with its message: throws where either CLI could not run. */
export function bothEnginesFindingsOf(runs: ConsumerCliRuns): EngineFinding[] {
  return [...eslintEngineFindingsOf(runs), ...oxlintEngineFindingsOf(runs)]
}

/** Under oxlint's code for the rule (`eslint(no-debugger)`): throws where it refused the config. */
function oxlintEngineFindingsOf(runs: ConsumerCliRuns): EngineFinding[] {
  return oxlintEngineFindingsIn(oxlintRunOf(runs).report)
}

/** As `file:line code severity`, sorted: throws where oxlint refused the config. */
export function oxlintFindingsWithSeverityOf(runs: ConsumerCliRuns, { names }: RuleByItsNames): string[] {
  return describeOxlintFindings(oxlintFindingsWithSeverityIn(oxlintRunOf(runs).report).filter(({ rule }) => names.includes(rule)))
}

function oxlintRunOf({ projectDir, oxlint }: ConsumerCliRuns): OxlintCliRun {
  if (oxlint.outcome === 'refused') throw new Error(`oxlint could not run on ${projectDir}: ${oxlint.output}`)
  return oxlint.run
}

export function oxlintReportOf({ oxlint }: ConsumerCliRuns): EngineReport {
  if (oxlint.outcome === 'refused') return { refused: true, output: oxlint.output }
  return { refused: false, findings: oxlintFindingsIn(oxlint.run.report).map(describeFinding) }
}

export function eslintReportOf({ projectDir, eslint }: ConsumerEslintCliRun): EngineReport {
  if (eslint.outcome === 'refused') return { refused: true, output: eslint.output }
  return { refused: false, findings: eslintFindingsIn(eslint.results, projectDir).map(describeFinding) }
}

/** Parse errors included: throws where ESLint could not run, which no list of messages describes. */
export function eslintFatalMessagesOf(run: ConsumerEslintCliRun): string[] {
  return fatalMessagesIn(lintedEslintOf(run).results, run.projectDir)
}

/** Throws where ESLint could not run. */
export function eslintEngineFindingsOf(run: ConsumerEslintCliRun): EngineFinding[] {
  return eslintEngineFindingsIn(lintedEslintOf(run).results, run.projectDir)
}

/** Sorted, by path in the project: throws where ESLint could not run. */
export function eslintLintedFilesOf(run: ConsumerEslintCliRun): string[] {
  return lintedEslintOf(run).results.map((result) => projectPathOf(result.filePath, run.projectDir)).toSorted()
}

/** A plugin's own warnings among it: throws where ESLint could not run. */
export function eslintStderrOf(run: ConsumerEslintCliRun): string {
  return lintedEslintOf(run).stderr
}

type LintedEslintCli = Extract<EslintCliOutcome, { readonly outcome: 'linted' }>

function lintedEslintOf({ projectDir, eslint }: ConsumerEslintCliRun): LintedEslintCli {
  if (eslint.outcome === 'refused') throw new Error(`ESLint could not run on ${projectDir}: ${eslint.output}`)
  return eslint
}
