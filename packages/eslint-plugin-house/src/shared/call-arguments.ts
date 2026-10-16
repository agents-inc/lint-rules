import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils'

/**
 * The call that `node` is passed to, read from its `parent`: `items.map(fn)` receives `fn`, and
 * `fn(items)` receives `items` but not `fn`.
 */
export function callReceiving(node: TSESTree.Node, parent: TSESTree.Node): TSESTree.CallExpression | null {
  if (parent.type !== AST_NODE_TYPES.CallExpression) return null
  return parent.arguments.some((argument) => argument === node) ? parent : null
}
