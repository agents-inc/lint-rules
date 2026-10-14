import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils'

// `useEffect(…)` and `React.useEffect(…)` both name `useEffect`. A computed `hooks[useEffect](…)`
// names its identifier too, unlike no-create-object-url-in-render's stricter reading.
export function calleeNameOf(callee: TSESTree.Expression): string | null {
  if (callee.type === AST_NODE_TYPES.Identifier) return callee.name
  if (callee.type === AST_NODE_TYPES.MemberExpression && callee.property.type === AST_NODE_TYPES.Identifier) {
    return callee.property.name
  }
  return null
}
