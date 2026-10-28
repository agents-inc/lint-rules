import type { ESLint, Rule } from 'eslint'

const doNothingRule: Rule.RuleModule = {
  create() {
    return {}
  },
}

/** A plugin of rules that report nothing: what the registry's load-time check accepts. */
export function buildRulesPlugin(ruleNames: readonly string[]): ESLint.Plugin {
  return { rules: Object.fromEntries(ruleNames.map((ruleName) => [ruleName, doNothingRule])) }
}

/** A rule module that reports nothing, of its own: each call gives another object. */
function buildRuleModule(): Rule.RuleModule {
  return {
    create() {
      return {}
    },
  }
}

/**
 * A plugin binding each group of rule names to one module of its own, as @eslint-react binds
 * `x-no-missing-key` and `no-missing-key`: the names of one group are one rule, those of two
 * groups two rules.
 */
export function buildPluginBindingModules(nameGroups: ReadonlyArray<readonly string[]>): ESLint.Plugin {
  return { rules: Object.fromEntries(rulesBindingModules(nameGroups)) }
}

/** ESLint's core rules as `builtinRules` holds them, each group of names bound to one module of its own. */
export function buildCoreRulesBindingModules(nameGroups: ReadonlyArray<readonly string[]>): ReadonlyMap<string, Rule.RuleModule> {
  return new Map(rulesBindingModules(nameGroups))
}

function rulesBindingModules(nameGroups: ReadonlyArray<readonly string[]>): Array<[string, Rule.RuleModule]> {
  return nameGroups.flatMap((names) => {
    const ruleModule = buildRuleModule()
    return names.map((name): [string, Rule.RuleModule] => [name, ruleModule])
  })
}

/** A plugin holding no rules object, as none the registry loads does: what reading its rules refuses. */
export function buildPluginHoldingNoRules(): ESLint.Plugin {
  return { meta: { name: 'no-rules' } }
}

/** A module export the load-time check must refuse: no rules at all. */
export function buildPluginWithoutRules(): Readonly<Record<string, unknown>> {
  return { meta: { name: 'no-rules' } }
}

/** A module export the load-time check must refuse: a rule with no `create`. */
export function buildPluginWithRuleWithoutCreate(ruleName: string): Readonly<Record<string, unknown>> {
  return { rules: { [ruleName]: { meta: { schema: [] } } } }
}

/** A module export the load-time check must refuse: a rule with no `create`, beside a rule of the plugin that has one. */
export function buildPluginWithRuleWithoutCreateBesideOneWith(ruleWithout: string, ruleWith: string): Readonly<Record<string, unknown>> {
  return { rules: { [ruleWith]: buildRuleModule(), [ruleWithout]: { meta: { schema: [] } } } }
}

/** A module export the load-time check must refuse: a rule whose `create` is no function. */
export function buildPluginWithRuleWhoseCreateIsNoFunction(ruleName: string): Readonly<Record<string, unknown>> {
  return { rules: { [ruleName]: { create: { listeners: {} } } } }
}
