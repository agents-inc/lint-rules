// Union types as written after `export type Union =`: object types, mapped types, void, null and
// undefined among the other kinds, in orders the sorting rules disagree about.

export const unionsToConverge = [
  '{ a: 1 } | null',
  'null | { a: 1 }',
  '{ a: 1 } | string',
  'string | { a: 1 }',
  'undefined | null | string',
  'undefined | { a: 1 } | string | null',
  '{ [K in Keys]: 1 } | { a: 1 } | string | undefined',
  '{ a: 1 } | { [K in Keys]: 1 } | string',
  '{ readonly [K in Keys]: 1 } | null | number',
  '{ -readonly [K in Keys]?: 1 } | { a: 1 } | void',
  'void | Promise<void>',
  'null | void | string',
  'void | null | string | { a: 1 }',
  '(() => void) | { a: 1 } | A & { b: 1 } | null',
  "'z' | 'a' | { b: 1 } | { a: 1 } | undefined",
  '{ a: 1 } | { [K in Keys]: 1 } | null | undefined | void',
  'string | { a: 1 }[] | null',
  '{ a: 1 } | [string] | Record<string, 1>',
  '\n  | null\n  | { a: 1 }\n  | string',
]

export const unionsLeftAsWritten = ['{ a: 1 } | null', 'string | { a: 1 } | null | undefined']

export const unionSorts = [
  { order: 'null after object types', union: 'null | { a: 1 }', sorted: '{ a: 1 } | null' },
  { order: 'object types after the other types', union: '{ a: 1 } | string', sorted: 'string | { a: 1 }' },
  { order: 'null before undefined, both last', union: 'undefined | null | string', sorted: 'string | null | undefined' },
  {
    order: 'others, object types, then nullish',
    union: 'undefined | { a: 1 } | string | null',
    sorted: 'string | { a: 1 } | null | undefined',
  },
  {
    order: 'a mapped type before object types',
    union: '{ a: 1 } | { [K in Keys]: 1 } | string',
    sorted: '{ [K in Keys]: 1 } | string | { a: 1 }',
  },
  {
    order: 'a readonly mapped type before null',
    union: '{ readonly [K in Keys]: 1 } | null | number',
    sorted: '{ readonly [K in Keys]: 1 } | number | null',
  },
  { order: 'void alphabetically among the others', union: 'void | Promise<void>', sorted: 'Promise<void> | void' },
  { order: 'void among the others, before null', union: 'null | void | string', sorted: 'string | void | null' },
  {
    order: 'a one-member-per-line union, layout kept',
    union: '\n  | null\n  | { a: 1 }\n  | string',
    sorted: '\n  | string\n  | { a: 1 }\n  | null',
  },
]
