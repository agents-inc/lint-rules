import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils'

import { childNodesOf } from '../shared/child-nodes.ts'

type MessageId = 'effect' | 'nestedUpdate' | 'outerMutation' | 'refMutation' | 'refWrite'

type Updater = TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression

// The walk's own chain of ancestors, nearest first.
type Link = { node: TSESTree.Node; up: Link | null }

type Finding = { node: TSESTree.Node; messageId: MessageId }

const SETTER_NAME = /^set[A-Z]/
// Named like setters and take a function first, but schedule it rather than update state.
const NOT_SETTERS: ReadonlySet<string> = new Set(['setTimeout', 'setInterval', 'setImmediate'])

// Callbacks that run synchronously inside the updater. Every other nested function is stored or
// scheduled for later: `prev.map(r => ({ ...r, onClick: () => setOpen(true) }))` updates nothing now.
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

// Effects reached through a well-known global: every method on it, or only these.
// `localStorage.getItem` reads and is fine; `localStorage.setItem` persists and is not.
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
function isStateSetter(callee: TSESTree.Expression): boolean {
  if (callee.type === AST_NODE_TYPES.Identifier) return SETTER_NAME.test(callee.name) && !NOT_SETTERS.has(callee.name)
  return callee.type === AST_NODE_TYPES.MemberExpression && !callee.computed && callee.property.name === 'setState'
}

function isUpdater(argument: TSESTree.CallExpressionArgument | undefined): argument is Updater {
  return (
    argument?.type === AST_NODE_TYPES.ArrowFunctionExpression || argument?.type === AST_NODE_TYPES.FunctionExpression
  )
}

function updaterPassedTo(call: TSESTree.CallExpression): Updater | null {
  if (!isStateSetter(call.callee) || call.arguments.length > MAX_SETTER_ARGUMENTS) return null
  const [updater] = call.arguments
  return isUpdater(updater) ? updater : null
}

function patternNames(pattern: TSESTree.Node | null): string[] {
  if (pattern === null) return []
  switch (pattern.type) {
    case AST_NODE_TYPES.Identifier: {
      return [pattern.name]
    }
    case AST_NODE_TYPES.ArrayPattern: {
      return pattern.elements.flatMap(patternNames)
    }
    case AST_NODE_TYPES.AssignmentPattern: {
      return patternNames(pattern.left)
    }
    case AST_NODE_TYPES.ObjectPattern: {
      return pattern.properties.flatMap((property) =>
        property.type === AST_NODE_TYPES.Property ? patternNames(property.value) : patternNames(property),
      )
    }
    case AST_NODE_TYPES.RestElement: {
      return patternNames(pattern.argument)
    }
    case AST_NODE_TYPES.TSParameterProperty: {
      return patternNames(pattern.parameter)
    }
    default: {
      return []
    }
  }
}

function declaredNamesAt(node: TSESTree.Node): string[] {
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

function parameterNamesAt(node: TSESTree.Node): string[] {
  return 'params' in node ? node.params.flatMap(patternNames) : []
}

function namesBoundIn(node: TSESTree.Node): string[] {
  return [...declaredNamesAt(node), ...parameterNamesAt(node), ...childNodesOf(node).flatMap(namesBoundIn)]
}

// The identifier a member chain starts from: `ref.current` → `ref`. Null for a value made on the
// spot, such as `[...prev].sort()`, which nothing else holds.
function rootNameOf(node: TSESTree.Node): string | null {
  let current = node
  while (current.type === AST_NODE_TYPES.MemberExpression) current = current.object
  return current.type === AST_NODE_TYPES.Identifier ? current.name : null
}

// The dotted path without a leading `window.`, or null when a hop is computed.
function memberPathOf(node: TSESTree.Node): string[] | null {
  const properties: string[] = []
  let current = node
  while (current.type === AST_NODE_TYPES.MemberExpression) {
    if (current.computed || current.property.type !== AST_NODE_TYPES.Identifier) return null
    properties.unshift(current.property.name)
    current = current.object
  }
  if (current.type !== AST_NODE_TYPES.Identifier) return null
  const path = [current.name, ...properties]
  return path.length > 1 && GLOBAL_ALIASES.has(current.name) ? path.slice(1) : path
}

function isKnownEffect(path: readonly string[]): boolean {
  const [object, ...members] = path
  const method = members.at(-1)
  if (object === undefined) return false
  if (method === undefined) return GLOBAL_EFFECTS.has(object)
  const methods = MEMBER_EFFECTS.get(object)
  return methods === 'every-method' || (methods !== undefined && methods.has(method))
}

function isMutatorCall(path: readonly string[]): boolean {
  const method = path.at(-1)
  return method !== undefined && MUTATORS.has(method)
}

function isSyncIterationCallback(fn: TSESTree.Node, parent: TSESTree.Node): boolean {
  return (
    parent.type === AST_NODE_TYPES.CallExpression &&
    parent.arguments.some((argument) => argument === fn) &&
    parent.callee.type === AST_NODE_TYPES.MemberExpression &&
    parent.callee.property.type === AST_NODE_TYPES.Identifier &&
    SYNC_CALLBACK_METHODS.has(parent.callee.property.name)
  )
}

const DISCARD_TRANSPARENT: ReadonlySet<string> = new Set([
  AST_NODE_TYPES.ConditionalExpression,
  AST_NODE_TYPES.LogicalExpression,
  AST_NODE_TYPES.SequenceExpression,
])

// Whether the call's result is thrown away. A setter is called for its effect; `setPreference(prev,
// patch)` in return position is a pure helper whose name starts with `set`.
function isDiscarded(link: Link | null): boolean {
  let current = link
  while (current !== null && DISCARD_TRANSPARENT.has(current.node.type)) current = current.up
  return current?.node.type === AST_NODE_TYPES.ExpressionStatement
}

function isFunction(node: TSESTree.Node): boolean {
  return (
    node.type === AST_NODE_TYPES.FunctionExpression ||
    node.type === AST_NODE_TYPES.ArrowFunctionExpression ||
    node.type === AST_NODE_TYPES.FunctionDeclaration
  )
}

function isRefValue(member: TSESTree.MemberExpression): boolean {
  return !member.computed && member.property.type === AST_NODE_TYPES.Identifier && member.property.name === REF_VALUE
}

function writeFinding(target: TSESTree.Node, local: ReadonlySet<string>): Finding | null {
  if (target.type !== AST_NODE_TYPES.MemberExpression) return null
  const root = rootNameOf(target)
  if (root === null || local.has(root)) return null
  return { node: target, messageId: isRefValue(target) ? 'refWrite' : 'outerMutation' }
}

function callFinding(call: TSESTree.CallExpression, link: Link, local: ReadonlySet<string>): Finding | null {
  const { callee } = call
  const root = rootNameOf(callee)
  if (root !== null && local.has(root)) return null
  const path = memberPathOf(callee)
  if (path !== null && isKnownEffect(path)) return { node: callee, messageId: 'effect' }
  // Only a bare `setX(…)` or `….setState(…)`: `el.setAttribute` and `d.setHours` update no state.
  // One argument and a discarded result: a one-argument pure helper is returned, not discarded.
  if (isStateSetter(callee) && call.arguments.length <= 1 && isDiscarded(link)) {
    return { node: callee, messageId: 'nestedUpdate' }
  }
  if (callee.type !== AST_NODE_TYPES.MemberExpression || path === null || !isMutatorCall(path)) return null
  // `urlsRef.current.delete(url)`: the same hazard, but there is nothing to copy.
  return { node: callee, messageId: path.includes(REF_VALUE) ? 'refMutation' : 'outerMutation' }
}

// `link` is the node's parent: whether a call's result is discarded depends on it.
function findingAt(node: TSESTree.Node, link: Link, local: ReadonlySet<string>): Finding | null {
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

function findingsUnder(node: TSESTree.Node, link: Link, local: ReadonlySet<string>): Finding[] {
  if (isFunction(node) && !isSyncIterationCallback(node, link.node)) return []
  const here: Link = { node, up: link }
  const finding = findingAt(node, link, local)
  const below = childNodesOf(node).flatMap((child) => findingsUnder(child, here, local))
  return finding === null ? below : [finding, ...below]
}

// Names the updater binds for itself are its argument or a copy it built, and mutating those is how a
// correct updater builds the next state.
function sideEffectsIn(updater: Updater): Finding[] {
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
