import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils'

import { type FunctionNode, functionNameOf } from '../shared/function-name.ts'
import { isHookName } from '../shared/hook-name.ts'

// `rendersJsx` records only the JSX this function renders itself, not a nested callback's.
type Frame = { node: FunctionNode; rendersJsx: boolean }

type PendingCall = { node: TSESTree.CallExpression; enclosingFunctions: readonly Frame[] }

const COMPONENT_NAME = /^[A-Z]/
const EVENT_PROP = /^on[A-Z]/
// Calls whose function argument runs later. Hooks (`use[A-Z]`) are deferred too, which covers the
// lazy `useState(() => URL.createObjectURL(b))`: the fix for the eager form this rule reports.
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

// `URL.createObjectURL`, and its `window.URL` / `globalThis.URL` / `self.URL` spellings.
function isCreateObjectUrl(callee: TSESTree.Expression): boolean {
  if (callee.type !== AST_NODE_TYPES.MemberExpression || callee.computed) return false
  if (callee.property.type !== AST_NODE_TYPES.Identifier || callee.property.name !== 'createObjectURL') return false
  const { object } = callee
  if (object.type === AST_NODE_TYPES.Identifier) return object.name === 'URL'
  return (
    object.type === AST_NODE_TYPES.MemberExpression &&
    !object.computed &&
    object.property.type === AST_NODE_TYPES.Identifier &&
    object.property.name === 'URL'
  )
}

// Stricter than the shared calleeNameOf: a computed `hooks[name](…)` names nothing here.
function staticCalleeNameOf(call: TSESTree.CallExpression): string | null {
  const { callee } = call
  if (callee.type === AST_NODE_TYPES.Identifier) return callee.name
  if (callee.type === AST_NODE_TYPES.MemberExpression && !callee.computed && callee.property.type === AST_NODE_TYPES.Identifier) {
    return callee.property.name
  }
  return null
}

function isEventHandler(fn: FunctionNode): boolean {
  const { parent } = fn
  if (parent.type !== AST_NODE_TYPES.JSXExpressionContainer || parent.parent.type !== AST_NODE_TYPES.JSXAttribute) {
    return false
  }
  const { name } = parent.parent
  return name.type === AST_NODE_TYPES.JSXIdentifier && EVENT_PROP.test(name.name)
}

function isDeferredCallArgument(fn: FunctionNode): boolean {
  const { parent } = fn
  if (parent.type !== AST_NODE_TYPES.CallExpression || !parent.arguments.some((argument) => argument === fn)) {
    return false
  }
  const name = staticCalleeNameOf(parent)
  return name !== null && (isHookName(name) || DEFERRED_CALLS.has(name))
}

// Off the render path, which is where the call belongs.
function isDeferred(fn: FunctionNode): boolean {
  return isEventHandler(fn) || isDeferredCallArgument(fn)
}

function isComponent(frame: Frame): boolean {
  const name = functionNameOf(frame.node)
  return name !== null && COMPONENT_NAME.test(name) && frame.rendersJsx
}

// Walks outward from the innermost enclosing function. A callback that renders JSX is render
// position too (`items.map(f => <img src={URL.createObjectURL(f)} />)`), so the walk continues to the
// component it renders into; any other function runs on demand and ends it.
function runsOnEveryRender(enclosingFunctions: readonly Frame[]): boolean {
  for (const frame of enclosingFunctions.toReversed()) {
    if (isDeferred(frame.node)) return false
    if (isComponent(frame)) return true
    if (!frame.rendersJsx) return false
  }
  return false
}

// Not fixable: the fix revokes the previous URL on cleanup, and where that belongs depends on the
// component. Unnamed components, class render methods and custom hook bodies go unreported.
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
    const stack: Frame[] = []
    // Decided at Program:exit: whether a function is a component depends on JSX not yet visited.
    const pending: PendingCall[] = []

    const enter = (node: FunctionNode): void => {
      stack.push({ node, rendersJsx: false })
    }
    const leave = (): void => {
      stack.pop()
    }
    const markJsx = (): void => {
      const frame = stack.at(-1)
      if (frame !== undefined) frame.rendersJsx = true
    }

    return {
      FunctionDeclaration: enter,
      'FunctionDeclaration:exit': leave,
      FunctionExpression: enter,
      'FunctionExpression:exit': leave,
      ArrowFunctionExpression: enter,
      'ArrowFunctionExpression:exit': leave,
      JSXElement: markJsx,
      JSXFragment: markJsx,
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
