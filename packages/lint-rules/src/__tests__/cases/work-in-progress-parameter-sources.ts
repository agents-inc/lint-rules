import type { ParameterSource } from './pick-parameter-sources.ts'

// Parameters whose types is-immutable-type first meets while working out a type around them, reading that type's
// answer before it is final (a recursion its guard ends early, or a partial answer), or the answer it last worked out
// for a type beside them. What it works out from such a read holds for that one question, not for a later one.

/**
 * A type holding an overwritable Pick, met first inside a Pick of another type, where the guard takes the inner Pick
 * for the outer one, then as a parameter of its own: ReadonlyShallow, at line 9.
 */
export const A_PICK_HELD_INSIDE_A_PICK: ParameterSource = {
  file: 'src/holder.ts',
  lines: [
    'type Box = { a: string }',
    "type Holder = { readonly p: Pick<Box, 'a'> }",
    'type Outer = { readonly b: Holder }',
    '',
    "export function viaPick({ b }: Pick<Outer, 'b'>): Holder {",
    '  return b',
    '}',
    '',
    'export function direct({ p }: Holder): string {',
    '  return p.a',
    '}',
  ],
}

/**
 * Slot met while Shelf, which holds it, has only a partial answer: Shelf's overwritable number index comes after it.
 * Both parameters are ReadonlyShallow, at lines 5 and 9.
 */
export const A_TYPE_MET_WHILE_ITS_HOLDER_IS_HALF_WORKED_OUT: ParameterSource = {
  file: 'src/shelf.ts',
  lines: [
    'type Shelf = { readonly label: string; readonly [key: string]: string | Slot; [index: number]: string }',
    'type Slot = { readonly shelf: Shelf; readonly name: string }',
    'type Rack = { readonly slot: Slot }',
    '',
    'export function labelOf(shelf: Shelf): string {',
    '  return shelf.label',
    '}',
    '',
    'export function nameOf(rack: Rack): string {',
    '  return rack.slot.name',
    '}',
  ],
}

/**
 * Wrap met after a Pick held inside a Pick, reading the answer worked out for Holder there. Both parameters are
 * ReadonlyShallow, at lines 8 and 12.
 */
export const A_TYPE_MET_BESIDE_A_PICK_HELD_INSIDE_A_PICK: ParameterSource = {
  file: 'src/root.ts',
  lines: [
    'type Box = { a: string }',
    "type Holder = { readonly p: Pick<Box, 'a'> }",
    'type Outer = { readonly b: Holder }',
    'type Wrap = { readonly h: Holder }',
    "type Root = { readonly m: { n: string }; readonly w: Wrap; readonly o: Pick<Outer, 'b'> }",
    'type Shell = { readonly w: Wrap }',
    '',
    'export function fromRoot(root: Root): string {',
    '  return root.w.h.p.a',
    '}',
    '',
    'export function fromShell(shell: Shell): string {',
    '  return shell.w.h.p.a',
    '}',
  ],
}

/**
 * Middle holds Holder, which holds an overwritable Pick, and is met first inside a Pick of another type, where the
 * guard takes the innermost Pick for the outer one. Both parameters are ReadonlyShallow, at lines 7 and 11.
 */
export const A_TYPE_HOLDING_A_PICK_HELD_INSIDE_A_PICK: ParameterSource = {
  file: 'src/middle.ts',
  lines: [
    'type Box = { a: string }',
    "type Holder = { readonly p: Pick<Box, 'a'> }",
    'type Middle = { readonly h: Holder }',
    'type Outer = { readonly m: Middle }',
    "type Root = { readonly n: { x: string }; readonly o: Pick<Outer, 'm'> }",
    '',
    'export function fromRoot(root: Root): string {',
    '  return root.o.m.h.p.a',
    '}',
    '',
    'export function fromMiddle(middle: Middle): string {',
    '  return middle.h.p.a',
    '}',
  ],
}

/**
 * Loop refers only to itself, so working it out inside Holder reads the answer last worked out there, for the
 * overwritable box beside it. Only Holder's parameter is ReadonlyShallow, at line 5; Shell's, at line 9, is Immutable.
 */
export const A_TYPE_REFERRING_ONLY_TO_ITSELF_BESIDE_AN_OVERWRITABLE_OBJECT: ParameterSource = {
  file: 'src/loop.ts',
  lines: [
    'type Loop = { readonly next: Loop }',
    'type Holder = { readonly loop: Loop; readonly box: { m: string } }',
    'type Shell = { readonly loop: Loop }',
    '',
    'export function first(holder: Holder): Loop {',
    '  return holder.loop',
    '}',
    '',
    'export function second(shell: Shell): Loop {',
    '  return shell.loop',
    '}',
  ],
}

/**
 * Readings has only an index signature, so working it out inside Holder reads the answer last worked out there, for
 * the overwritable box beside it. The parameter at line 9, Readings or undefined, is ReadonlyShallow; the one at
 * line 13 is Mutable.
 */
export const A_READ_ONLY_RECORD_MET_BESIDE_AN_OVERWRITABLE_OBJECT: ParameterSource = {
  file: 'src/readings.ts',
  lines: [
    'type Readings = { readonly [key: string]: string }',
    'type Holder = { readonly readings: Readings; readonly box: { m: string } }',
    'type Maybe<T> = T | undefined',
    '',
    'export function first(holder: Holder): string {',
    '  return holder.box.m',
    '}',
    '',
    'export function second(readings: Maybe<Readings>): string | undefined {',
    "  return readings?.['a']",
    '}',
    '',
    'export function third(box: { m: string }): string {',
    '  return box.m',
    '}',
  ],
}
