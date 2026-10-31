import type { ParameterSource } from './pick-parameter-sources.ts'

// Parameters typed by two instantiations of one generic interface, whose type arguments differ in how far they can be
// overwritten. The checker gives both one recursion identity, the key is-immutable-type (5.0.4) keeps each answer under.

/** Immutable all the way down first; the one holding an overwritable object, ReadonlyShallow, at line 9. */
export const BOTH_SHELVES_IN_ONE_FILE: ParameterSource = {
  file: 'src/shelves.ts',
  lines: [
    'type Counted = { readonly count: number }',
    'type Tally = { count: number }',
    'interface Shelf<T> { readonly item: T }',
    '',
    'export function countOf({ item }: Shelf<Counted>): number {',
    '  return item.count',
    '}',
    '',
    'export function tallyOf({ item }: Shelf<Tally>): number {',
    '  return item.count',
    '}',
  ],
}
