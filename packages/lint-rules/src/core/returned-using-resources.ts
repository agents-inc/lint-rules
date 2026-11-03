import type { ESLint, Rule } from 'eslint'
import { isRecord } from './is-record.ts'
import { contextReporting, pluginWithRulesReplaced, ruleGivenContext } from './typed-rule-contexts.ts'

const SONARJS = 'sonarjs'
const PREFER_IMMEDIATE_RETURN = 'prefer-immediate-return'
const PREFER_IMMEDIATE_RETURN_ID = `${SONARJS}/${PREFER_IMMEDIATE_RETURN}`
// Its fix moves the value into the return or throw, which drops the `using` and the disposal with it (sonarjs 4.2.2);
// unicorn/no-using-resource-escape reports a returned one instead.
const USING_KINDS: ReadonlySet<unknown> = new Set(['using', 'await using'])

/** sonarjs' plugin, its prefer-immediate-return silent on a returned or thrown variable that a `using` declaration holds; any other plugin as it is. */
export function withReturnedUsingResourcesLeftAlone(prefix: string, plugin: Readonly<ESLint.Plugin>): ESLint.Plugin {
  if (prefix !== SONARJS) return plugin
  return pluginWithRulesReplaced(prefix, plugin, [PREFER_IMMEDIATE_RETURN], leavingReturnedUsingResourcesAlone)
}

function leavingReturnedUsingResourcesAlone(rule: Readonly<Rule.RuleModule>): Rule.RuleModule {
  return ruleGivenContext(rule, (context) => contextReporting(context, unlessHeldByUsing))
}

function unlessHeldByUsing(descriptor: Readonly<Rule.ReportDescriptor>): Rule.ReportDescriptor | null {
  return isHeldByUsing(valueReported(descriptor)) ? null : descriptor
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
