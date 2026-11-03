export const tagComparedInCatchAll = `import { Effect } from 'effect'

export const recovered = load.pipe(
  Effect.catchAll((error) => (error._tag === 'NotFound' ? Effect.succeed(null) : Effect.fail(error))),
)
`

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

export const keyReadThroughAVariableNamedTag = `import { Effect } from 'effect'

const _tag = 'code'

export const recovered = load.pipe(
  Effect.catchAll((error) => (error[_tag] === 'NotFound' ? Effect.succeed(null) : Effect.fail(error))),
)
`

export const EQUALITY_OPERATORS = ['===', '!==', '==', '!='] as const

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

export const reasonTagComparedInCatchTag = `import { Effect } from 'effect'

export const recovered = load.pipe(
  Effect.catchTag('Wrapper', (error) => (error.reason._tag === 'Timeout' ? retry : Effect.fail(error))),
)
`

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

export const tagAndReasonComparedInCatchAllAsJavaScript = `import { Effect } from 'effect'

export const recovered = load.pipe(
  Effect.catchAll((error) => (error._tag === 'NotFound' ? Effect.succeed(null) : Effect.fail(error))),
)

export const retried = load.pipe(
  Effect.catchAll((error) => (error.reason._tag === 'Timeout' ? retry : Effect.fail(error))),
)
`

export const tagJoinedToAStringInCatchAll = `import { Effect } from 'effect'

export const recovered = load.pipe(Effect.catchAll((error) => Effect.logError('failed: ' + error._tag)))
`

export const tagComparedWithNullInCatchAll = `import { Effect } from 'effect'

export const recovered = load.pipe(
  Effect.catchAll((error) => (error._tag === null ? Effect.succeed(null) : Effect.fail(error))),
)
`

export const tagComparedInAFunctionDeclaredInTheHandler = `import { Effect } from 'effect'

export const recovered = load.pipe(
  Effect.catchAll((error) => {
    function isNotFound() {
      return error._tag === 'NotFound'
    }
    return isNotFound() ? Effect.succeed(null) : Effect.fail(error)
  }),
)
`
