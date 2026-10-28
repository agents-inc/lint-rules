import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils'

// A bare `map(…)` names no method; a computed `items[map](…)` names its identifier.
export function methodNameOf(callee: Readonly<TSESTree.Expression>): string | null {
  return callee.type === AST_NODE_TYPES.MemberExpression && callee.property.type === AST_NODE_TYPES.Identifier
    ? callee.property.name
    : null
}

// A computed `hooks[useEffect](…)` names its identifier, unlike no-create-object-url-in-render's reading.
export function calleeNameOf(callee: Readonly<TSESTree.Expression>): string | null {
  return callee.type === AST_NODE_TYPES.Identifier ? callee.name : methodNameOf(callee)
}

/** The name after the dot in `object.name`; null for `object[name]`, `object.#name` and anything else. */
export function dottedPropertyNameOf(node: Readonly<TSESTree.Node>): string | null {
  return node.type === AST_NODE_TYPES.MemberExpression && !node.computed && node.property.type === AST_NODE_TYPES.Identifier
    ? node.property.name
    : null
}
