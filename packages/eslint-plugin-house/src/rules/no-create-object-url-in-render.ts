import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils'

import { callReceiving } from '../shared/call-arguments.ts'
import { dottedPropertyNameOf } from '../shared/callee-name.ts'
import { componentNameOf, type FunctionFrame, functionFrameVisitors } from '../shared/function-frames.ts'
import type { FunctionNode } from '../shared/function-name.ts'
import { isHookName } from '../shared/hook-name.ts'
import { jsxAttributeName } from '../shared/jsx-attributes.ts'

type PendingCall = { node: TSESTree.CallExpression; enclosingFunctions: readonly FunctionFrame[] }

const RULE_NAME = 'no-create-object-url-in-render'
const EVENT_PROP = /^on[A-Z]/
// Calls whose function argument runs later. Hooks count, which covers the lazy
// `useState(() => URL.createObjectURL(b))` this rule's fix asks for.
const DEFERRED_CALLS: ReadonlySet<string> = new Set([
  'addEventListener',
  'setTimeout',
  'setInterval',
  'queueMicrotask',
  'requestAnimationFrame',
  'requestIdleCallback',
  'then',
  'catch',
  'finally',
])

// Stricter than the shared calleeNameOf: a computed `hooks[name](…)` names nothing here.
function staticCalleeNameOf(callee: TSESTree.Expression): string | null {
  return callee.type === AST_NODE_TYPES.Identifier ? callee.name : dottedPropertyNameOf(callee)
}

// `URL.createObjectURL`, and its `window.URL` / `globalThis.URL` / `self.URL` spellings.
function isCreateObjectUrl(callee: TSESTree.Expression): boolean {
  return (
    callee.type === AST_NODE_TYPES.MemberExpression &&
    dottedPropertyNameOf(callee) === 'createObjectURL' &&
    staticCalleeNameOf(callee.object) === 'URL'
  )
}

function isEventHandler(fn: FunctionNode): boolean {
  const { parent } = fn
  if (parent.type !== AST_NODE_TYPES.JSXExpressionContainer || parent.parent.type !== AST_NODE_TYPES.JSXAttribute) {
    return false
  }
  const name = jsxAttributeName(parent.parent)
  return name !== null && EVENT_PROP.test(name)
}

function isDeferredCallArgument(fn: FunctionNode): boolean {
  const call = callReceiving(fn, fn.parent)
  if (call === null) return false
  const name = staticCalleeNameOf(call.callee)
  return name !== null && (isHookName(name) || DEFERRED_CALLS.has(name))
}

function isDeferred(fn: FunctionNode): boolean {
  return isEventHandler(fn) || isDeferredCallArgument(fn)
}

// A callback that renders JSX is render position too, so the walk continues to the component it
// renders into; any other function runs on demand and ends it.
function runsOnEveryRender(enclosingFunctions: readonly FunctionFrame[]): boolean {
  for (const frame of enclosingFunctions.toReversed()) {
    if (isDeferred(frame.node)) return false
    if (componentNameOf(frame) !== null) return true
    if (!frame.rendersJsx) return false
  }
  return false
}

// Not fixable: where the cleanup revoking the URL belongs depends on the component. Unnamed
// components, class render methods and custom hook bodies go unreported.
export const noCreateObjectUrlInRender = ESLintUtils.RuleCreator.withoutDocs<[], 'inRender'>({
  meta: {
    type: 'problem',
    docs: { description: 'Disallow URL.createObjectURL in a component render body or inline in JSX' },
    messages: {
      inRender:
        'URL.createObjectURL runs again on every render here, so each render leaks a blob URL and the browser refetches the image. Move it into a useEffect or useMemo keyed on the blob, and revoke the previous URL on cleanup.',
    },
    schema: [],
    defaultOptions: [],
  },
  create(context) {
    const stack: FunctionFrame[] = []
    // Decided at Program:exit: whether a function is a component depends on JSX not yet visited.
    const pending: PendingCall[] = []

    return {
      ...functionFrameVisitors(stack, { ruleName: RULE_NAME, frameFor: (node) => ({ node, rendersJsx: false }) }),
      CallExpression(node) {
        // At module scope it is a one-time setup, not a render.
        if (!isCreateObjectUrl(node.callee) || stack.length === 0) return
        pending.push({ node, enclosingFunctions: [...stack] })
      },
      'Program:exit'() {
        for (const { node, enclosingFunctions } of pending) {
          if (runsOnEveryRender(enclosingFunctions)) context.report({ node, messageId: 'inRender' })
        }
      },
    }
  },
})
