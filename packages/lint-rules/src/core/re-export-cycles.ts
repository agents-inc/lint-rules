import { foundOr } from '@workspace/rule-data/collections'
import type { ESLint, Rule } from 'eslint'
import ts from 'typescript'
import { isRecord } from './is-record.ts'

const TYPESCRIPT_ESLINT = '@typescript-eslint'
// Each follows re-exports with no record of where it has been (typescript-eslint 8.71): a cycle hangs no-deprecated, overflows consistent-type-exports.
const RULES_FOLLOWING_RE_EXPORTS: readonly string[] = ['consistent-type-exports', 'no-deprecated']

/** typescript-eslint's plugin, its rules that follow re-exports given a checker that ends a chain where it loops; any other plugin as it is. */
export function withReExportCyclesCut(prefix: string, plugin: ESLint.Plugin): ESLint.Plugin {
  if (prefix !== TYPESCRIPT_ESLINT) return plugin
  const rules = foundOr(plugin.rules, `the plugin under ${prefix} has no rules`)
  const cut = RULES_FOLLOWING_RE_EXPORTS.map((name): [string, Rule.RuleModule] => [name, cuttingReExportCycles(ruleNamed(rules, name))])
  return { ...plugin, rules: { ...rules, ...Object.fromEntries(cut) } }
}

/** Steps through a re-export as the checker does, but past none that leads back to one already passed. */
export function checkerCuttingReExportCycles(checker: ts.TypeChecker): ts.TypeChecker {
  return derivedFrom(checker, {
    getImmediateAliasedSymbol: (symbol) => (aliasChainLoops(checker, symbol, new Set()) ? undefined : checker.getImmediateAliasedSymbol(symbol)),
  })
}

function ruleNamed(rules: NonNullable<ESLint.Plugin['rules']>, name: string): Rule.RuleModule {
  return foundOr(rules[name], `${TYPESCRIPT_ESLINT}/${name} is not in its plugin`)
}

function cuttingReExportCycles(rule: Rule.RuleModule): Rule.RuleModule {
  return { ...rule, create: (context) => rule.create(contextCuttingReExportCycles(context)) }
}

/** A file with no type information keeps its context: the rule reports that itself. */
function contextCuttingReExportCycles(context: Rule.RuleContext): Rule.RuleContext {
  const { sourceCode } = context
  const services: unknown = sourceCode.parserServices
  const program = isRecord(services) ? services['program'] : null
  if (!isRecord(services) || !isProgram(program)) return context
  const checker = checkerCuttingReExportCycles(program.getTypeChecker())
  const programCutting = derivedFrom(program, { getTypeChecker: () => checker })
  return derivedFrom(context, { sourceCode: derivedFrom(sourceCode, { parserServices: { ...services, program: programCutting } }) })
}

function aliasChainLoops(checker: ts.TypeChecker, symbol: ts.Symbol | undefined, passed: ReadonlySet<ts.Symbol>): boolean {
  if (symbol === undefined || !isAnAliasToStepThrough(symbol)) return false
  if (passed.has(symbol)) return true
  return aliasChainLoops(checker, checker.getImmediateAliasedSymbol(symbol), new Set([...passed, symbol]))
}

/** The rules step through an alias only where it has declarations, without which the checker throws. */
function isAnAliasToStepThrough(symbol: ts.Symbol): boolean {
  return (symbol.flags & ts.SymbolFlags.Alias) !== 0 && symbol.getDeclarations() !== undefined
}

/** Parse boundary: typescript-eslint's parser services, which ESLint types as `any`. */
function isProgram(value: unknown): value is ts.Program {
  return isRecord(value) && typeof value['getTypeChecker'] === 'function'
}

/** `base` with `own` over it, as ESLint derives each rule's context from its file's: ESLint freezes both objects. */
function derivedFrom<Base extends object>(base: Base, own: Partial<Base>): Base {
  const derived: unknown = Object.create(base, Object.getOwnPropertyDescriptors(own))
  if (!isDerivedFrom(derived, base)) throw new Error('Object.create gave an object with another prototype')
  return derived
}

function isDerivedFrom<Base extends object>(value: unknown, base: Base): value is Base {
  return Object.getPrototypeOf(value) === base
}
