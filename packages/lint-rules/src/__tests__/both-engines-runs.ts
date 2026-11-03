import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ESLint, type Linter } from 'eslint'
import type { OxlintConfig } from 'oxlint'
import { defineLintRules, type LintRules } from '../index.ts'
import { agentConfigsOf } from './agent-configs.ts'
import type { OurFields } from './cases/both-engines-grid.ts'
import {
  type EngineFinding,
  eslintEngineFindingsIn,
  fatalMessagesIn,
  oxlintEngineFindingsIn,
  runOxlintCli,
  writeOxlintConfigFile,
} from './engine-clis.ts'
import {
  agentsIncLintModuleText,
  CONSUMER_CONFIG_FILES,
  emptyTeamEslintModuleText,
  mergedEslintConfigText,
  mergedOxlintConfigText,
  type TeamEslintRules,
  type TeamGlobalIgnoresBlock,
  teamAloneEslintConfigText,
  teamEslintModuleText,
} from './factories/consumer-project-factories.ts'
import { buildConsumerLintRules } from './factories/lint-rules-factories.ts'
import { buildPackageJsonListingOxlint, packageJsonText } from './factories/package-json-factories.ts'
import { projectPathOf } from './project-paths.ts'
import { type RunsBeforeTheSuiteOptions, setUpRunsBeforeTheSuite } from './runs-before-the-suite.ts'
import { EMPTY_TEAM_OXLINT_CONFIG } from './team-configs-of-the-other-engine.ts'
import { INSTALLED_OXLINT, installedPackage, type ProjectFiles, THIS_PACKAGE, type TempProjects } from './temp-projects.ts'

type OurRulesets = Parameters<typeof buildConsumerLintRules>[1]

export type BothEnginesProject = {
  readonly sources: ProjectFiles
  readonly ourRulesets?: OurRulesets
  readonly ours: OurFields
  /** Turned on in every file the team lints, .vue, .svelte and .astro included. */
  readonly teamEslintRules: TeamEslintRules
  /** .js and .ts unless given. */
  readonly teamJsAndTsExtensions?: readonly string[]
  /** May take files back from ESLint's default ignores. */
  readonly teamEslintGlobalIgnores?: TeamGlobalIgnoresBlock
  readonly teamOxlintConfig: OxlintConfig
  /** Gives oxlint each source file, as an editor does, not the folder, whose walk skips every .git folder (measured, oxlint 1.87). */
  readonly oxlintGivenEachSourceFile?: true
}

export type BothEnginesRuns = {
  /** Our part alone, suppressions allowed as the editor set allows them. */
  readonly agent: readonly EngineFinding[]
  /** Our editor parts merged into an empty team ESLint config and a team oxlint config turning nothing on. */
  readonly mergedIntoEmptyTeamConfigs: readonly EngineFinding[]
  readonly mergedIntoTheTeamsConfigs: readonly EngineFinding[]
  readonly teamAlone: readonly EngineFinding[]
  /** `run, file: message`, parse errors included. */
  readonly eslintFatalMessages: readonly string[]
  readonly eslintFatalMessagesInEachBuild: Readonly<Record<BuildName, readonly string[]>>
  /** Every file each ESLint run gives a result for, sorted. */
  readonly eslintLintedFiles: Readonly<Record<BuildName, readonly string[]>>
}

type BuildName = 'agent' | 'mergedIntoEmptyTeamConfigs' | 'mergedIntoTheTeamsConfigs' | 'teamAlone'

type BuildConfigs = { readonly name: string; readonly eslint: string | readonly Linter.Config[]; readonly oxlintConfigFile: string }

type BuildRun = {
  readonly findings: readonly EngineFinding[]
  readonly eslintFatalMessages: readonly string[]
  readonly eslintLintedFiles: readonly string[]
}

type RunsOfEachBuild = Readonly<Record<BuildName, BuildRun>>

const LINKED_PACKAGES = [THIS_PACKAGE, INSTALLED_OXLINT, installedPackage('typescript-eslint')]
const BOTH_ENGINES_RUNS: RunsBeforeTheSuiteOptions = { timeoutMs: 480_000, whatFailed: 'the engines could not lint the project before the suite' }
const EVERYTHING = '.'
const EMPTY_TEAM_ESLINT_MODULE = 'empty-team.eslint.mjs'
const AGENT = { name: 'agent build', oxlintConfigFile: 'oxlint.agent.json' } as const
const MERGED_INTO_EMPTY_TEAM_CONFIGS = { name: 'merged into empty team configs', eslint: 'eslint.merged-into-empty.mjs', oxlintConfigFile: 'oxlint.merged-into-empty.mts' } as const
const MERGED_INTO_THE_TEAMS_CONFIGS = { name: "merged into the team's configs", eslint: 'eslint.merged.mjs', oxlintConfigFile: 'oxlint.merged.mts' } as const
const TEAM_ALONE = { name: "the team's configs alone", eslint: CONSUMER_CONFIG_FILES.teamAloneEslint, oxlintConfigFile: CONSUMER_CONFIG_FILES.teamAloneOxlint } as const

/** Lints the project with each build, by the real oxlint CLI and ESLint Node API. Registers hooks: call it in a describe block. */
export function setUpBothEnginesRuns(project: BothEnginesProject): () => BothEnginesRuns {
  return setUpBothEnginesRunsOf(() => project)
}

/** As setUpBothEnginesRuns, the project made in the hook too, so a throw making it fails each test, not the file. */
export function setUpBothEnginesRunsOf(projectOf: () => BothEnginesProject): () => BothEnginesRuns {
  return setUpRunsBeforeTheSuite((tempProjects) => bothEnginesRunsOf(tempProjects, projectOf()), BOTH_ENGINES_RUNS)
}

async function bothEnginesRunsOf(tempProjects: TempProjects, project: BothEnginesProject): Promise<BothEnginesRuns> {
  const projectDir = tempProjects.create({
    files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()), ...project.sources },
    linkedPackages: LINKED_PACKAGES,
  })
  const lintRules = lintRulesOf(projectDir, project)
  writeConsumerFiles(projectDir, lintRules, project)
  const agent = agentConfigsOf(defineLintRules(lintRules))
  writeOxlintConfigFile(projectDir, AGENT.oxlintConfigFile, agent.oxlint)
  const runs = await runsOfEachBuild(projectDir, agent.eslint, oxlintPathsFor(project))
  return bothEnginesRunsFrom(runs)
}

async function runsOfEachBuild(projectDir: string, agentEslint: readonly Linter.Config[], oxlintPaths: readonly string[]): Promise<RunsOfEachBuild> {
  return {
    agent: await runOf(projectDir, { ...AGENT, eslint: agentEslint }, oxlintPaths),
    mergedIntoEmptyTeamConfigs: await runOf(projectDir, MERGED_INTO_EMPTY_TEAM_CONFIGS, oxlintPaths),
    mergedIntoTheTeamsConfigs: await runOf(projectDir, MERGED_INTO_THE_TEAMS_CONFIGS, oxlintPaths),
    teamAlone: await runOf(projectDir, TEAM_ALONE, oxlintPaths),
  }
}

function bothEnginesRunsFrom(runs: RunsOfEachBuild): BothEnginesRuns {
  return {
    ...byBuild(runs, 'findings'),
    eslintFatalMessages: Object.values(runs).flatMap((run) => run.eslintFatalMessages),
    eslintFatalMessagesInEachBuild: byBuild(runs, 'eslintFatalMessages'),
    eslintLintedFiles: byBuild(runs, 'eslintLintedFiles'),
  }
}

function byBuild<Field extends keyof BuildRun>(runs: RunsOfEachBuild, field: Field): Readonly<Record<BuildName, BuildRun[Field]>> {
  return {
    agent: runs.agent[field],
    mergedIntoEmptyTeamConfigs: runs.mergedIntoEmptyTeamConfigs[field],
    mergedIntoTheTeamsConfigs: runs.mergedIntoTheTeamsConfigs[field],
    teamAlone: runs.teamAlone[field],
  }
}

function oxlintPathsFor({ sources, oxlintGivenEachSourceFile }: BothEnginesProject): readonly string[] {
  return oxlintGivenEachSourceFile === true ? Object.keys(sources) : [EVERYTHING]
}

/** Suppressions allowed, as the editor set always allows them, so the agent build states its rules. */
function lintRulesOf(projectDir: string, { ourRulesets = {}, ours }: BothEnginesProject): LintRules {
  return buildConsumerLintRules(projectDir, ourRulesets, { ...ours, allowSuppressions: true })
}

function writeConsumerFiles(
  projectDir: string,
  lintRules: LintRules,
  { teamEslintRules, teamJsAndTsExtensions, teamEslintGlobalIgnores, teamOxlintConfig }: BothEnginesProject,
): void {
  const { lintRules: lintRulesModule, teamEslintModule } = CONSUMER_CONFIG_FILES
  const files: ProjectFiles = {
    [lintRulesModule]: agentsIncLintModuleText(lintRules),
    [teamEslintModule]: teamEslintModuleText(teamEslintRules, teamJsAndTsExtensions, teamEslintGlobalIgnores),
    [EMPTY_TEAM_ESLINT_MODULE]: emptyTeamEslintModuleText(),
    [MERGED_INTO_EMPTY_TEAM_CONFIGS.eslint]: mergedEslintConfigText(lintRulesModule, EMPTY_TEAM_ESLINT_MODULE, {
      oxlintConfig: MERGED_INTO_EMPTY_TEAM_CONFIGS.oxlintConfigFile,
    }),
    [MERGED_INTO_EMPTY_TEAM_CONFIGS.oxlintConfigFile]: mergedOxlintConfigText(lintRulesModule, EMPTY_TEAM_OXLINT_CONFIG, {
      eslintConfig: MERGED_INTO_EMPTY_TEAM_CONFIGS.eslint,
    }),
    [MERGED_INTO_THE_TEAMS_CONFIGS.eslint]: mergedEslintConfigText(lintRulesModule, teamEslintModule, {
      oxlintConfig: MERGED_INTO_THE_TEAMS_CONFIGS.oxlintConfigFile,
    }),
    [MERGED_INTO_THE_TEAMS_CONFIGS.oxlintConfigFile]: mergedOxlintConfigText(lintRulesModule, teamOxlintConfig, {
      eslintConfig: MERGED_INTO_THE_TEAMS_CONFIGS.eslint,
    }),
    [TEAM_ALONE.eslint]: teamAloneEslintConfigText(teamEslintModule),
  }
  for (const [file, text] of Object.entries(files)) writeFileSync(join(projectDir, file), text)
  writeOxlintConfigFile(projectDir, TEAM_ALONE.oxlintConfigFile, teamOxlintConfig)
}

/** ESLint first, in this process, then the oxlint CLI. A config oxlint refuses fails the run. */
async function runOf(projectDir: string, { name, eslint, oxlintConfigFile }: BuildConfigs, oxlintPaths: readonly string[]): Promise<BuildRun> {
  const results = await eslintFor(projectDir, eslint).lintFiles([EVERYTHING])
  const oxlint = runOxlintCli(projectDir, oxlintConfigFile, oxlintPaths)
  return {
    findings: [...eslintEngineFindingsIn(results, projectDir), ...oxlintEngineFindingsIn(oxlint.report)],
    eslintFatalMessages: fatalMessagesIn(results, projectDir).map((message) => `${name}, ${message}`),
    eslintLintedFiles: results.map((result) => projectPathOf(result.filePath, projectDir)).toSorted(),
  }
}

function eslintFor(projectDir: string, eslint: string | readonly Linter.Config[]): ESLint {
  if (typeof eslint === 'string') return new ESLint({ cwd: projectDir, overrideConfigFile: join(projectDir, eslint) })
  return new ESLint({ cwd: projectDir, overrideConfigFile: true, overrideConfig: [...eslint] })
}

