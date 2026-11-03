import type { TSESLint, TSESTree } from '@typescript-eslint/utils'

export type Replacement = { range: TSESTree.Range; text: string }

export function fixReplacing({ range, text }: Readonly<Replacement>): TSESLint.ReportFixFunction {
  return (fixer) => fixer.replaceTextRange(range, text)
}
