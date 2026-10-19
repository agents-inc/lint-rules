import { GLOBS_GIVEN_FOR_SUPPRESSIONS } from '../factories/lint-rules-factories.ts'

type ValueDescribedByKind = { readonly given: string; readonly value: unknown; readonly described: string }

// An array is described as one, not by its items, which would read as a string given.
export const VALUES_DESCRIBED_BY_KIND: readonly ValueDescribedByKind[] = [
  { given: 'an object', value: GLOBS_GIVEN_FOR_SUPPRESSIONS, described: 'an object' },
  { given: 'an array', value: GLOBS_GIVEN_FOR_SUPPRESSIONS.files, described: 'an array' },
  { given: 'null', value: null, described: 'null' },
]
