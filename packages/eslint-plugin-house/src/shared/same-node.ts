import type { TSESTree } from '@typescript-eslint/utils'

/** Whether `candidate` is `node` itself. Both are typed as any node, so a slot typed narrower, such as `arguments[0]` or a JSX attribute's value, compares with it. */
export function isSameNode(candidate: Readonly<TSESTree.Node> | null | undefined, node: Readonly<TSESTree.Node>): boolean {
  return candidate === node
}
