import { AST_NODE_TYPES, ESLintUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils'

import { componentNameOf, type FunctionFrame, functionFramesOfTheWalk } from '../shared/function-frames.ts'
import type { FunctionNode } from '../shared/function-name.ts'
import { isHookName } from '../shared/hook-name.ts'
import { defaultedOption } from '../shared/rule-options.ts'

// The schema requires neither key: ESLint fills each one a config omits from meta.defaultOptions.
type HookLimit = { max?: number; ignore?: readonly string[] }

type Options = [HookLimit]

type Frame = FunctionFrame & { hooks: number }

const RULE_NAME = 'max-hooks-per-component'
const DEFAULT_MAX_HOOKS = 7
// Memoisation hooks are left out by default: over-memoising wants the useCallback deleted, not a hook extracted.
const MEMO_HOOKS: readonly string[] = ['useCallback', 'useMemo']

function hookNameCalledBy(call: Readonly<TSESTree.CallExpression>): string | null {
  const { callee } = call
  return callee.type === AST_NODE_TYPES.Identifier && isHookName(callee.name) ? callee.name : null
}

function frameWithNoHooks(node: Readonly<FunctionNode>): Frame {
  return { node, hooks: 0, rendersJsx: false }
}

function reportTooManyHooks(context: Readonly<TSESLint.RuleContext<'tooMany', Options>>, frame: Readonly<Frame>, max: number): void {
  if (frame.hooks <= max) return
  // A custom hook may hold many hooks: holding them is what extracting one is for.
  const name = componentNameOf(frame)
  if (name === null) return
  context.report({
    node: frame.node,
    messageId: 'tooMany',
    data: { name, count: String(frame.hooks), limit: String(max) },
  })
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
    const max = defaultedOption(RULE_NAME, options.max)
    const ignoredHooks = new Set(defaultedOption(RULE_NAME, options.ignore))
    // The rules of hooks forbid calling a hook from a nested callback.
    const { frames, visitors } = functionFramesOfTheWalk({
      ruleName: RULE_NAME,
      frameFor: frameWithNoHooks,
      onLeave(frame) {
        reportTooManyHooks(context, frame, max)
      },
    })

    return {
      ...visitors,
      CallExpression(node) {
        const hook = hookNameCalledBy(node)
        if (hook === null || ignoredHooks.has(hook)) return
        const frame = frames.at(-1)
        if (frame !== undefined) frame.hooks += 1
      },
    }
  },
})
