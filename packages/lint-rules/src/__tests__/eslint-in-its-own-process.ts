import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { OxlintConfig } from 'oxlint'
import { defineLintRules, type LintRules } from '../index.ts'
import { agentConfigsOf } from './agent-configs.ts'
import { setUpRunsBeforeTheSuite } from './consumer-cli-runs.ts'
import { type EslintCliResult, type OxlintCliOutcome, oxlintCliOutcomeOf, writeOxlintConfigFile } from './engine-clis.ts'
import type { TempProject } from './temp-projects.ts'

/** The two builds that lint the project: the agent build, and our ESLint part merged into an empty team config. */
export type EslintBuild = 'agent' | 'editor'

/** One file's result as eslint-build-process.ts prints it: ESLint's, and every rule that ran on the file. */
export type EslintProcessResult = EslintCliResult & { readonly rulesRun: readonly string[] }

export type EslintResultsByBuild = { readonly [build in EslintBuild]: readonly EslintProcessResult[] }

/** What linting the project gave: ESLint's results by build, and the oxlint CLI's run of the agent build's oxlint config, where asked. */
export type EslintRunsInItsOwnProcess = {
  /** tsconfigRootDir, ESLint's cwd: every path below is relative to it. */
  readonly rootDir: string
  readonly eslint: EslintResultsByBuild
  readonly agentOxlint: OxlintCliOutcome | null
}

/**
 * A project, the folder in it the consumer gives as tsconfigRootDir, the lint rules defined there,
 * the team's oxlint config the editor build merges beside, where the project lists oxlint, and
 * whether the oxlint CLI runs the agent build's oxlint config over the project too.
 */
export type ProjectLinted = {
  readonly project: TempProject
  /** Relative to the project. */
  readonly tsconfigRootDir: string
  readonly lintRulesFor: (rootDir: string) => LintRules
  readonly teamOxlintConfig: OxlintConfig | null
  readonly runsTheAgentOxlintConfig: boolean
}

const ESLINT_BUILD_PROCESS = fileURLToPath(new URL('./eslint-build-process.ts', import.meta.url))
const TEAM_OXLINT_CONFIG_FILE = 'team.oxlintrc.json'
const AGENT_OXLINT_CONFIG_FILE = '.oxlintrc.json'
const PROCESS_TIMEOUT_MS = 240_000

/**
 * Makes the project before the suite and lints it with both builds, ESLint in a Node process of its
 * own (eslint-build-process.ts): typescript-eslint keeps one project service per process, set up by
 * the first config it parses, so two projects linted in one process would share the first's
 * (spec-core.md C9). That process loads this package's source, as the tests in this one do. Where
 * asked, the oxlint CLI then runs the agent build's oxlint config over the project. Call it at the
 * top of a describe block: it registers that scope's hooks.
 */
export function setUpEslintRunsInItsOwnProcess({ project, tsconfigRootDir, lintRulesFor, teamOxlintConfig, runsTheAgentOxlintConfig }: ProjectLinted): () => EslintRunsInItsOwnProcess {
  return setUpRunsBeforeTheSuite((tempProjects) => {
    const rootDir = join(tempProjects.create(project), tsconfigRootDir)
    const lintRules = lintRulesFor(rootDir)
    return {
      rootDir,
      eslint: eslintResultsInItsOwnProcess(rootDir, lintRules, teamOxlintConfig),
      agentOxlint: runsTheAgentOxlintConfig ? oxlintRunOfTheAgentBuild(rootDir, lintRules) : null,
    }
  })
}

/** The oxlint CLI's run of the agent build's oxlint config: throws where it was not asked for. */
export function agentOxlintOf({ agentOxlint, rootDir }: EslintRunsInItsOwnProcess): OxlintCliOutcome {
  if (agentOxlint === null) throw new Error(`oxlint was not asked to run the agent build's config over ${rootDir}`)
  return agentOxlint
}

/** Every rule ESLint ran on the file in the build given, from its stats: none when the file failed to parse. */
export function rulesRunOn({ eslint, rootDir }: EslintRunsInItsOwnProcess, build: EslintBuild, file: string): readonly string[] {
  return resultFor(eslint[build], rootDir, file).rulesRun
}

/** The rule ID of each message on the file in the build given, null for ESLint's own, a parse error included. */
export function ruleIdsOn({ eslint, rootDir }: EslintRunsInItsOwnProcess, build: EslintBuild, file: string): (string | null)[] {
  return resultFor(eslint[build], rootDir, file).messages.map(({ ruleId }) => ruleId)
}

function resultFor(results: readonly EslintProcessResult[], rootDir: string, file: string): EslintProcessResult {
  const result = results.find(({ filePath }) => filePath === join(rootDir, file))
  if (result === undefined) throw new Error(`ESLint did not lint ${file}`)
  return result
}

function eslintResultsInItsOwnProcess(rootDir: string, lintRules: LintRules, teamOxlintConfig: OxlintConfig | null): EslintResultsByBuild {
  const { status, stdout, stderr } = spawnSync(process.execPath, [ESLINT_BUILD_PROCESS, JSON.stringify(lintRules), ...teamOxlintConfigArgument(rootDir, teamOxlintConfig)], {
    cwd: rootDir,
    encoding: 'utf8',
    timeout: PROCESS_TIMEOUT_MS,
  })
  if (status !== 0) throw new Error(`ESLint's process failed in ${rootDir} (exit ${String(status)}): ${stderr}`)
  // Parse boundary: what eslint-build-process.ts printed.
  return JSON.parse(stdout) as EslintResultsByBuild
}

/** The team's oxlint config, written into the project, as the editor build names it: none where the project lists no oxlint. */
function teamOxlintConfigArgument(rootDir: string, teamOxlintConfig: OxlintConfig | null): string[] {
  if (teamOxlintConfig === null) return []
  writeOxlintConfigFile(rootDir, TEAM_OXLINT_CONFIG_FILE, teamOxlintConfig)
  return [TEAM_OXLINT_CONFIG_FILE]
}

/** The agent build's oxlint config, built here, where nothing is parsed with type information, and run by the oxlint CLI over the project. */
function oxlintRunOfTheAgentBuild(rootDir: string, lintRules: LintRules): OxlintCliOutcome {
  writeOxlintConfigFile(rootDir, AGENT_OXLINT_CONFIG_FILE, agentConfigsOf(defineLintRules(lintRules)).oxlint)
  return oxlintCliOutcomeOf(rootDir, AGENT_OXLINT_CONFIG_FILE)
}
