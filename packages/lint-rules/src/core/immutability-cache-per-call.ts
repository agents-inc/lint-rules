import type { ESLint, Rule, SourceCode } from 'eslint'
import type ts from 'typescript'
import { isRecord } from './is-record.ts'
import { readOnce } from './read-once.ts'
import { derivedFrom, pluginWithRulesReplaced, programWithChecker, ruleGivenContext, typedParserServicesOf } from './typed-rule-contexts.ts'

const FUNCTIONAL = 'functional'
// is-immutable-type (5.0.4, its issue #625) keeps each answer for the whole process under checker.getRecursionIdentity(type),
// which every instantiation of one generic shares (Pick, Omit, Partial, Required): the first answered decides the rest.
const RULE_ASKING_IS_IMMUTABLE_TYPE = 'prefer-immutable-types'

/** A checker with the getRecursionIdentity TypeScript's d.ts leaves out (6.0), by which is-immutable-type keys its cache. */
type CheckerIdentifyingRecursion = ts.TypeChecker & { readonly getRecursionIdentity: (type: Readonly<ts.Type>) => object }

/** functional's plugin, its prefer-immutable-types given a checker of its own each time it asks about a type; any other plugin as it is. */
export function withImmutabilityCachedPerCall(prefix: string, plugin: Readonly<ESLint.Plugin>): ESLint.Plugin {
  if (prefix !== FUNCTIONAL) return plugin
  return pluginWithRulesReplaced(prefix, plugin, [RULE_ASKING_IS_IMMUTABLE_TYPE], cachingPerCall)
}

/** Maps each recursion identity the checker gives to a token of its own, so nothing cached under one outlives this checker. */
export function checkerWithRecursionIdentitiesOfItsOwn(checker: ts.TypeChecker): CheckerIdentifyingRecursion {
  const identifying = identifyingRecursion(checker)
  const tokens = new WeakMap<object, object>()
  return derivedFrom(identifying, {
    getRecursionIdentity(type) {
      return readOnce(tokens, identifying.getRecursionIdentity(type), aTokenOfItsOwn)
    },
  })
}

function cachingPerCall(rule: Readonly<Rule.RuleModule>): Rule.RuleModule {
  return ruleGivenContext(rule, contextCachingPerCall)
}

/** A file with no type information keeps its context: the rule reports that itself. */
function contextCachingPerCall(context: Readonly<Rule.RuleContext>): Rule.RuleContext {
  const typed = typedParserServicesOf(context)
  if (typed === null) return context
  return derivedFrom(context, { sourceCode: sourceCodeWithACheckerPerRead(context.sourceCode, typed.services, typed.program) })
}

/** The rule reads the parser services anew each time it asks is-immutable-type about a type, so each read gives a program with a checker of its own. */
function sourceCodeWithACheckerPerRead(sourceCode: Readonly<SourceCode>, services: Readonly<Record<string, unknown>>, program: ts.Program): SourceCode {
  return derivedFrom(sourceCode, {
    get parserServices() {
      return { ...services, program: programWithCheckerOfItsOwn(program) }
    },
  })
}

function programWithCheckerOfItsOwn(program: ts.Program): ts.Program {
  return programWithChecker(program, checkerWithRecursionIdentitiesOfItsOwn(program.getTypeChecker()))
}

function identifyingRecursion(checker: ts.TypeChecker): CheckerIdentifyingRecursion {
  if (!isIdentifyingRecursion(checker)) throw new Error("TypeScript's checker has no getRecursionIdentity, by which is-immutable-type keys its cache")
  return checker
}

/** Parse boundary: TypeScript's checker carries getRecursionIdentity, which its d.ts leaves out. */
function isIdentifyingRecursion(checker: ts.TypeChecker): checker is CheckerIdentifyingRecursion {
  return isRecord(checker) && typeof checker.getRecursionIdentity === 'function'
}

function aTokenOfItsOwn(): object {
  return {}
}
