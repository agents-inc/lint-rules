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
  oxlintCliOutcomeOf,
  oxlintEngineFindingsIn,
  writeOxlintConfigFile,
} from './engine-clis.ts'
import {
  agentsIncLintModuleText,
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
  /** Keeps a config oxlint refuses as a refusal with no findings; unless given, the runs fail. */
  readonly keepsOxlintRefusals?: true
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
  /** `run: what oxlint printed`, where the project keeps refusals. */
  readonly oxlintRefusals: readonly string[]
}

type BuildName = 'agent' | 'mergedIntoEmptyTeamConfigs' | 'mergedIntoTheTeamsConfigs' | 'teamAlone'

type BuildConfigs = { readonly name: string; readonly eslint: string | Linter.Config[]; readonly oxlintConfigFile: string }

type OxlintRuns = { readonly paths: readonly string[]; readonly keepsRefusals: boolean }

type BuildRun = {
  readonly findings: readonly EngineFinding[]
  readonly eslintFatalMessages: readonly string[]
  readonly eslintLintedFiles: readonly string[]
  readonly oxlintRefusals: readonly string[]
}

const LINKED_PACKAGES = [THIS_PACKAGE, INSTALLED_OXLINT, installedPackage('typescript-eslint')]
const BOTH_ENGINES_RUNS: RunsBeforeTheSuiteOptions = { timeoutMs: 480_000, whatFailed: 'the engines could not lint the project before the suite' }
const EVERYTHING = '.'
const LINT_RULES_MODULE = 'agents-inc.lint.mts'
const TEAM_ESLINT_MODULE = 'team.eslint.mjs'
const EMPTY_TEAM_ESLINT_MODULE = 'empty-team.eslint.mjs'
const AGENT = { name: 'agent build', oxlintConfigFile: 'oxlint.agent.json' } as const
const MERGED_INTO_EMPTY_TEAM_CONFIGS = { name: 'merged into empty team configs', eslint: 'eslint.merged-into-empty.mjs', oxlintConfigFile: 'oxlint.merged-into-empty.mts' } as const
const MERGED_INTO_THE_TEAMS_CONFIGS = { name: "merged into the team's configs", eslint: 'eslint.merged.mjs', oxlintConfigFile: 'oxlint.merged.mts' } as const
const TEAM_ALONE = { name: "the team's configs alone", eslint: 'eslint.team-alone.mjs', oxlintConfigFile: 'oxlint.team-alone.json' } as const

/** Lints the project with each build, by the real oxlint CLI and ESLint Node API. Registers hooks: call it in a describe block. */
export function setUpBothEnginesRuns(project: BothEnginesProject): () => BothEnginesRuns {
  return setUpRunsBeforeTheSuite((tempProjects) => bothEnginesRunsOf(tempProjects, project), BOTH_ENGINES_RUNS)
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
  const oxlintRuns = oxlintRunsFor(project)
  const runs: Readonly<Record<BuildName, BuildRun>> = {
    agent: await runOf(projectDir, { ...AGENT, eslint: agent.eslint }, oxlintRuns),
    mergedIntoEmptyTeamConfigs: await runOf(projectDir, MERGED_INTO_EMPTY_TEAM_CONFIGS, oxlintRuns),
    mergedIntoTheTeamsConfigs: await runOf(projectDir, MERGED_INTO_THE_TEAMS_CONFIGS, oxlintRuns),
    teamAlone: await runOf(projectDir, TEAM_ALONE, oxlintRuns),
  }
  return {
    agent: runs.agent.findings,
    mergedIntoEmptyTeamConfigs: runs.mergedIntoEmptyTeamConfigs.findings,
    mergedIntoTheTeamsConfigs: runs.mergedIntoTheTeamsConfigs.findings,
    teamAlone: runs.teamAlone.findings,
    eslintFatalMessages: Object.values(runs).flatMap(({ eslintFatalMessages }) => eslintFatalMessages),
    eslintFatalMessagesInEachBuild: {
      agent: runs.agent.eslintFatalMessages,
      mergedIntoEmptyTeamConfigs: runs.mergedIntoEmptyTeamConfigs.eslintFatalMessages,
      mergedIntoTheTeamsConfigs: runs.mergedIntoTheTeamsConfigs.eslintFatalMessages,
      teamAlone: runs.teamAlone.eslintFatalMessages,
    },
    eslintLintedFiles: {
      agent: runs.agent.eslintLintedFiles,
      mergedIntoEmptyTeamConfigs: runs.mergedIntoEmptyTeamConfigs.eslintLintedFiles,
      mergedIntoTheTeamsConfigs: runs.mergedIntoTheTeamsConfigs.eslintLintedFiles,
      teamAlone: runs.teamAlone.eslintLintedFiles,
    },
    oxlintRefusals: Object.values(runs).flatMap(({ oxlintRefusals }) => oxlintRefusals),
  }
}

function oxlintRunsFor({ sources, keepsOxlintRefusals, oxlintGivenEachSourceFile }: BothEnginesProject): OxlintRuns {
  return { paths: oxlintGivenEachSourceFile === true ? Object.keys(sources) : [EVERYTHING], keepsRefusals: keepsOxlintRefusals === true }
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
  const files: ProjectFiles = {
    [LINT_RULES_MODULE]: agentsIncLintModuleText(lintRules),
    [TEAM_ESLINT_MODULE]: teamEslintModuleText(teamEslintRules, teamJsAndTsExtensions, teamEslintGlobalIgnores),
    [EMPTY_TEAM_ESLINT_MODULE]: emptyTeamEslintModuleText(),
    [MERGED_INTO_EMPTY_TEAM_CONFIGS.eslint]: mergedEslintConfigText(LINT_RULES_MODULE, EMPTY_TEAM_ESLINT_MODULE, {
      oxlintConfig: MERGED_INTO_EMPTY_TEAM_CONFIGS.oxlintConfigFile,
    }),
    [MERGED_INTO_EMPTY_TEAM_CONFIGS.oxlintConfigFile]: mergedOxlintConfigText(LINT_RULES_MODULE, EMPTY_TEAM_OXLINT_CONFIG, {
      eslintConfig: MERGED_INTO_EMPTY_TEAM_CONFIGS.eslint,
    }),
    [MERGED_INTO_THE_TEAMS_CONFIGS.eslint]: mergedEslintConfigText(LINT_RULES_MODULE, TEAM_ESLINT_MODULE, {
      oxlintConfig: MERGED_INTO_THE_TEAMS_CONFIGS.oxlintConfigFile,
    }),
    [MERGED_INTO_THE_TEAMS_CONFIGS.oxlintConfigFile]: mergedOxlintConfigText(LINT_RULES_MODULE, teamOxlintConfig, {
      eslintConfig: MERGED_INTO_THE_TEAMS_CONFIGS.eslint,
    }),
    [TEAM_ALONE.eslint]: teamAloneEslintConfigText(TEAM_ESLINT_MODULE),
  }
  Object.entries(files).forEach(([file, text]) => writeFileSync(join(projectDir, file), text))
  writeOxlintConfigFile(projectDir, TEAM_ALONE.oxlintConfigFile, teamOxlintConfig)
}

/** ESLint first, in this process, then the oxlint CLI. A config oxlint refuses fails the run or, where refusals are kept, reports nothing. */
async function runOf(projectDir: string, { name, eslint, oxlintConfigFile }: BuildConfigs, oxlintRuns: OxlintRuns): Promise<BuildRun> {
  const results = await eslintFor(projectDir, eslint).lintFiles([EVERYTHING])
  const linting = oxlintCliOutcomeOf(projectDir, oxlintConfigFile, oxlintRuns.paths)
  if (linting.outcome === 'refused' && !oxlintRuns.keepsRefusals) throw new Error(`oxlint could not lint with ${oxlintConfigFile}: ${linting.output}`)
  return {
    findings: [...eslintEngineFindingsIn(results, projectDir), ...(linting.outcome === 'linted' ? oxlintEngineFindingsIn(linting.run.report) : [])],
    eslintFatalMessages: fatalMessagesIn(results, projectDir).map((message) => `${name}, ${message}`),
    eslintLintedFiles: results.map((result) => projectPathOf(result.filePath, projectDir)).toSorted(),
    oxlintRefusals: linting.outcome === 'refused' ? [`${name}: ${linting.output}`] : [],
  }
}

function eslintFor(projectDir: string, eslint: string | Linter.Config[]): ESLint {
  if (typeof eslint === 'string') return new ESLint({ cwd: projectDir, overrideConfigFile: join(projectDir, eslint) })
  return new ESLint({ cwd: projectDir, overrideConfigFile: true, overrideConfig: eslint })
}

