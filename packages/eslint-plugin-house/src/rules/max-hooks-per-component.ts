import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils'

import { type FunctionNode, functionNameOf } from '../shared/function-name.ts'
import { isHookName } from '../shared/hook-name.ts'

// The schema requires neither key: ESLint fills each one a config omits from meta.defaultOptions.
type HookLimit = { max?: number; ignore?: readonly string[] }

type Options = [HookLimit]

type Frame = { node: FunctionNode; hooks: number; rendersJsx: boolean }

const DEFAULT_MAX_HOOKS = 7
// Memoisation hooks are left out by default: over-memoising wants the useCallback deleted, not a hook extracted.
const MEMO_HOOKS: readonly string[] = ['useCallback', 'useMemo']
const COMPONENT_NAME = /^[A-Z]/

function filledHookLimitOf({ max, ignore }: HookLimit): Required<HookLimit> {
  if (max === undefined || ignore === undefined) {
    throw new Error('max-hooks-per-component ran without meta.defaultOptions applied to its options')
  }
  return { max, ignore }
}

// A custom hook may hold many hooks: holding them is what extracting one is for.
function componentNameOf(frame: Frame): string | null {
  const name = functionNameOf(frame.node)
  return name !== null && COMPONENT_NAME.test(name) && frame.rendersJsx ? name : null
}

function hookNameCalledBy(call: TSESTree.CallExpression): string | null {
  const { callee } = call
  return callee.type === AST_NODE_TYPES.Identifier && isHookName(callee.name) ? callee.name : null
}

export const maxHooksPerComponent = ESLintUtils.RuleCreator.withoutDocs<Options, 'tooMany'>({
  meta: {
    type: 'suggestion',
    docs: { description: 'Limit hook calls per component; extract a custom hook past the limit' },
    messages: {
      tooMany:
        "'{{name}}' calls {{count}} hooks ({{limit}} is the limit). Extract a cohesive group into a custom hook named for what it does -- not a catch-all use{{name}}Logic.",
    },
    schema: [
      {
        type: 'object',
        properties: {
          max: { type: 'number' },
          ignore: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ max: DEFAULT_MAX_HOOKS, ignore: MEMO_HOOKS }],
  },
  create(context, [options]) {
    const { max, ignore } = filledHookLimitOf(options)
    const ignoredHooks = new Set(ignore)
    // Innermost function last. A hook call belongs to the innermost one: the rules of hooks forbid
    // calling a hook from a nested callback.
    const stack: Frame[] = []

    const enter = (node: FunctionNode): void => {
      stack.push({ node, hooks: 0, rendersJsx: false })
    }
    const leave = (): void => {
      const frame = stack.pop()
      if (frame === undefined) throw new Error('max-hooks-per-component left a function it never entered')
      if (frame.hooks <= max) return
      const name = componentNameOf(frame)
      if (name === null) return
      context.report({
        node: frame.node,
        messageId: 'tooMany',
        data: { name, count: String(frame.hooks), limit: String(max) },
      })
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
      CallExpression(node) {
        const hook = hookNameCalledBy(node)
        if (hook === null || ignoredHooks.has(hook)) return
        const frame = stack.at(-1)
        if (frame !== undefined) frame.hooks += 1
      },
      JSXElement: markJsx,
      JSXFragment: markJsx,
    }
  },
})
