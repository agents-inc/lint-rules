import { ASTUtils, AST_NODE_TYPES, ESLintUtils, TSESLint, type TSESTree } from '@typescript-eslint/utils'

import { callReceiving } from '../shared/call-arguments.ts'
import { calleeNameOf, dottedPropertyNameOf } from '../shared/callee-name.ts'
import { componentNameOf, type FunctionFrame, functionFrameVisitors } from '../shared/function-frames.ts'
import { type FunctionNode, functionNameOf } from '../shared/function-name.ts'
import { isHookName } from '../shared/hook-name.ts'

// Reports wait for the frame's exit: the call is usually seen before the JSX that makes it a component.
type Frame = FunctionFrame & { calls: TSESTree.CallExpression[] }

const RULE_NAME = 'no-create-context-in-render'
const CREATE_CONTEXT = 'createContext'
// `node:vm` exports a createContext too, and a Solid component body runs only once.
const REACT_MODULE = /^(preact(\/compat)?|react|use-context-selector)$/
// Hooks that keep their first argument for the component's life.
const STABLE_HOOKS: ReadonlySet<string> = new Set(['useMemo', 'useState', 'useRef'])

function isRetainedByStableHook(node: FunctionNode | TSESTree.CallExpression): boolean {
  const call = callReceiving(node, node.parent)
  if (call === null || call.arguments[0] !== node) return false
  const name = calleeNameOf(call.callee)
  return name !== null && STABLE_HOOKS.has(name)
}

// The member form is pinned to `React`: `vm.createContext(sandbox)` is a real Node API.
function createContextForm(callee: TSESTree.Expression): 'bare' | 'namespaced' | null {
  if (callee.type === AST_NODE_TYPES.Identifier) return callee.name === CREATE_CONTEXT ? 'bare' : null
  const isNamespaced =
    callee.type === AST_NODE_TYPES.MemberExpression &&
    dottedPropertyNameOf(callee) === CREATE_CONTEXT &&
    callee.object.type === AST_NODE_TYPES.Identifier &&
    callee.object.name === 'React'
  return isNamespaced ? 'namespaced' : null
}

function isReactImport(definition: TSESLint.Scope.Definition): boolean {
  return (
    definition.type === TSESLint.Scope.DefinitionType.ImportBinding &&
    definition.parent.type === AST_NODE_TYPES.ImportDeclaration &&
    REACT_MODULE.test(definition.parent.source.value)
  )
}

// A `createContext` the file declares or imports from elsewhere is someone else's; an unresolved
// one is React's UMD global.
function isReactCreateContextIn(scope: TSESLint.Scope.Scope): boolean {
  const variable = ASTUtils.findVariable(scope, CREATE_CONTEXT)
  return variable === null || variable.defs.every(isReactImport)
}

// A PascalCase name alone also fits a factory, whose context genuinely cannot move.
function rendererNameOf(frame: Frame): string | null {
  const name = functionNameOf(frame.node)
  if (name !== null && isHookName(name)) return name
  return componentNameOf(frame)
}

// Not fixable: hoisting is safe only when the default value closes over nothing in the component.
// Reads the callee text, so `createContext as createCtx` goes unseen.
export const noCreateContextInRender = ESLintUtils.RuleCreator.withoutDocs<[], 'inRender'>({
  meta: {
    type: 'problem',
    docs: { description: 'Disallow createContext() inside a component or hook body' },
    messages: {
      inRender:
        'Move this createContext(…) to module scope. Inside {{name}} it builds a new context object on every render, so the Provider and any useContext() consumer hold different objects and consumers silently read the default value.',
    },
    schema: [],
    defaultOptions: [],
  },
  create(context) {
    const { sourceCode } = context
    const stack: Frame[] = []

    const callsReactCreateContext = (call: TSESTree.CallExpression): boolean => {
      switch (createContextForm(call.callee)) {
        case 'namespaced': {
          return true
        }
        case 'bare': {
          return isReactCreateContextIn(sourceCode.getScope(call))
        }
        case null: {
          return false
        }
      }
    }

    const reportOrPassToEnclosing = (frame: Frame): void => {
      if (frame.calls.length === 0) return
      const renderer = rendererNameOf(frame)
      if (renderer !== null) {
        for (const call of frame.calls) {
          context.report({ node: call.callee, messageId: 'inRender', data: { name: renderer } })
        }
        return
      }
      // Any other function runs with whatever encloses it: a helper inside a component, not one at module scope.
      const enclosing = stack.at(-1)
      if (enclosing === undefined || isRetainedByStableHook(frame.node)) return
      enclosing.calls.push(...frame.calls)
    }

    return {
      ...functionFrameVisitors(stack, {
        ruleName: RULE_NAME,
        frameFor: (node) => ({ node, rendersJsx: false, calls: [] }),
        onLeave: reportOrPassToEnclosing,
      }),
      CallExpression(node) {
        if (!callsReactCreateContext(node) || isRetainedByStableHook(node)) return
        const frame = stack.at(-1)
        if (frame !== undefined) frame.calls.push(node)
      },
    }
  },
})
