import { eslintPlugins } from '@workspace/rule-data/eslint-plugins'
import type { Linter } from 'eslint'
import type { OxlintConfig } from 'oxlint'
import type { EslintPluginRegistry } from '../core/build-eslint-config.ts'
import type { EslintConfigOracle } from './eslint-config-oracle.ts'
import { pluginRegisteredUnder } from './eslint-config-reads.ts'
import { oxlintEntryOfRuleFor, severityOfOxlintEntry } from './oxlint-config-oracle.ts'

/** What a rule runs with where no statement that applies sets it, or the one deciding sets it off. */
export const NOT_RUN = 'not run'

type RunningSeverity = Exclude<Linter.StringSeverity, 'off'>

type EslintRuleReads = Pick<EslintConfigOracle, 'ruleEntryFor' | 'ruleSeverityFor'>

/** NOT_RUN where no statement that applies sets the rule, or it is off. */
export function runningSeverityOf(severity: Linter.StringSeverity | undefined): RunningSeverity | typeof NOT_RUN {
  return isRunningAt(severity) ? severity : NOT_RUN
}

/** As ESLint calculates it for the file, options filled in: NOT_RUN where no block sets the rule, or it is off. */
export async function eslintRunningEntryFor(oracle: Readonly<EslintRuleReads>, config: readonly Linter.Config[], file: string, ruleId: string): Promise<unknown> {
  return isRunningAt(await oracle.ruleSeverityFor(config, file, ruleId)) ? oracle.ruleEntryFor(config, file, ruleId) : NOT_RUN
}

/** Under any of the rule's spellings given: NOT_RUN where no statement of it applies, or it is off. */
export function oxlintRunningEntryOfRuleFor(config: Readonly<OxlintConfig>, file: string, spellings: readonly string[]): unknown {
  const entry = oxlintEntryOfRuleFor(config, file, spellings)
  return entry !== undefined && isRunningAt(severityOfOxlintEntry(entry)) ? entry : NOT_RUN
}

/** The real typescript-eslint plugin, whose rules refuse options they do not take. */
export function realTypescriptEslintPlugin(): EslintPluginRegistry {
  return { '@typescript-eslint': pluginRegisteredUnder(eslintPlugins, '@typescript-eslint') }
}

function isRunningAt(severity: Linter.StringSeverity | undefined): severity is RunningSeverity {
  return severity !== undefined && severity !== 'off'
}
