// Run by eslint-in-its-own-process.ts as a Node process of its own, never imported. typescript-eslint
// keeps one project service per process, set up by the first config it parses, so a test linting
// several projects in one process lints all but the first with that one's setup (spec-core.md C9).
// This process lints one project, as `check` and a consumer's ESLint run do: from its cwd, it defines
// the lint rules given and lints every file with ESLint's Node API, stats on, first with the agent
// build, then with our ESLint part merged into an empty team config, beside the team's oxlint config
// file given. Prints `{ "agent": [...], "editor": [...] }`, each result the file, its messages, and
// every rule that ran on it.
//
//   node eslint-build-process.ts <lint rules JSON> [<team oxlint config file>]
import { ESLint, type Linter } from 'eslint'
import { buildAgentConfigs } from '../agent-configs.ts'
import { agentSettingsOf } from '../agent-settings.ts'
import { mergeEslintConfig } from '../eslint.ts'
import { defineLintRules, type LintRules } from '../index.ts'
import type { EslintProcessResult, EslintResultsByBuild } from './eslint-in-its-own-process.ts'

const [lintRulesJson, teamOxlintConfigFile] = process.argv.slice(2)
if (lintRulesJson === undefined) throw new Error('usage: eslint-build-process.ts <lint rules JSON> [<team oxlint config file>]')

// Parse boundary: the lint rules the test serialised.
const { eslint } = defineLintRules(JSON.parse(lintRulesJson) as LintRules).editorRulesets
const byBuild: EslintResultsByBuild = {
  agent: await resultsWith(buildAgentConfigs(agentSettingsOf(eslint)).eslint),
  editor: await resultsWith(mergeEslintConfig([], eslint, { oxlintConfig: teamOxlintConfigFile ?? null })),
}
process.stdout.write(JSON.stringify(byBuild))

async function resultsWith(config: Linter.Config[]): Promise<EslintProcessResult[]> {
  // Stats record which rules ran on each file.
  const results = await new ESLint({ cwd: process.cwd(), overrideConfigFile: true, overrideConfig: config, stats: true }).lintFiles(['.'])
  return results.map(printedResultOf)
}

function printedResultOf({ filePath, messages, stats }: ESLint.LintResult): EslintProcessResult {
  if (stats === undefined) throw new Error(`ESLint ran without stats on ${filePath}`)
  return {
    filePath,
    messages: messages.map(({ ruleId, fatal, message, line }) => ({ ruleId, fatal, message, line })),
    rulesRun: [...new Set(stats.times.passes.flatMap((pass) => Object.keys(pass.rules ?? {})))].toSorted(),
  }
}
