import { foundOr } from '@workspace/rule-data/collections'
import type { ESLint, Rule } from 'eslint'
import type ts from 'typescript'
import { isRecord } from './is-record.ts'

type TypedParserServices = { readonly services: Readonly<Record<string, unknown>>; readonly program: ts.Program }

/** `base` with `own` over it, as ESLint derives each rule's context from its file's: ESLint freezes both objects. */
export function derivedFrom<Base extends object>(base: Base, own: Partial<Base>): Base {
  const derived: unknown = Object.create(base, Object.getOwnPropertyDescriptors(own))
  if (!isDerivedFrom(derived, base)) throw new Error('Object.create gave an object with another prototype')
  return derived
}

/** Refuses a plugin without rules, or without one of the rules named. */
export function pluginWithRulesReplaced(
  prefix: string,
  plugin: Readonly<ESLint.Plugin>,
  ruleNames: readonly string[],
  replacing: (rule: Readonly<Rule.RuleModule>) => Rule.RuleModule,
): ESLint.Plugin {
  const rules = foundOr(plugin.rules, `the plugin under ${prefix} has no rules`)
  const replaced = ruleNames.map((name): [string, Rule.RuleModule] => [name, replacing(foundOr(rules[name], `${prefix}/${name} is not in its plugin`))])
  return { ...plugin, rules: { ...rules, ...Object.fromEntries(replaced) } }
}

export function ruleGivenContext(rule: Readonly<Rule.RuleModule>, contextFor: (context: Readonly<Rule.RuleContext>) => Rule.RuleContext): Rule.RuleModule {
  return {
    ...rule,
    create(context) {
      return rule.create(contextFor(context))
    },
  }
}

/** Each report passed on as `reported` gives it, and dropped where that gives null. */
export function contextReporting(context: Readonly<Rule.RuleContext>, reported: (descriptor: Readonly<Rule.ReportDescriptor>) => Rule.ReportDescriptor | null): Rule.RuleContext {
  return derivedFrom(context, {
    // eslint-disable-next-line functional/no-return-void -- RuleContext types report as returning void and ESLint reads nothing it returns: this hands the report on, or drops it, with nothing to give back
    report(descriptor) {
      const descriptorReported = reported(descriptor)
      if (descriptorReported !== null) context.report(descriptorReported)
    },
  })
}

/** Null where the file has no type information. */
export function typedParserServicesOf({ sourceCode }: Readonly<Rule.RuleContext>): TypedParserServices | null {
  const services: unknown = sourceCode.parserServices
  const program = isRecord(services) ? services.program : null
  if (!isRecord(services) || !isProgram(program)) return null
  return { services, program }
}

export function programWithChecker(program: ts.Program, checker: ts.TypeChecker): ts.Program {
  return derivedFrom(program, {
    getTypeChecker() {
      return checker
    },
  })
}

/** Parse boundary: typescript-eslint's parser services, which ESLint types as `any`. */
function isProgram(value: unknown): value is ts.Program {
  return isRecord(value) && typeof value.getTypeChecker === 'function'
}

function isDerivedFrom<Base extends object>(value: unknown, base: Base): value is Base {
  return Object.getPrototypeOf(value) === base
}
