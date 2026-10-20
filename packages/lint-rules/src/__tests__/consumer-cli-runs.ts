import {
  describeFinding,
  describeOxlintFindings,
  type EngineFinding,
  type EslintCliOutcome,
  type EslintCliResult,
  eslintCliOutcomeOf,
  eslintEngineFindingsIn,
  eslintFindingsIn,
  fatalMessagesIn,
  type OxlintCliOutcome,
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
function oxlintEngineFindingsOf({ projectDir, oxlint }: ConsumerCliRuns): EngineFinding[] {
  if (oxlint.outcome === 'refused') throw new Error(`oxlint could not run on ${projectDir}: ${oxlint.output}`)
  return oxlintEngineFindingsIn(oxlint.run.report)
}

/** As `file:line code severity`, sorted: throws where oxlint refused the config. */
export function oxlintFindingsWithSeverityOf({ projectDir, oxlint }: ConsumerCliRuns, { names }: RuleByItsNames): string[] {
  if (oxlint.outcome === 'refused') throw new Error(`oxlint could not run on ${projectDir}: ${oxlint.output}`)
  return describeOxlintFindings(oxlintFindingsWithSeverityIn(oxlint.run.report).filter(({ rule }) => names.includes(rule)))
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
export function eslintFatalMessagesOf({ projectDir, eslint }: ConsumerEslintCliRun): string[] {
  return fatalMessagesIn(eslintResultsOf({ projectDir, eslint }), projectDir)
}

/** Throws where ESLint could not run. */
export function eslintEngineFindingsOf({ projectDir, eslint }: ConsumerEslintCliRun): EngineFinding[] {
  return eslintEngineFindingsIn(eslintResultsOf({ projectDir, eslint }), projectDir)
}

/** Sorted, by path in the project: throws where ESLint could not run. */
export function eslintLintedFilesOf({ projectDir, eslint }: ConsumerEslintCliRun): string[] {
  return eslintResultsOf({ projectDir, eslint })
    .map((result) => projectPathOf(result.filePath, projectDir))
    .toSorted()
}

/** A plugin's own warnings among it: throws where ESLint could not run. */
export function eslintStderrOf({ projectDir, eslint }: ConsumerEslintCliRun): string {
  if (eslint.outcome === 'refused') throw new Error(`ESLint could not run on ${projectDir}: ${eslint.output}`)
  return eslint.stderr
}

function eslintResultsOf({ projectDir, eslint }: ConsumerEslintCliRun): readonly EslintCliResult[] {
  if (eslint.outcome === 'refused') throw new Error(`ESLint could not run on ${projectDir}: ${eslint.output}`)
  return eslint.results
}
