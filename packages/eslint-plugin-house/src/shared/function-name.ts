import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils'

export type FunctionNode = TSESTree.ArrowFunctionExpression | TSESTree.FunctionDeclaration | TSESTree.FunctionExpression

export function isFunctionNode(node: TSESTree.Node): node is FunctionNode {
  return (
    node.type === AST_NODE_TYPES.ArrowFunctionExpression ||
    node.type === AST_NODE_TYPES.FunctionDeclaration ||
    node.type === AST_NODE_TYPES.FunctionExpression
  )
}

/** Its own name, or the variable or property it is assigned to, as in `const Panel = memo(() => …)`. */
export function functionNameOf(fn: FunctionNode): string | null {
  if (fn.id !== null) return fn.id.name
  const { parent } = fn
  if (parent.type === AST_NODE_TYPES.VariableDeclarator && parent.id.type === AST_NODE_TYPES.Identifier) {
    return parent.id.name
  }
  if (parent.type === AST_NODE_TYPES.Property && parent.key.type === AST_NODE_TYPES.Identifier) return parent.key.name
  if (parent.type === AST_NODE_TYPES.CallExpression && parent.parent.type === AST_NODE_TYPES.VariableDeclarator) {
    return parent.parent.id.type === AST_NODE_TYPES.Identifier ? parent.parent.id.name : null
  }
  return null
}
