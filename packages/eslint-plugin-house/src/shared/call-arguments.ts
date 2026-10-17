import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils'

/** The call `node` is passed to: `fn(items)` receives `items` but not `fn`. */
export function callReceiving(node: TSESTree.Node, parent: TSESTree.Node): TSESTree.CallExpression | null {
  if (parent.type !== AST_NODE_TYPES.CallExpression) return null
  return parent.arguments.some((argument) => argument === node) ? parent : null
}
