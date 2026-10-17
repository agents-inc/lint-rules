import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { OxlintConfig } from 'oxlint'
import { defineLintRules, type LintRules } from '../index.ts'
import { agentConfigsOf } from './agent-configs.ts'
import { type EslintCliResult, type OxlintCliOutcome, oxlintCliOutcomeOf, writeOxlintConfigFile } from './engine-clis.ts'
import { runNodeScript } from './node-process.ts'
import { setUpRunsBeforeTheSuite } from './runs-before-the-suite.ts'
import type { TempProject } from './temp-projects.ts'

/** `editor`: our ESLint part merged into an empty team config. */
export type EslintBuild = 'agent' | 'editor'

/** As eslint-build-process.ts prints it. */
export type EslintProcessResult = EslintCliResult & { readonly rulesRun: readonly string[] }

export type EslintResultsByBuild = { readonly [build in EslintBuild]: readonly EslintProcessResult[] }

export type EslintRunsInItsOwnProcess = {
  /** ESLint's cwd: every path below is relative to it. */
  readonly rootDir: string
  readonly eslint: EslintResultsByBuild
  readonly agentOxlint: OxlintCliOutcome | null
}

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
* Lints the project with both builds, ESLint in a process of its own: typescript-eslint keeps one project
* service per process, set by the first config it parses. Registers hooks: call it in a describe block.
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

/** Throws where it was not asked for. */
export function agentOxlintOf({ agentOxlint, rootDir }: EslintRunsInItsOwnProcess): OxlintCliOutcome {
  if (agentOxlint === null) throw new Error(`oxlint was not asked to run the agent build's config over ${rootDir}`)
  return agentOxlint
}

/** From ESLint's stats: none when the file failed to parse. */
export function rulesRunOn({ eslint, rootDir }: EslintRunsInItsOwnProcess, build: EslintBuild, file: string): readonly string[] {
  return resultFor(eslint[build], rootDir, file).rulesRun
}

/** Null for ESLint's own messages, parse errors included. */
export function ruleIdsOn({ eslint, rootDir }: EslintRunsInItsOwnProcess, build: EslintBuild, file: string): (string | null)[] {
  return resultFor(eslint[build], rootDir, file).messages.map(({ ruleId }) => ruleId)
}

function resultFor(results: readonly EslintProcessResult[], rootDir: string, file: string): EslintProcessResult {
  const result = results.find(({ filePath }) => filePath === join(rootDir, file))
  if (result === undefined) throw new Error(`ESLint did not lint ${file}`)
  return result
}

function eslintResultsInItsOwnProcess(rootDir: string, lintRules: LintRules, teamOxlintConfig: OxlintConfig | null): EslintResultsByBuild {
  const stdout = runNodeScript(ESLINT_BUILD_PROCESS, [JSON.stringify(lintRules), ...teamOxlintConfigArgument(rootDir, teamOxlintConfig)], {
    cwd: rootDir,
    timeoutMs: PROCESS_TIMEOUT_MS,
    whatFailed: `ESLint's process failed in ${rootDir}`,
  })
  // Parse boundary: what eslint-build-process.ts printed.
  return JSON.parse(stdout) as EslintResultsByBuild
}

/** None where the project lists no oxlint. */
function teamOxlintConfigArgument(rootDir: string, teamOxlintConfig: OxlintConfig | null): string[] {
  if (teamOxlintConfig === null) return []
  writeOxlintConfigFile(rootDir, TEAM_OXLINT_CONFIG_FILE, teamOxlintConfig)
  return [TEAM_OXLINT_CONFIG_FILE]
}

/** Built here, where nothing is parsed with type information. */
function oxlintRunOfTheAgentBuild(rootDir: string, lintRules: LintRules): OxlintCliOutcome {
  writeOxlintConfigFile(rootDir, AGENT_OXLINT_CONFIG_FILE, agentConfigsOf(defineLintRules(lintRules)).oxlint)
  return oxlintCliOutcomeOf(rootDir, AGENT_OXLINT_CONFIG_FILE)
}
