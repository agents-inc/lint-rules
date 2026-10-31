import { foundOr } from '@workspace/rule-data/collections'
import type { ESLint, Rule } from 'eslint'
import { isRecord } from './is-record.ts'
import { derivedFrom } from './typed-rule-contexts.ts'

const SONARJS = 'sonarjs'
const PREFER_IMMEDIATE_RETURN = 'prefer-immediate-return'
const PREFER_IMMEDIATE_RETURN_ID = `${SONARJS}/${PREFER_IMMEDIATE_RETURN}`
// Its fix moves the value into the return or throw, which drops the `using` and the disposal with it (sonarjs 4.2.2);
// unicorn/no-using-resource-escape reports a returned one instead.
const USING_KINDS: ReadonlySet<unknown> = new Set(['using', 'await using'])

/** sonarjs' plugin, its prefer-immediate-return silent on a returned or thrown variable that a `using` declaration holds; any other plugin as it is. */
export function withReturnedUsingResourcesLeftAlone(prefix: string, plugin: Readonly<ESLint.Plugin>): ESLint.Plugin {
  if (prefix !== SONARJS) return plugin
  const rules = foundOr(plugin.rules, `the plugin under ${prefix} has no rules`)
  const rule = foundOr(rules[PREFER_IMMEDIATE_RETURN], `${PREFER_IMMEDIATE_RETURN_ID} is not in its plugin`)
  return { ...plugin, rules: { ...rules, [PREFER_IMMEDIATE_RETURN]: leavingReturnedUsingResourcesAlone(rule) } }
}

function leavingReturnedUsingResourcesAlone(rule: Readonly<Rule.RuleModule>): Rule.RuleModule {
  return {
    ...rule,
    create(context) {
      return rule.create(contextLeavingReturnedUsingResourcesAlone(context))
    },
  }
}

function contextLeavingReturnedUsingResourcesAlone(context: Readonly<Rule.RuleContext>): Rule.RuleContext {
  return derivedFrom(context, {
    // eslint-disable-next-line functional/no-return-void -- RuleContext types report as returning void and ESLint reads nothing it returns: this hands the report on, or drops it, with nothing to give back
    report(descriptor) {
      if (!isHeldByUsing(valueReported(descriptor))) context.report(descriptor)
    },
  })
}

function valueReported(descriptor: Readonly<Rule.ReportDescriptor>): unknown {
  return 'node' in descriptor ? descriptor.node : null
}

// The rule reports the value a declarator gives (sonarjs 4.2.2).
function isHeldByUsing(value: unknown): boolean {
  const declarator = parentOf(value)
  const declaration = parentOf(declarator)
  return USING_KINDS.has(declaration.kind)
}

/** Parse boundary: ESLint types a reported node as an element of any language it lints, with no parent. */
function parentOf(node: unknown): Readonly<Record<string, unknown>> {
  const parent = isRecord(node) ? node.parent : null
  if (isRecord(parent)) return parent
  throw new Error(`${PREFER_IMMEDIATE_RETURN_ID} reported something other than the value a declarator gives`)
}
