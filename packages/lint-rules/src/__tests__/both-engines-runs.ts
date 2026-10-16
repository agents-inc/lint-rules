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

/** The rulesets our part lists, by set: none unless given. */
type OurRulesets = Parameters<typeof buildConsumerLintRules>[1]

/** A consumer's project: its sources, our settings, and the team's two configs. */
export type BothEnginesProject = {
  readonly sources: ProjectFiles
  readonly ourRulesets?: OurRulesets
  readonly ours: OurFields
  /** The rules the team's ESLint config turns on in every file it lints, its .vue, .svelte and .astro files included. */
  readonly teamEslintRules: TeamEslintRules
  /** The extensions of the JS and TS files the team's ESLint config lints: .js and .ts unless given. */
  readonly teamJsAndTsExtensions?: readonly string[]
  /** The block of global ignores the team's ESLint config gives, which may take files back from ESLint's default ignores: none unless given. */
  readonly teamEslintGlobalIgnores?: TeamGlobalIgnoresBlock
  readonly teamOxlintConfig: OxlintConfig
  /** Whether a config of ours oxlint refuses to load is kept as a refusal, its findings none: unless given, the runs fail. */
  readonly keepsOxlintRefusals?: true
  /**
   * Whether the oxlint CLI is given each source file, as an editor gives it the file it opens, rather
   * than the project's folder, whose walk skips every .git folder (measured, oxlint 1.87): unless
   * given, the folder.
   */
  readonly oxlintGivenEachSourceFile?: true
}

/** What both engines report over the whole project with each build. */
export type BothEnginesRuns = {
  /** The agent build of our settings, suppressions allowed as the editor set allows them: our part alone. */
  readonly agent: readonly EngineFinding[]
  /** Our editor parts, through the built package, merged into a team ESLint config with no block and a team oxlint config turning nothing on. */
  readonly mergedIntoEmptyTeamConfigs: readonly EngineFinding[]
  /** Our editor parts, through the built package, merged into the team's two configs. */
  readonly mergedIntoTheTeamsConfigs: readonly EngineFinding[]
  /** The team's two configs alone. */
  readonly teamAlone: readonly EngineFinding[]
  /** `run, file: message` for every fatal ESLint message, a parse error included, in every ESLint run. */
  readonly eslintFatalMessages: readonly string[]
  /** As `eslintFatalMessages`, by build: for a test that reads some builds alone. */
  readonly eslintFatalMessagesInEachBuild: Readonly<Record<BuildName, readonly string[]>>
  /** The files each ESLint run lints, sorted: every file it gives a result for. */
  readonly eslintLintedFiles: Readonly<Record<BuildName, readonly string[]>>
  /** `run: what oxlint printed` for each config oxlint refused to load, where the project keeps refusals. */
  readonly oxlintRefusals: readonly string[]
}

/** Each build both engines lint the project with. */
export type BuildName = 'agent' | 'mergedIntoEmptyTeamConfigs' | 'mergedIntoTheTeamsConfigs' | 'teamAlone'

/** The configs of one build, by engine: an ESLint config file or its blocks, and an oxlint config file. */
type BuildConfigs = { readonly name: string; readonly eslint: string | Linter.Config[]; readonly oxlintConfigFile: string }

/** How the oxlint CLI is run in every build: the paths it is given, and whether a config it refuses is kept as a refusal. */
type OxlintRuns = { readonly paths: readonly string[]; readonly keepsRefusals: boolean }

/** What both engines report with one build. */
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

/**
 * Makes the project before the suite, with the built package, oxlint and typescript-eslint installed,
 * and lints all of it with each build, by the real oxlint CLI and the real ESLint Node API: the agent
 * build of our settings, laid out by the source as `check` will lay it out; and, through the built
 * package as a consumer loads it, our editor parts merged into empty team configs and into the
 * team's, and the team's alone. Call it at the top of a describe block: it registers that scope's
 * hooks.
 */
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

/** How the project's oxlint runs are made, the same in every build. */
function oxlintRunsFor({ sources, keepsOxlintRefusals, oxlintGivenEachSourceFile }: BothEnginesProject): OxlintRuns {
  return { paths: oxlintGivenEachSourceFile === true ? Object.keys(sources) : [EVERYTHING], keepsRefusals: keepsOxlintRefusals === true }
}

/** Our settings in the project, with suppressions allowed, as the editor set always allows them, so the agent build states its rules. */
function lintRulesOf(projectDir: string, { ourRulesets = {}, ours }: BothEnginesProject): LintRules {
  return buildConsumerLintRules(projectDir, ourRulesets, { ...ours, allowSuppressions: true })
}

/** agents-inc.lint.mts, the team's ESLint config modules, and each config file the built package is loaded through. */
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

/**
 * Both engines over the whole project with the build's configs: ESLint first, in this process, then
 * the oxlint CLI, given the paths its runs are given. A config oxlint refuses fails the run, or,
 * where refusals are kept, reports nothing.
 */
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

/** ESLint with a config file of the project, as `eslint -c` loads it, or with the blocks given. */
function eslintFor(projectDir: string, eslint: string | Linter.Config[]): ESLint {
  if (typeof eslint === 'string') return new ESLint({ cwd: projectDir, overrideConfigFile: join(projectDir, eslint) })
  return new ESLint({ cwd: projectDir, overrideConfigFile: true, overrideConfig: eslint })
}

