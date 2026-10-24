import ts from 'typescript'
import { enclosingFunctionNameOf, nodesUnder } from './repo-programs.ts'

// The calls that split a string at a separator, or find where to cut it.
const CUTTING_METHODS: ReadonlySet<string> = new Set(['split', 'indexOf', 'lastIndexOf'])
const SLASH = '/'
const NULLISH = ts.TypeFlags.Null | ts.TypeFlags.Undefined

/** A call that cuts a string at a slash, by the function it is in. */
export type SlashSplit = { readonly in: string; readonly method: string }

/** A call of a method on what the expression before the dot gives: `id.split('/')`. */
type MethodCall = ts.CallExpression & { readonly expression: ts.PropertyAccessExpression }

/** Each call in the file that splits a string at a slash or finds one to cut at, the slash written out or held in a constant. */
export function slashSplitsIn(sourceFile: ts.SourceFile, checker: ts.TypeChecker): SlashSplit[] {
  return nodesUnder(sourceFile)
    .filter(ts.isCallExpression)
    .filter(isACuttingMethodCall)
    .filter((call) => cutsAStringAtASlash(call, checker))
    .map((call) => ({ in: enclosingFunctionNameOf(call), method: call.expression.name.text }))
}

function isACuttingMethodCall(call: ts.CallExpression): call is MethodCall {
  return ts.isPropertyAccessExpression(call.expression) && CUTTING_METHODS.has(call.expression.name.text)
}

function cutsAStringAtASlash(call: MethodCall, checker: ts.TypeChecker): boolean {
  const [separator] = call.arguments
  if (separator === undefined) return false
  return isAString(checker.getTypeAtLocation(call.expression.expression), checker) && isTheSlash(checker.getTypeAtLocation(separator))
}

// A union of rule IDs counts, and so does a string `?.` reads, whose type adds null or undefined.
function isAString(type: ts.Type, checker: ts.TypeChecker): boolean {
  return membersOf(constraintOf(type, checker))
    .filter((member) => !hasAFlagOf(member, NULLISH))
    .every((member) => hasAFlagOf(member, ts.TypeFlags.StringLike))
}

// A type parameter is read as the type it is constrained to; a type with no constraint, as itself.
function constraintOf(type: ts.Type, checker: ts.TypeChecker): ts.Type {
  return checker.getBaseConstraintOfType(type) ?? type
}

function membersOf(type: ts.Type): readonly ts.Type[] {
  return type.isUnion() ? type.types : [type]
}

function hasAFlagOf(type: ts.Type, flags: ts.TypeFlags): boolean {
  return (type.flags & flags) !== 0
}

function isTheSlash(type: ts.Type): boolean {
  return type.isStringLiteral() && type.value === SLASH
}
