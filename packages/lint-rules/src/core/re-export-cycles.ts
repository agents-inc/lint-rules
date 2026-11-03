import type { ESLint, Rule } from 'eslint'
import ts from 'typescript'
import { derivedFrom, pluginWithRulesReplaced, programWithChecker, ruleGivenContext, typedParserServicesOf } from './typed-rule-contexts.ts'

const TYPESCRIPT_ESLINT = '@typescript-eslint'
// Each follows re-exports with no record of where it has been (typescript-eslint 8.71): a cycle hangs no-deprecated, overflows consistent-type-exports.
const RULES_FOLLOWING_RE_EXPORTS: readonly string[] = ['consistent-type-exports', 'no-deprecated']

/** typescript-eslint's plugin, its rules that follow re-exports given a checker that ends a chain where it loops; any other plugin as it is. */
export function withReExportCyclesCut(prefix: string, plugin: Readonly<ESLint.Plugin>): ESLint.Plugin {
  if (prefix !== TYPESCRIPT_ESLINT) return plugin
  return pluginWithRulesReplaced(prefix, plugin, RULES_FOLLOWING_RE_EXPORTS, cuttingReExportCycles)
}

/** Steps through a re-export as the checker does, but past none that leads back to one already passed. */
export function checkerCuttingReExportCycles(checker: ts.TypeChecker): ts.TypeChecker {
  return derivedFrom(checker, {
    getImmediateAliasedSymbol(symbol) {
      return aliasChainLoops(checker, symbol, new Set()) ? undefined : checker.getImmediateAliasedSymbol(symbol)
    },
  })
}

function cuttingReExportCycles(rule: Readonly<Rule.RuleModule>): Rule.RuleModule {
  return ruleGivenContext(rule, contextCuttingReExportCycles)
}

/** A file with no type information keeps its context: the rule reports that itself. */
function contextCuttingReExportCycles(context: Readonly<Rule.RuleContext>): Rule.RuleContext {
  const typed = typedParserServicesOf(context)
  if (typed === null) return context
  const programCutting = programWithChecker(typed.program, checkerCuttingReExportCycles(typed.program.getTypeChecker()))
  return derivedFrom(context, { sourceCode: derivedFrom(context.sourceCode, { parserServices: { ...typed.services, program: programCutting } }) })
}

function aliasChainLoops(checker: ts.TypeChecker, symbol: Readonly<ts.Symbol> | undefined, passed: ReadonlySet<ts.Symbol>): boolean {
  if (symbol === undefined || !isAnAliasToStepThrough(symbol)) return false
  if (passed.has(symbol)) return true
  return aliasChainLoops(checker, checker.getImmediateAliasedSymbol(symbol), new Set([...passed, symbol]))
}

/** The rules step through an alias only where it has declarations, without which the checker throws. */
function isAnAliasToStepThrough(symbol: Readonly<ts.Symbol>): boolean {
  return (symbol.flags & ts.SymbolFlags.Alias) !== 0 && symbol.getDeclarations() !== undefined
}
