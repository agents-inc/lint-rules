import { ASTUtils, AST_NODE_TYPES, ESLintUtils, TSESLint, type TSESTree } from '@typescript-eslint/utils'

import { calleeNameOf } from '../shared/callee-name.ts'
import { type FunctionNode, functionNameOf } from '../shared/function-name.ts'
import { isHookName } from '../shared/hook-name.ts'

// Reports wait for the frame's exit: the call is usually seen before the JSX that makes it a component.
type Frame = { node: FunctionNode; rendersJsx: boolean; calls: TSESTree.CallExpression[] }

const COMPONENT_NAME = /^[A-Z]/
const CREATE_CONTEXT = 'createContext'
// Only these modules' `createContext` is React's. `node:vm` exports one too, and a Solid component
// body runs once, so "on every render" would be false about it.
const REACT_MODULE = /^(preact(\/compat)?|react|use-context-selector)$/
// Hooks that keep their first argument: `useMemo(() => createContext(null), [])` and
// `useRef(createContext(null))` hold one context for the component's life.
const STABLE_HOOKS: ReadonlySet<string> = new Set(['useMemo', 'useState', 'useRef'])

function isRetainedByStableHook(node: FunctionNode | TSESTree.CallExpression): boolean {
  const { parent } = node
  if (parent.type !== AST_NODE_TYPES.CallExpression || parent.arguments[0] !== node) return false
  const name = calleeNameOf(parent.callee)
  return name !== null && STABLE_HOOKS.has(name)
}

// Bare `createContext(…)`, or `React.createContext(…)`. The member form is pinned to `React`:
// `vm.createContext(sandbox)` is a real Node API.
function createContextForm(callee: TSESTree.Expression): 'bare' | 'namespaced' | null {
  if (callee.type === AST_NODE_TYPES.Identifier) return callee.name === CREATE_CONTEXT ? 'bare' : null
  const isNamespaced =
    callee.type === AST_NODE_TYPES.MemberExpression &&
    !callee.computed &&
    callee.object.type === AST_NODE_TYPES.Identifier &&
    callee.object.name === 'React' &&
    callee.property.type === AST_NODE_TYPES.Identifier &&
    callee.property.name === CREATE_CONTEXT
  return isNamespaced ? 'namespaced' : null
}

function isReactImport(definition: TSESLint.Scope.Definition): boolean {
  return (
    definition.type === TSESLint.Scope.DefinitionType.ImportBinding &&
    definition.parent.type === AST_NODE_TYPES.ImportDeclaration &&
    REACT_MODULE.test(definition.parent.source.value)
  )
}

// A `createContext` the file declares, or imports from anywhere but React, is someone else's.
// One that resolves nowhere is React's own, off the UMD global.
function isReactCreateContextIn(scope: TSESLint.Scope.Scope): boolean {
  const variable = ASTUtils.findVariable(scope, CREATE_CONTEXT)
  return variable === null || variable.defs.every(isReactImport)
}

// React re-runs a hook, and a PascalCase function that renders JSX, on every render. A PascalCase
// name alone also fits a factory, whose context genuinely cannot move.
function rendererNameOf(frame: Frame): string | null {
  const name = functionNameOf(frame.node)
  if (name === null) return null
  return isHookName(name) || (COMPONENT_NAME.test(name) && frame.rendersJsx) ? name : null
}

// Not fixable: hoisting is safe only when the default value closes over nothing in the component.
// Reads the callee text, so `createContext as createCtx` and `ReactModule.createContext` go unseen.
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
      const form = createContextForm(call.callee)
      if (form === null) return false
      return form === 'namespaced' || isReactCreateContextIn(sourceCode.getScope(call))
    }

    const enter = (node: FunctionNode): void => {
      stack.push({ node, rendersJsx: false, calls: [] })
    }
    const leave = (): void => {
      const frame = stack.pop()
      if (frame === undefined) throw new Error('no-create-context-in-render left a function it never entered')
      if (frame.calls.length === 0) return
      const renderer = rendererNameOf(frame)
      if (renderer !== null) {
        for (const call of frame.calls) {
          context.report({ node: call.callee, messageId: 'inRender', data: { name: renderer } })
        }
        return
      }
      // Any other function is re-created and re-run with whatever encloses it, so its calls belong
      // to that: a helper inside a component, but not the same helper at module scope.
      const enclosing = stack.at(-1)
      if (enclosing === undefined || isRetainedByStableHook(frame.node)) return
      enclosing.calls.push(...frame.calls)
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
        if (!callsReactCreateContext(node) || isRetainedByStableHook(node)) return
        const frame = stack.at(-1)
        // No frame is module scope, where it belongs.
        if (frame !== undefined) frame.calls.push(node)
      },
    }
  },
})
