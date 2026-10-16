import type { TSESTree } from '@typescript-eslint/utils'

/** A fix as data: the range it replaces and the text that goes there. */
export type Replacement = { range: TSESTree.Range; text: string }
