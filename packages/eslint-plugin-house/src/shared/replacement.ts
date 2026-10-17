import type { TSESTree } from '@typescript-eslint/utils'

export type Replacement = { range: TSESTree.Range; text: string }
