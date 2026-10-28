import type { RuleCase } from './changed-settings.ts'

// The Effect rule the owner accepted on 2026-10-24, ported as a house rule: it reports a tag compared by hand in the
// callback of Effect's broad catch, Effect 3's catchAll or Effect 4's catch, and stays silent on catchTag, which does it
// in one call, and on the same comparison outside any Effect handler.

/** The shipped Effect rule's report cases beside its silent twins. */
export const ACCEPTED_EFFECT_CASES: readonly RuleCase[] = [
  {
    rule: 'house/no-manual-effect-error-tag',
    silentIn: [
      {
        path: 'src/handled-by-catch-tag.ts',
        source: `import { Effect } from 'effect'

export const recovered = load.pipe(Effect.catchTag('NotFound', () => Effect.succeed(null)))
`,
      },
      {
        path: 'src/compared-outside-a-handler.ts',
        source: `export function isNotFound(error: { readonly _tag: string }): boolean {
  return error._tag === 'NotFound'
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/compared-in-catch-all.ts',
        source: `import { Effect } from 'effect'

export const recovered = load.pipe(
  Effect.catchAll((error) => (error._tag === 'NotFound' ? Effect.succeed(null) : Effect.fail(error))),
)
`,
      },
      {
        path: 'src/compared-in-catch.js',
        source: `import { Effect } from 'effect'

export const recovered = load.pipe(
  Effect.catch((error) => (error._tag === 'NotFound' ? Effect.succeed(null) : Effect.fail(error))),
)
`,
      },
    ],
  },
]
