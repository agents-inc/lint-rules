// Parameters typed by instantiations of one generic mapped type (Pick, Required), read-only beside overwritable. Under
// the shipped options, functional/prefer-immutable-types reports each overwritable one (measured: eslint-plugin-functional
// 10.0.1, is-immutable-type 5.0.4). Engines lint files in path order, so a file named a- is linted before one named b-.

/** A file's path in the project, and its lines. */
export type ParameterSource = { readonly file: string; readonly lines: readonly string[] }

/**
 * eslint-plugin-functional keeps is-immutable-type's process-wide cache off where NODE_ENV is "test", which Vitest sets
 * for itself and every process a test starts: set to anything else, as in a team's own run, the cache is on.
 */
export const NODE_ENV_OUTSIDE_TESTS = { NODE_ENV: '' } as const

export const A_READONLY_PICK: ParameterSource = {
  file: 'src/a-readonly-pick.ts',
  lines: ['type Item = { readonly name: string; readonly size: number }', '', "export function nameOf({ name }: Pick<Item, 'name'>): string {", '  return name', '}'],
}

/** Overwritable at line 3. */
export const B_MUTABLE_PICK: ParameterSource = {
  file: 'src/b-mutable-pick.ts',
  lines: ['type Box = { name: string; size: number }', '', "export function sizeOf({ size }: Pick<Box, 'size'>): number {", '  return size', '}'],
}

/** Overwritable at line 3. */
export const A_MUTABLE_PICK: ParameterSource = { ...B_MUTABLE_PICK, file: 'src/a-mutable-pick.ts' }

export const B_READONLY_PICK: ParameterSource = { ...A_READONLY_PICK, file: 'src/b-readonly-pick.ts' }

/** The read-only parameter first; the overwritable one at line 8. */
export const BOTH_PICKS_IN_ONE_FILE: ParameterSource = {
  file: 'src/c-both-in-one-file.ts',
  lines: [
    'type Item = { readonly name: string; readonly size: number }',
    'type Box = { name: string; size: number }',
    '',
    "export function nameOf({ name }: Pick<Item, 'name'>): string {",
    '  return name',
    '}',
    '',
    "export function sizeOf({ size }: Pick<Box, 'size'>): number {",
    '  return size',
    '}',
  ],
}

export const A_READONLY_REQUIRED: ParameterSource = {
  file: 'src/a-readonly-required.ts',
  lines: ['type Item = { readonly name?: string }', '', 'export function nameOf({ name }: Required<Item>): string {', '  return name', '}'],
}

/** Overwritable at line 3. */
export const B_MUTABLE_REQUIRED: ParameterSource = {
  file: 'src/b-mutable-required.ts',
  lines: ['type Box = { size?: number }', '', 'export function sizeOf({ size }: Required<Box>): number {', '  return size', '}'],
}

/**
 * is-immutable-type's recursive case (its issue #98, which hung until the cache was keyed as it is): `foo` is
 * immutable all the way down, `bar`, at line 6, overwritable all the way down.
 */
export const RECURSIVE_TURTLES: ParameterSource = {
  file: 'src/turtles.ts',
  lines: [
    'type Foo<U> = { readonly a: U; readonly b: Foo<Foo<U>> }',
    'type Bar<U> = { a: U; b: Bar<Bar<U>> }',
    '',
    'export function turtles(',
    '  foo: Foo<string>,',
    '  bar: Bar<string>,',
    '): string {',
    '  return foo.a + bar.a',
    '}',
  ],
}

/**
 * For an in-memory program, which has no default library and so no Pick: a generic mapped type of its own, two of
 * whose instantiations the checker gives one recursion identity, beside the two object types they pick from, each
 * of which it identifies apart.
 */
export const TWO_INSTANTIATIONS_OF_ONE_GENERIC: Readonly<Record<string, string>> = {
  '/project/picked.ts': [
    'type Picked<T, K extends keyof T> = { [P in K]: T[P] }',
    'export type Item = { readonly name: string; readonly size: number }',
    'export type Box = { name: string; size: number }',
    "export type ReadonlyPicked = Picked<Item, 'name'>",
    "export type OverwritablePicked = Picked<Box, 'size'>",
    '',
  ].join('\n'),
}

/** The shipped options with parameters held to Immutable, the deepest a team can ask for. */
export const PARAMETERS_HELD_TO_IMMUTABLE: readonly unknown[] = [{ enforcement: 'None', ignoreInferredTypes: true, parameters: { enforcement: 'Immutable' } }]

/** functional/prefer-immutable-types' message: the least immutability its options ask of a parameter, and what it found. */
export function parameterImmutabilityMessage(least: string, actual: string): string {
  return `Parameter should have an immutability of at least "${least}" (actual: "${actual}").`
}
