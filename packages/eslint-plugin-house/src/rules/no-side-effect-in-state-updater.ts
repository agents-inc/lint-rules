import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils'

import { callReceiving } from '../shared/call-arguments.ts'
import { dottedPropertyNameOf, methodNameOf } from '../shared/callee-name.ts'
import { childNodesOf } from '../shared/child-nodes.ts'
import { isFunctionNode } from '../shared/function-name.ts'

type MessageId = 'effect' | 'nestedUpdate' | 'outerMutation' | 'refMutation' | 'refWrite'

type Updater = TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression

type Link = { readonly node: TSESTree.Node; readonly up: Link | null }

type Finding = { node: TSESTree.Node; messageId: MessageId }

type DottedPath = [root: string, ...properties: string[]]

const SETTER_NAME = /^set[A-Z]/u
// Named like setters and take a function first, but schedule it rather than update state.
const NOT_SETTERS: ReadonlySet<string> = new Set(['setTimeout', 'setInterval', 'setImmediate'])

// Callbacks that run synchronously inside the updater. Any other nested function is stored or
// scheduled, so it updates nothing now.
const SYNC_CALLBACK_METHODS: ReadonlySet<string> = new Set([
  'forEach',
  'map',
  'filter',
  'reduce',
  'reduceRight',
  'flatMap',
  'find',
  'findIndex',
  'findLast',
  'findLastIndex',
  'some',
  'every',
  'sort',
  'flat',
])

// Mutating methods. Harmless on `prev` or a local copy, so the receiver is resolved first.
const MUTATORS: ReadonlySet<string> = new Set([
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse',
  'fill',
  'copyWithin',
  'set',
  'add',
  'delete',
  'clear',
])

const GLOBAL_EFFECTS: ReadonlySet<string> = new Set([
  'fetch',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'queueMicrotask',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
])

// Effects reached through a well-known global: every method on it, or only these. `getItem` reads;
// `setItem` persists.
type EffectfulMethods = 'every-method' | ReadonlySet<string>
const MEMBER_EFFECTS: ReadonlyMap<string, EffectfulMethods> = new Map<string, EffectfulMethods>([
  ['localStorage', new Set(['setItem', 'removeItem', 'clear'])],
  ['sessionStorage', new Set(['setItem', 'removeItem', 'clear'])],
  ['indexedDB', 'every-method'],
  ['URL', new Set(['createObjectURL', 'revokeObjectURL'])],
  ['navigator', new Set(['sendBeacon', 'writeText', 'write'])],
  ['history', new Set(['pushState', 'replaceState', 'go', 'back', 'forward'])],
  ['axios', 'every-method'],
])
const GLOBAL_ALIASES: ReadonlySet<string> = new Set(['window', 'globalThis', 'self'])
const REF_VALUE = 'current'

// React's updater signatures take at most one more argument: `this.setState(updater, callback)` and
// react-router's `setSearchParams(init, options)`. A third means some other set* API.
const MAX_SETTER_ARGUMENTS = 2

// A bare `setX(…)`, or `….setState(…)` for class components. `obj.setFoo(fn)` is a builder API.
function isStateSetter(callee: Readonly<TSESTree.Expression>): boolean {
  if (callee.type === AST_NODE_TYPES.Identifier) return SETTER_NAME.test(callee.name) && !NOT_SETTERS.has(callee.name)
  return callee.type === AST_NODE_TYPES.MemberExpression && !callee.computed && callee.property.name === 'setState'
}

function isUpdater(argument: TSESTree.CallExpressionArgument | undefined): argument is Updater {
  return (
    argument?.type === AST_NODE_TYPES.ArrowFunctionExpression || argument?.type === AST_NODE_TYPES.FunctionExpression
  )
}

function updaterPassedTo(call: Readonly<TSESTree.CallExpression>): Updater | null {
  if (!isStateSetter(call.callee) || call.arguments.length > MAX_SETTER_ARGUMENTS) return null
  const [updater] = call.arguments
  return isUpdater(updater) ? updater : null
}

// `{ a: b }` binds through its value `b`; `{ ...rest }` binds through the rest element itself.
function patternOfProperty(property: Readonly<TSESTree.Property | TSESTree.RestElement>): TSESTree.Node {
  return property.type === AST_NODE_TYPES.Property ? property.value : property
}

// The one pattern `x = 1`, `...rest` and a parameter property `private x` each bind their name through.
function wrappedPatternsOf(pattern: Readonly<TSESTree.Node>): readonly TSESTree.Node[] {
  switch (pattern.type) {
    case AST_NODE_TYPES.AssignmentPattern: {
      return [pattern.left]
    }
    case AST_NODE_TYPES.RestElement: {
      return [pattern.argument]
    }
    case AST_NODE_TYPES.TSParameterProperty: {
      return [pattern.parameter]
    }
    default: {
      return []
    }
  }
}

// The patterns a pattern binds its names through: each element and property of a destructuring, or the one it wraps.
function subPatternsOf(pattern: Readonly<TSESTree.Node>): ReadonlyArray<TSESTree.Node | null> {
  switch (pattern.type) {
    case AST_NODE_TYPES.ArrayPattern: {
      return pattern.elements
    }
    case AST_NODE_TYPES.ObjectPattern: {
      return pattern.properties.map(patternOfProperty)
    }
    default: {
      return wrappedPatternsOf(pattern)
    }
  }
}

function patternNames(pattern: Readonly<TSESTree.Node> | null): string[] {
  if (pattern === null) return []
  if (pattern.type === AST_NODE_TYPES.Identifier) return [pattern.name]
  return subPatternsOf(pattern).flatMap(patternNames)
}

function declaredNamesAt(node: Readonly<TSESTree.Node>): string[] {
  switch (node.type) {
    case AST_NODE_TYPES.CatchClause: {
      return patternNames(node.param)
    }
    case AST_NODE_TYPES.VariableDeclarator: {
      return patternNames(node.id)
    }
    case AST_NODE_TYPES.ClassDeclaration:
    case AST_NODE_TYPES.FunctionDeclaration: {
      return patternNames(node.id)
    }
    default: {
      return []
    }
  }
}

function parameterNamesAt(node: Readonly<TSESTree.Node>): string[] {
  return 'params' in node ? node.params.flatMap(patternNames) : []
}

function namesBoundIn(node: Readonly<TSESTree.Node>): string[] {
  return [...declaredNamesAt(node), ...parameterNamesAt(node), ...childNodesOf(node).flatMap(namesBoundIn)]
}

// Null for a value made on the spot, such as `[...prev].sort()`, which nothing else holds.
function rootNameOf(node: Readonly<TSESTree.Node>): string | null {
  if (node.type === AST_NODE_TYPES.MemberExpression) return rootNameOf(node.object)
  return node.type === AST_NODE_TYPES.Identifier ? node.name : null
}

function dottedPathOf(node: Readonly<TSESTree.Node>): DottedPath | null {
  if (node.type === AST_NODE_TYPES.Identifier) return [node.name]
  if (node.type !== AST_NODE_TYPES.MemberExpression) return null
  const property = dottedPropertyNameOf(node)
  if (property === null) return null
  const objectPath = dottedPathOf(node.object)
  return objectPath === null ? null : [...objectPath, property]
}

// The dotted path without a leading `window.`, or null when a hop is computed.
function memberPathOf(node: Readonly<TSESTree.Node>): string[] | null {
  const path = dottedPathOf(node)
  if (path === null) return null
  const [root, ...properties] = path
  return properties.length > 0 && GLOBAL_ALIASES.has(root) ? properties : path
}

function isKnownEffect(path: readonly string[]): boolean {
  const [object, ...members] = path
  if (object === undefined) return false
  const method = members.at(-1)
  if (method === undefined) return GLOBAL_EFFECTS.has(object)
  const methods = MEMBER_EFFECTS.get(object)
  if (methods === undefined) return false
  return methods === 'every-method' || methods.has(method)
}

function isMutatorCall(path: readonly string[]): boolean {
  const method = path.at(-1)
  return method !== undefined && MUTATORS.has(method)
}

function isSyncIterationCallback(fn: Readonly<TSESTree.Node>, parent: Readonly<TSESTree.Node>): boolean {
  const call = callReceiving(fn, parent)
  if (call === null) return false
  const method = methodNameOf(call.callee)
  return method !== null && SYNC_CALLBACK_METHODS.has(method)
}

const DISCARD_TRANSPARENT: ReadonlySet<string> = new Set([
  AST_NODE_TYPES.ConditionalExpression,
  AST_NODE_TYPES.LogicalExpression,
  AST_NODE_TYPES.SequenceExpression,
])

// A setter is called for its effect; a pure helper named `set…` in return position is not.
function isDiscarded(link: Link | null): boolean {
  if (link === null) return false
  if (DISCARD_TRANSPARENT.has(link.node.type)) return isDiscarded(link.up)
  return link.node.type === AST_NODE_TYPES.ExpressionStatement
}

function writeFinding(target: Readonly<TSESTree.Node>, local: ReadonlySet<string>): Finding | null {
  if (target.type !== AST_NODE_TYPES.MemberExpression) return null
  const root = rootNameOf(target)
  if (root === null || local.has(root)) return null
  return { node: target, messageId: dottedPropertyNameOf(target) === REF_VALUE ? 'refWrite' : 'outerMutation' }
}

function callFinding(call: Readonly<TSESTree.CallExpression>, link: Link, local: ReadonlySet<string>): Finding | null {
  const { callee } = call
  const root = rootNameOf(callee)
  if (root !== null && local.has(root)) return null
  const path = memberPathOf(callee)
  if (path !== null && isKnownEffect(path)) return { node: callee, messageId: 'effect' }
  // Only a bare `setX(…)` or `….setState(…)`: `el.setAttribute` updates no state. A one-argument pure
  // helper is returned, not discarded.
  if (isStateSetter(callee) && call.arguments.length <= 1 && isDiscarded(link)) {
    return { node: callee, messageId: 'nestedUpdate' }
  }
  if (path === null || callee.type !== AST_NODE_TYPES.MemberExpression || !isMutatorCall(path)) return null
  // `urlsRef.current.delete(url)`: the same hazard, but there is nothing to copy.
  return { node: callee, messageId: path.includes(REF_VALUE) ? 'refMutation' : 'outerMutation' }
}

// `link` is the node's parent: whether a call's result is discarded depends on it.
function findingAt(node: Readonly<TSESTree.Node>, link: Link, local: ReadonlySet<string>): Finding | null {
  switch (node.type) {
    case AST_NODE_TYPES.AssignmentExpression: {
      return writeFinding(node.left, local)
    }
    case AST_NODE_TYPES.UpdateExpression: {
      return writeFinding(node.argument, local)
    }
    case AST_NODE_TYPES.CallExpression: {
      return callFinding(node, link, local)
    }
    default: {
      return null
    }
  }
}

function findingsUnder(node: Readonly<TSESTree.Node>, link: Link, local: ReadonlySet<string>): Finding[] {
  if (isFunctionNode(node) && !isSyncIterationCallback(node, link.node)) return []
  const here: Link = { node, up: link }
  const finding = findingAt(node, link, local)
  const below = childNodesOf(node).flatMap((child) => findingsUnder(child, here, local))
  return finding === null ? below : [finding, ...below]
}

// Mutating the updater's own argument, or a copy it built, is how a correct updater builds the next state.
function sideEffectsIn(updater: Readonly<Updater>): Finding[] {
  const local: ReadonlySet<string> = new Set(namesBoundIn(updater))
  return findingsUnder(updater.body, { node: updater, up: null }, local)
}

export const noSideEffectInStateUpdater = ESLintUtils.RuleCreator.withoutDocs<[], MessageId>({
  meta: {
    type: 'problem',
    docs: { description: 'Disallow side effects inside a functional state updater' },
    messages: {
      effect:
        "'{{name}}' is a side effect, and this is a state updater. Move it to the event handler or an effect and leave the updater returning only the next state -- StrictMode runs the updater twice and a bailed-out update runs it never.",
      nestedUpdate:
        "'{{name}}' queues another state update from inside a state updater. Call it from the event handler next to this one, so it runs exactly once.",
      refWrite:
        "'{{name}}' is assigned from inside a state updater. Write the ref in the event handler or an effect -- StrictMode runs this updater twice, so the ref keeps the second run's value.",
      refMutation:
        "'{{name}}' mutates a ref from inside a state updater. Do it in the event handler or an effect -- StrictMode runs this updater twice, so the mutation is applied twice. A ref cannot be fixed by copying it; the updater has to stop touching it.",
      outerMutation:
        "'{{name}}' mutates something that outlives this state updater, so a StrictMode double-run applies it twice and a bailed-out update never applies it. Do it in the event handler, or build the next value from the updater's argument and return that instead.",
    },
    schema: [],
    defaultOptions: [],
  },
  create(context) {
    const { sourceCode } = context
    return {
      CallExpression(node) {
        const updater = updaterPassedTo(node)
        if (updater === null) return
        for (const { node: effect, messageId } of sideEffectsIn(updater)) {
          context.report({ node: effect, messageId, data: { name: sourceCode.getText(effect) } })
        }
      },
    }
  },
})
