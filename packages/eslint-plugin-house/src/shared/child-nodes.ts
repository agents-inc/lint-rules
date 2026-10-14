import type { TSESTree } from '@typescript-eslint/utils'

function isNode(value: unknown): value is TSESTree.Node {
  return typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string'
}

function valuesIn(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [value]
}

/**
 * Every node one level below `node`, in key order. Read from the node's own keys rather than
 * ESLint's visitor keys, so type annotations count as children too.
 */
export function childNodesOf(node: TSESTree.Node): TSESTree.Node[] {
  return Object.entries(node)
    .filter(([key]) => key !== 'parent')
    .flatMap(([, value]: [string, unknown]) => valuesIn(value))
    .filter(isNode)
}
