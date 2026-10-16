import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils'

// `items.map(…)` names the method `map`; a bare `map(…)` names no method. Computed `items[map](…)`
// names its identifier too.
export function methodNameOf(callee: TSESTree.Expression): string | null {
  return callee.type === AST_NODE_TYPES.MemberExpression && callee.property.type === AST_NODE_TYPES.Identifier
    ? callee.property.name
    : null
}

// `useEffect(…)` and `React.useEffect(…)` both name `useEffect`. A computed `hooks[useEffect](…)`
// names its identifier too, unlike no-create-object-url-in-render's stricter reading.
export function calleeNameOf(callee: TSESTree.Expression): string | null {
  return callee.type === AST_NODE_TYPES.Identifier ? callee.name : methodNameOf(callee)
}
