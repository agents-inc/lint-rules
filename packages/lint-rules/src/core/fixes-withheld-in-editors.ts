import { foundOr } from '@workspace/rule-data/collections'
import type { ESLint, Rule } from 'eslint'
import { WITHHELD_FIXES } from '../cli/check/withheld-fixes.ts'
import { ruleNamesByPrefix } from './build-eslint-config.ts'
import { contextReporting, pluginWithRulesReplaced, ruleGivenContext } from './typed-rule-contexts.ts'

/** Each rule our blocks run whose fix check withholds, reporting with no fix and no suggestion: an editor's quick-fix menu lists no rewrite for it, and fix-on-save leaves its line. */
export function withWithheldFixesLeftOut(plugins: ReadonlyMap<string, ESLint.Plugin>, ruleIdsRun: readonly string[]): ReadonlyMap<string, ESLint.Plugin> {
  const withheldByPrefix = ruleNamesByPrefix(ruleIdsRun.filter((ruleId) => WITHHELD_FIXES.has(ruleId)))
  const pluginsReportingNoRewrite = [...withheldByPrefix].map(([prefix, ruleNames]) => pluginReportingNoRewriteFor(plugins, prefix, ruleNames))
  return new Map([...plugins, ...pluginsReportingNoRewrite])
}

function pluginReportingNoRewriteFor(plugins: ReadonlyMap<string, ESLint.Plugin>, prefix: string, ruleNames: readonly string[]): [string, ESLint.Plugin] {
  const plugin = foundOr(plugins.get(prefix), `no plugin under ${prefix}, which runs ${ruleNames.join(', ')}`)
  return [prefix, pluginWithRulesReplaced(prefix, plugin, ruleNames, reportingNoRewrite)]
}

function reportingNoRewrite(rule: Readonly<Rule.RuleModule>): Rule.RuleModule {
  return ruleGivenContext(rule, (context) => contextReporting(context, withNoRewrite))
}

function withNoRewrite(descriptor: Readonly<Rule.ReportDescriptor>): Rule.ReportDescriptor {
  return { ...descriptor, fix: null, suggest: null }
}
