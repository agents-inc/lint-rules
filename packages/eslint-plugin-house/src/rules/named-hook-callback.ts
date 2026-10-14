import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils'

import { calleeNameOf } from '../shared/callee-name.ts'
import { NAMED_CALLBACK_HOOKS } from '../shared/named-callback-hooks.ts'

// The schema does not require the key: ESLint fills it from meta.defaultOptions when a config omits it.
type CallbackHooks = { hooks?: readonly string[] }

type Options = [CallbackHooks]

function filledCallbackHooksOf({ hooks }: CallbackHooks): Required<CallbackHooks> {
  if (hooks === undefined) {
    throw new Error('named-hook-callback ran without meta.defaultOptions applied to its options')
  }
  return { hooks }
}

function isAnonymousFunction(argument: TSESTree.CallExpressionArgument): boolean {
  return (
    argument.type === AST_NODE_TYPES.ArrowFunctionExpression ||
    (argument.type === AST_NODE_TYPES.FunctionExpression && argument.id === null)
  )
}

// Not fixable: the point is a name that says what the effect does, and a fixer can only invent `effect1`.
export const namedHookCallback = ESLintUtils.RuleCreator.withoutDocs<Options, 'anonymous'>({
  meta: {
    type: 'suggestion',
    docs: { description: 'Require a named function expression as an effect hook callback' },
    messages: {
      anonymous:
        "Give this {{hook}} callback a name: {{hook}}(function describesWhatItDoes() {…}). An anonymous callback shows as 'anonymous' in stack traces and React DevTools.",
    },
    schema: [
      {
        type: 'object',
        properties: { hooks: { type: 'array', items: { type: 'string' } } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ hooks: NAMED_CALLBACK_HOOKS }],
  },
  create(context, [options]) {
    const { hooks } = filledCallbackHooksOf(options)
    const namedCallbackHooks = new Set(hooks)
    return {
      CallExpression(node) {
        const hook = calleeNameOf(node.callee)
        if (hook === null || !namedCallbackHooks.has(hook)) return
        const [callback] = node.arguments
        if (callback !== undefined && isAnonymousFunction(callback)) {
          context.report({ node: callback, messageId: 'anonymous', data: { hook } })
        }
      },
    }
  },
})
