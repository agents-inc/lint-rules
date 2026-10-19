// Never run: typecheck fails when the shared tsconfig's lib stops declaring an API a rule's fix
// writes and Node 22 has, or declares one Node 22 lacks: its `@ts-expect-error` goes unused.
import { expectTypeOf } from 'vitest'

declare const lengthsByWord: ReadonlyMap<string, number>
declare const seen: ReadonlySet<string>
declare const wanted: ReadonlySet<string>
declare const words: readonly string[]
declare const lengthOf: (word: string) => number
declare const literalText: string

expectTypeOf(lengthsByWord.keys().toArray()).toEqualTypeOf<string[]>()
expectTypeOf(lengthsByWord.values().map(String).toArray()).toEqualTypeOf<string[]>()

expectTypeOf(seen.union(wanted)).toEqualTypeOf<Set<string>>()
expectTypeOf(seen.intersection(wanted)).toEqualTypeOf<Set<string>>()
expectTypeOf(seen.difference(wanted)).toEqualTypeOf<Set<string>>()
expectTypeOf(seen.symmetricDifference(wanted)).toEqualTypeOf<Set<string>>()
expectTypeOf(seen.isSubsetOf(wanted)).toEqualTypeOf<boolean>()
expectTypeOf(seen.isSupersetOf(wanted)).toEqualTypeOf<boolean>()
expectTypeOf(seen.isDisjointFrom(wanted)).toEqualTypeOf<boolean>()

expectTypeOf(Map.groupBy(words, lengthOf)).toEqualTypeOf<Map<number, string[]>>()

expectTypeOf(Promise.withResolvers<string>()).toEqualTypeOf<PromiseWithResolvers<string>>()

// @ts-expect-error Promise.try is ES2025, and Node 22 lacks it
expectTypeOf(Promise.try(lengthOf, literalText)).toEqualTypeOf<Promise<number>>()

// @ts-expect-error RegExp.escape is ES2025, and Node 22 lacks it
expectTypeOf(RegExp.escape(literalText)).toEqualTypeOf<string>()

// @ts-expect-error Float16Array is ES2025, and Node 22 lacks it
expectTypeOf(new Float16Array(words.length)).toEqualTypeOf<Float16Array<ArrayBuffer>>()

// @ts-expect-error Intl.DurationFormat is ES2025, and Node 22 lacks it
expectTypeOf(new Intl.DurationFormat()).toEqualTypeOf<Intl.DurationFormat>()
