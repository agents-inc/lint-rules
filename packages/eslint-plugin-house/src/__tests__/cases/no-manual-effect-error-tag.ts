// Effect code for the house port of anti-slop-effect/no-manual-effect-error-tag (dmmulroy/anti-slop, commit c44ef22).
// Effect 3's broad catch is catchAll, Effect 4's is catch; both have catchIf, whose handler is its second argument.

/** The card's example: a tag compared in catchAll's callback, which catchTag does in one call. */
export const tagComparedInCatchAll = `import { Effect } from 'effect'

export const recovered = load.pipe(
  Effect.catchAll((error) => (error._tag === 'NotFound' ? Effect.succeed(null) : Effect.fail(error))),
)
`

/** The card's fix: catchTag handles the one tag and lets every other failure through. */
export const tagHandledByCatchTag = `import { Effect } from 'effect'

export const recovered = load.pipe(Effect.catchTag('NotFound', () => Effect.succeed(null)))
`

export const tagComparedInCatch = `import { Effect } from 'effect'

export const recovered = load.pipe(
  Effect.catch((error) => (error._tag === 'NotFound' ? Effect.succeed(null) : Effect.fail(error))),
)
`

export const tagSwitchedInCatchIf = `import { Effect } from 'effect'

export const recovered = load.pipe(
  Effect.catchIf(isRecoverable, (error) => {
    switch (error._tag) {
      case 'NotFound':
        return Effect.succeed(null)
      default:
        return Effect.fail(error)
    }
  }),
)
`

export const reasonTagComparedInCatchAllFunction = `import { Effect } from 'effect'

export const recovered = load.pipe(
  Effect.catchAll(function retryOnTimeout(error) {
    return error.reason._tag === 'Timeout' ? retry : Effect.fail(error)
  }),
)
`

export const reasonTagReadByAComputedKey = `import { Effect } from 'effect'

export const recovered = load.pipe(
  Effect.catchAll((error) => (error['reason']._tag === 'Timeout' ? retry : Effect.fail(error))),
)
`

export const tagSwitchedOnAReasonInCatchAll = `import { Effect } from 'effect'

export const recovered = load.pipe(
  Effect.catchAll((error) => {
    switch (error.reason._tag) {
      case 'Timeout':
        return retry
      default:
        return Effect.fail(error)
    }
  }),
)
`

export const tagOnTheRightOfTheComparison = `import { Effect } from 'effect'

export const recovered = load.pipe(
  Effect.catchAll((error) => ('NotFound' === error._tag ? Effect.succeed(null) : Effect.fail(error))),
)
`

export const tagReadByAComputedKey = `import { Effect } from 'effect'

export const recovered = load.pipe(
  Effect.catchAll((error) => (error['_tag'] === 'NotFound' ? Effect.succeed(null) : Effect.fail(error))),
)
`

/** Each comparison that tells one tag from the rest. */
export const EQUALITY_OPERATORS = ['===', '!==', '==', '!='] as const

/** The card's example, comparing the tag with the given operator. */
export function tagComparedInCatchAllWith(operator: string): string {
  return `import { Effect } from 'effect'

export const recovered = load.pipe(
  Effect.catchAll((error) => (error._tag ${operator} 'NotFound' ? Effect.succeed(null) : Effect.fail(error))),
)
`
}

export const tagComparedOutsideAnyHandler = `export function isNotFound(error: { readonly _tag: string }): boolean {
  return error._tag === 'NotFound'
}
`

export const tagSwitchedInAReducer = `type Action = { readonly _tag: 'Opened' } | { readonly _tag: 'Closed' }

export function isOpen(open: boolean, action: Action): boolean {
  switch (action._tag) {
    case 'Opened':
      return true
    case 'Closed':
      return false
  }
}
`

/** Upstream's own valid case: catchTag has already chosen the outer tag, so the reason is the next level down. */
export const reasonTagComparedInCatchTag = `import { Effect } from 'effect'

export const recovered = load.pipe(
  Effect.catchTag('Wrapper', (error) => (error.reason._tag === 'Timeout' ? retry : Effect.fail(error))),
)
`

/** The comparison is in a callback of the handler's, and tests the items, not the failure. */
export const tagComparedInAFunctionNestedInTheHandler = `import { Effect } from 'effect'

export const recovered = load.pipe(
  Effect.catchAll(() => Effect.succeed(items.filter((item) => item._tag === 'Done'))),
)
`

export const tagComparedInAStreamCatchAll = `import { Stream } from 'effect'

export const recovered = events.pipe(
  Stream.catchAll((error) => (error._tag === 'NotFound' ? Stream.empty : Stream.fail(error))),
)
`

export const tagComparedWithAVariable = `import { Effect } from 'effect'

export const recover = (expectedTag: string) =>
  load.pipe(Effect.catchAll((error) => (error._tag === expectedTag ? Effect.succeed(null) : Effect.fail(error))))
`

export const anotherFieldComparedInCatchAll = `import { Effect } from 'effect'

export const recovered = load.pipe(
  Effect.catchAll((error) => (error.code === 'NotFound' ? Effect.succeed(null) : Effect.fail(error))),
)
`

/** As ESLint lints a `.js` file with no TypeScript parser: the card's example, then the reason form. */
export const tagAndReasonComparedInCatchAllAsJavaScript = `import { Effect } from 'effect'

export const recovered = load.pipe(
  Effect.catchAll((error) => (error._tag === 'NotFound' ? Effect.succeed(null) : Effect.fail(error))),
)

export const retried = load.pipe(
  Effect.catchAll((error) => (error.reason._tag === 'Timeout' ? retry : Effect.fail(error))),
)
`

/** A tag joined to a string by `+`, as a log line does: no comparison at all. */
export const tagJoinedToAStringInCatchAll = `import { Effect } from 'effect'

export const recovered = load.pipe(Effect.catchAll((error) => Effect.logError('failed: ' + error._tag)))
`

/** null is a literal, but names no tag. */
export const tagComparedWithNullInCatchAll = `import { Effect } from 'effect'

export const recovered = load.pipe(
  Effect.catchAll((error) => (error._tag === null ? Effect.succeed(null) : Effect.fail(error))),
)
`
