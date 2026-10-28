// Run by eslint-in-its-own-process.ts as a Node process of its own, never imported: typescript-eslint keeps one
// project service per process, set by the first config it parses. Lints every file from its cwd with the agent
// build, then our ESLint part merged into an empty team config. Prints `{ "agent": [...], "editor": [...] }`.
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

async function resultsWith(config: readonly Linter.Config[]): Promise<EslintProcessResult[]> {
  // Stats record which rules ran on each file.
  const results = await new ESLint({ cwd: process.cwd(), overrideConfigFile: true, overrideConfig: [...config], stats: true }).lintFiles(['.'])
  return results.map(printedResultOf)
}

function printedResultOf({ filePath, messages, stats }: Readonly<ESLint.LintResult>): EslintProcessResult {
  if (stats === undefined) throw new Error(`ESLint ran without stats on ${filePath}`)
  return {
    filePath,
    messages: messages.map(({ ruleId, fatal, message, line }) => ({ ruleId, fatal, message, line })),
    rulesRun: [...new Set(stats.times.passes.flatMap((pass) => Object.keys(pass.rules ?? {})))].toSorted(),
  }
}
