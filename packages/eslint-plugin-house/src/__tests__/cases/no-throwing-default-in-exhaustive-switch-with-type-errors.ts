// Cases holding a type error as written. The cross-check against TypeScript reads the rule's other cases, every one of
// which must compile, so these are kept apart from them.

export const throwingDefaultOnACallInAFileWithATypeErrorElsewhere = `type Engine = 'eslint' | 'oxlint'

declare function engineOf(path: string): Engine

export const retries: number = 'three'

export function binOf(path: string): string {
  switch (engineOf(path)) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

// Switching on a const holding the value fixes the error in the first case, where `holder` is narrowed to `Holder`,
// and makes one in the second, where `holder` is no longer narrowed: one error for another, so the fix does not compile.
export const throwingDefaultOnAnOptionalChainWhereAConstHoldingItTradesOneTypeErrorForAnother = `type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; side: number }

type Holder = { shape: Shape }

export function areaOf(holder: Holder | undefined): number {
  switch (holder?.shape.kind) {
    case 'circle': {
      const missing: Exclude<typeof holder, Holder> = undefined
      return missing === undefined ? 1 : 0
    }
    case 'square':
      return holder.shape.kind.length
    case undefined:
      return 0
    default:
      throw new Error('no such shape')
  }
}
`
