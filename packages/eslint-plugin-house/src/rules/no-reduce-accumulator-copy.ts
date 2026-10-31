import { ASTUtils, AST_NODE_TYPES, ESLintUtils, TSESLint, type TSESTree } from '@typescript-eslint/utils'

import { type FunctionNode, isFunctionNode } from '../shared/function-name.ts'
import { isSameNode } from '../shared/same-node.ts'

// A port of anti-slop/no-reduce-accumulator-copy (github.com/dmmulroy/anti-slop, commit c44ef22).

type MessageId = 'accumulatorCopy'

type Variable = TSESLint.Scope.Variable

type VariableDefinition = TSESLint.Scope.Definitions.VariableDefinition

type TransparentWrapper =
  | TSESTree.ChainExpression
  | TSESTree.TSAsExpression
  | TSESTree.TSNonNullExpression
  | TSESTree.TSSatisfiesExpression
  | TSESTree.TSTypeAssertion

type MethodCall = { name: string; object: TSESTree.Expression }

type SourceCode = Readonly<TSESLint.SourceCode>

type Reducer = { accumulator: Variable; initialValue: TSESTree.CallExpressionArgument | undefined }

const TRANSPARENT_WRAPPER_TYPES: ReadonlySet<AST_NODE_TYPES> = new Set([
  AST_NODE_TYPES.ChainExpression,
  AST_NODE_TYPES.TSAsExpression,
  AST_NODE_TYPES.TSNonNullExpression,
  AST_NODE_TYPES.TSSatisfiesExpression,
  AST_NODE_TYPES.TSTypeAssertion,
])
const REDUCE_METHODS: ReadonlySet<string> = new Set(['reduce', 'reduceRight'])
const REDUCE_MAX_ARGUMENTS = 2
const ARRAY_COPY_METHODS: ReadonlySet<string> = new Set(['concat', 'slice', 'toSpliced', 'toSorted', 'toReversed', 'with'])
const ARRAY_RETURNING_METHODS: ReadonlySet<string> = new Set(['map', 'filter', 'flatMap', 'slice', 'concat', 'toSorted', 'toReversed', 'toSpliced'])
const ARRAY_TYPE_NAMES: ReadonlySet<string> = new Set(['Array', 'ReadonlyArray'])
const OBJECT_GLOBAL = 'Object'
const ARRAY_GLOBAL = 'Array'
const OBJECT_ASSIGN = 'assign'
const ARRAY_FROM = 'from'

function isTransparentWrapper(node: Readonly<TSESTree.Node>): node is TransparentWrapper {
  return TRANSPARENT_WRAPPER_TYPES.has(node.type)
}

function unwrapped(node: Readonly<TSESTree.Node>): TSESTree.Node {
  return isTransparentWrapper(node) ? unwrapped(node.expression) : node
}

function outermostWrapperOf(node: Readonly<FunctionNode | TransparentWrapper>): FunctionNode | TransparentWrapper {
  return isTransparentWrapper(node.parent) ? outermostWrapperOf(node.parent) : node
}

/** `object.name(…)` or `object['name'](…)`: the method a call names and what it is called on; null for any other callee. */
function methodCallOf(callee: Readonly<TSESTree.Node>): MethodCall | null {
  const member = unwrapped(callee)
  if (member.type !== AST_NODE_TYPES.MemberExpression) return null
  const { computed, property, object } = member
  if (!computed && property.type === AST_NODE_TYPES.Identifier) return { name: property.name, object }
  if (computed && property.type === AST_NODE_TYPES.Literal && typeof property.value === 'string') return { name: property.value, object }
  return null
}

function isReduceCall(call: Readonly<TSESTree.CallExpression>): boolean {
  const method = methodCallOf(call.callee)
  return method !== null && REDUCE_METHODS.has(method.name) && call.arguments.length <= REDUCE_MAX_ARGUMENTS
}

/** The `reduce` or `reduceRight` call `callback` is the first argument of, with at most an initial value after it. */
function reduceCallTaking(callback: Readonly<FunctionNode>): TSESTree.CallExpression | null {
  const argument = outermostWrapperOf(callback)
  const call = argument.parent
  return call.type === AST_NODE_TYPES.CallExpression && isReduceCall(call) && isSameNode(call.arguments[0], argument) ? call : null
}

function accumulatorParameterOf(callback: Readonly<FunctionNode>): TSESTree.Identifier | null {
  const [first] = callback.params
  const parameter = first?.type === AST_NODE_TYPES.AssignmentPattern ? first.left : first
  return parameter?.type === AST_NODE_TYPES.Identifier ? parameter : null
}

function variableOf(sourceCode: SourceCode, node: Readonly<TSESTree.Node>): Variable | null {
  const identifier = unwrapped(node)
  return identifier.type === AST_NODE_TYPES.Identifier ? ASTUtils.findVariable(sourceCode.getScope(identifier), identifier) : null
}

// By `range`: upstream reads oxlint's `.start`, undefined on every typescript-eslint node, so it took a named reducer's own name.
function accumulatorOf(sourceCode: SourceCode, callback: Readonly<FunctionNode>): Variable | undefined {
  const parameter = accumulatorParameterOf(callback)
  if (parameter === null) return undefined
  return sourceCode.getDeclaredVariables(callback).find((variable) => variable.identifiers.some((identifier) => identifier.range[0] === parameter.range[0]))
}

// Only the nearest enclosing function counts, and only as the first argument of `reduce` or `reduceRight`: a closure
// the reducer makes, or a function declared inside it, copies nothing on the reducer's own steps.
function reducerAround(sourceCode: SourceCode, node: Readonly<TSESTree.Node>): Reducer | null {
  const callback = sourceCode.getAncestors(node).findLast(isFunctionNode)
  if (callback === undefined) return null
  const call = reduceCallTaking(callback)
  if (call === null) return null
  const accumulator = accumulatorOf(sourceCode, callback)
  return accumulator === undefined ? null : { accumulator, initialValue: call.arguments[1] }
}

function isReassigned(variable: Readonly<Variable>): boolean {
  return variable.references.some((reference) => reference.isWrite() && reference.init !== true)
}

function isConstNameDefinition(definition: Readonly<TSESLint.Scope.Definition>): definition is VariableDefinition {
  return (
    definition.type === TSESLint.Scope.DefinitionType.Variable &&
    definition.parent.kind === 'const' &&
    definition.node.id.type === AST_NODE_TYPES.Identifier
  )
}

/** What a `const name = …` declaration sets the variable to; null for any other declaration. */
function constInitializerOf(variable: Readonly<Variable>): TSESTree.Expression | null {
  const definition = variable.defs.find(isConstNameDefinition)
  return definition === undefined ? null : definition.node.init
}

function isArrayAnnotation(type: Readonly<TSESTree.TypeNode>): boolean {
  if (type.type === AST_NODE_TYPES.TSArrayType || type.type === AST_NODE_TYPES.TSTupleType) return true
  if (type.type === AST_NODE_TYPES.TSTypeOperator && type.operator === 'readonly' && type.typeAnnotation !== undefined) {
    return isArrayAnnotation(type.typeAnnotation)
  }
  return type.type === AST_NODE_TYPES.TSTypeReference && type.typeName.type === AST_NODE_TYPES.Identifier && ARRAY_TYPE_NAMES.has(type.typeName.name)
}

function firstAnnotationOf(variable: Readonly<Variable>): TSESTree.TypeNode | null {
  const annotated = variable.identifiers.find((identifier) => identifier.typeAnnotation !== undefined)
  return annotated?.typeAnnotation?.typeAnnotation ?? null
}

// The global `Object` or `Array`: one the file declares, imports or takes as a parameter is someone else's.
function isGlobal(sourceCode: SourceCode, node: Readonly<TSESTree.Node>, name: string): boolean {
  const identifier = unwrapped(node)
  if (identifier.type !== AST_NODE_TYPES.Identifier || identifier.name !== name) return false
  const variable = variableOf(sourceCode, identifier)
  return variable === null || variable.defs.length === 0
}

// The accumulator itself, or a `const` that holds it, however many aliases deep.
function refersTo(sourceCode: SourceCode, accumulator: Readonly<Variable>, node: Readonly<TSESTree.Node>, visited: readonly Variable[] = []): boolean {
  const variable = variableOf(sourceCode, node)
  if (variable === null || visited.includes(variable)) return false
  if (variable === accumulator) return true
  const initializer = constInitializerOf(variable)
  return initializer !== null && refersTo(sourceCode, accumulator, initializer, [...visited, variable])
}

// An array literal, an array method's result on a known array, or a binding annotated as an array or set to one.
// A receiver the file cannot show is an array, such as a string or a custom collection, is not known.
function isKnownArray(sourceCode: SourceCode, node: Readonly<TSESTree.Node>, visited: readonly Variable[] = []): boolean {
  const expression = unwrapped(node)
  if (expression.type === AST_NODE_TYPES.ArrayExpression) return true
  if (expression.type === AST_NODE_TYPES.CallExpression) {
    const method = methodCallOf(expression.callee)
    return method !== null && ARRAY_RETURNING_METHODS.has(method.name) && isKnownArray(sourceCode, method.object, visited)
  }
  const variable = variableOf(sourceCode, expression)
  if (variable === null || visited.includes(variable) || isReassigned(variable)) return false
  const annotation = firstAnnotationOf(variable)
  if (annotation !== null) return isArrayAnnotation(annotation)
  const initializer = constInitializerOf(variable)
  return initializer !== null && isKnownArray(sourceCode, initializer, [...visited, variable])
}

/** `Object.assign({}, …)` with the accumulator among its sources; `Object.assign(acc, …)` fills it in place instead. */
function assignsIntoANewObject(sourceCode: SourceCode, [target, ...sources]: readonly TSESTree.CallExpressionArgument[], accumulator: Readonly<Variable>): boolean {
  return target !== undefined && unwrapped(target).type === AST_NODE_TYPES.ObjectExpression && sources.some((source) => refersTo(sourceCode, accumulator, source))
}

function copiesTheAccumulator(sourceCode: SourceCode, call: Readonly<TSESTree.CallExpression>, method: Readonly<MethodCall>, reducer: Readonly<Reducer>): boolean {
  const { accumulator, initialValue } = reducer
  if (method.name === OBJECT_ASSIGN && isGlobal(sourceCode, method.object, OBJECT_GLOBAL)) return assignsIntoANewObject(sourceCode, call.arguments, accumulator)
  if (method.name === ARRAY_FROM && isGlobal(sourceCode, method.object, ARRAY_GLOBAL)) {
    const [source] = call.arguments
    return source !== undefined && refersTo(sourceCode, accumulator, source)
  }
  if (!ARRAY_COPY_METHODS.has(method.name)) return false
  return initialValue !== undefined && isKnownArray(sourceCode, initialValue) && refersTo(sourceCode, accumulator, method.object)
}

export const noReduceAccumulatorCopy = ESLintUtils.RuleCreator.withoutDocs<[], MessageId>({
  meta: {
    type: 'problem',
    docs: { description: "Disallow copying a reducer's accumulator on every step with Object.assign, Array.from or an array copy method" },
    messages: {
      accumulatorCopy:
        'This reducer copies its accumulator on every step, so the work grows with the square of the input. Build the result in one pass instead: flatMap or map for an array, Object.fromEntries for an object.',
    },
    schema: [],
    defaultOptions: [],
  },
  create(context) {
    const { sourceCode } = context
    return {
      CallExpression(node) {
        const method = methodCallOf(node.callee)
        if (method === null) return
        const reducer = reducerAround(sourceCode, node)
        if (reducer !== null && copiesTheAccumulator(sourceCode, node, method, reducer)) context.report({ node, messageId: 'accumulatorCopy' })
      },
    }
  },
})
