import { foundOr } from '@workspace/rule-data/collections'
import type { ESLint, Rule } from 'eslint'
import { WITHHELD_FIXES } from '../cli/check/withheld-fixes.ts'
import { ruleNamesByPrefix } from './build-eslint-config.ts'
import { derivedFrom } from './typed-rule-contexts.ts'

/** Each rule our blocks run whose fix check withholds, reporting with no fix and no suggestion: an editor's quick-fix menu lists no rewrite for it, and fix-on-save leaves its line. */
export function withWithheldFixesLeftOut(plugins: ReadonlyMap<string, ESLint.Plugin>, ruleIdsRun: readonly string[]): ReadonlyMap<string, ESLint.Plugin> {
  const withheldByPrefix = ruleNamesByPrefix(ruleIdsRun.filter((ruleId) => WITHHELD_FIXES.has(ruleId)))
  const pluginsReportingNoRewrite = [...withheldByPrefix].map(([prefix, ruleNames]) => pluginReportingNoRewriteFor(plugins, prefix, ruleNames))
  return new Map([...plugins, ...pluginsReportingNoRewrite])
}

function pluginReportingNoRewriteFor(plugins: ReadonlyMap<string, ESLint.Plugin>, prefix: string, ruleNames: readonly string[]): [string, ESLint.Plugin] {
  const plugin = foundOr(plugins.get(prefix), `no plugin under ${prefix}, which runs ${ruleNames.join(', ')}`)
  const rules = foundOr(plugin.rules, `the plugin under ${prefix} has no rules`)
  const rulesReportingNoRewrite = ruleNames.map((ruleName): [string, Rule.RuleModule] => [ruleName, reportingNoRewrite(foundOr(rules[ruleName], `${prefix}/${ruleName} is not in its plugin`))])
  return [prefix, { ...plugin, rules: { ...rules, ...Object.fromEntries(rulesReportingNoRewrite) } }]
}

function reportingNoRewrite(rule: Readonly<Rule.RuleModule>): Rule.RuleModule {
  return {
    ...rule,
    create(context) {
      return rule.create(contextReportingNoRewrite(context))
    },
  }
}

function contextReportingNoRewrite(context: Readonly<Rule.RuleContext>): Rule.RuleContext {
  return derivedFrom(context, {
    // eslint-disable-next-line functional/no-return-void -- RuleContext types report as returning void and ESLint reads nothing it returns: this hands the report on, with nothing to give back
    report(descriptor) {
      context.report({ ...descriptor, fix: null, suggest: null })
    },
  })
}
