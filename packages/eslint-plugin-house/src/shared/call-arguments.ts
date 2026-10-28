import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils'

/** The call `node` is passed to: `fn(items)` receives `items` but not `fn`. */
export function callReceiving(node: Readonly<TSESTree.Node>, parent: Readonly<TSESTree.Node>): TSESTree.CallExpression | null {
  if (parent.type !== AST_NODE_TYPES.CallExpression) return null
  const argumentNodes: readonly TSESTree.Node[] = parent.arguments
  return argumentNodes.includes(node) ? parent : null
}
