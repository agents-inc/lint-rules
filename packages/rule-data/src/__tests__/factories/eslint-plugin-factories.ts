import type { ESLint, Rule } from 'eslint'

const doNothingRule: Rule.RuleModule = { create: () => ({}) }

/** A plugin of rules that report nothing: what the registry's load-time check accepts. */
export function buildRulesPlugin(ruleNames: readonly string[]): ESLint.Plugin {
  return { rules: Object.fromEntries(ruleNames.map((ruleName) => [ruleName, doNothingRule])) }
}

/** A rule module that reports nothing, of its own: each call gives another object. */
export function buildRuleModule(): Rule.RuleModule {
  return { create: () => ({}) }
}

/**
 * A plugin binding each group of rule names to one module of its own, as @eslint-react binds
 * `x-no-missing-key` and `no-missing-key`: the names of one group are one rule, those of two
 * groups two rules.
 */
export function buildPluginBindingModules(nameGroups: readonly (readonly string[])[]): ESLint.Plugin {
  return { rules: Object.fromEntries(rulesBindingModules(nameGroups)) }
}

/** ESLint's core rules as `builtinRules` holds them, each group of names bound to one module of its own. */
export function buildCoreRulesBindingModules(nameGroups: readonly (readonly string[])[]): ReadonlyMap<string, Rule.RuleModule> {
  return new Map(rulesBindingModules(nameGroups))
}

function rulesBindingModules(nameGroups: readonly (readonly string[])[]): [string, Rule.RuleModule][] {
  return nameGroups.flatMap((names) => {
    const ruleModule = buildRuleModule()
    return names.map((name): [string, Rule.RuleModule] => [name, ruleModule])
  })
}

/** A module export the load-time check must refuse: no rules at all. */
export function buildPluginWithoutRules(): Readonly<Record<string, unknown>> {
  return { meta: { name: 'no-rules' } }
}

/** A module export the load-time check must refuse: a rule with no `create`. */
export function buildPluginWithRuleWithoutCreate(ruleName: string): Readonly<Record<string, unknown>> {
  return { rules: { [ruleName]: { meta: { schema: [] } } } }
}
