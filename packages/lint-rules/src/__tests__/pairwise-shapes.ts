/** One way a shape varies: its name, and the values it takes there. */
export type Dimension<V> = { readonly name: string; readonly values: readonly V[] }

/** One value of each dimension, in the dimensions' order. */
export type Shape<V> = readonly V[]

/** How far a set of shapes reaches into every combination of the dimensions' values. */
export type ShapeCoverage = {
  readonly shapes: number
  readonly combinations: number
  readonly pairsMet: number
  readonly pairs: number
  readonly triplesMet: number
  readonly triples: number
}

/** A value of one dimension, by the positions of both. */
type Pick = { readonly dimension: number; readonly value: number }

/** A shape as the position of its value in each dimension. */
type Positions = readonly number[]

/** The position picked so far in each dimension: undefined where none is yet. */
type PartialPositions = readonly (number | undefined)[]

const PAIR = 2
const TRIPLE = 3
const PICK_SEPARATOR = '|'
const POSITION_SEPARATOR = ':'
const SHAPE_NAME_SEPARATOR = '; '

/** A shape's name, for a test's title: its values' names, in order. */
export function shapeNameOf(shape: Shape<{ readonly name: string }>): string {
  return shape.map(({ name }) => name).join(SHAPE_NAME_SEPARATOR)
}

/**
 * Shapes in which every two values of two dimensions meet, the seeds first: the values of one seed
 * meet in one shape. Greedy and in a fixed order: each later shape starts from the first two values
 * not yet met, and takes, in each other dimension in turn, the value that meets the most values not
 * yet met beside those picked, the first of equals.
 */
export function pairwiseShapes<V extends NonNullable<unknown>>(
  dimensions: readonly Dimension<V>[],
  seeds: readonly (readonly V[])[] = [],
): Shape<V>[] {
  const everyPair = combinationKeysOf(dimensions, PAIR)
  const seeded = seeds.reduce<Positions[]>(
    (shapes, seed) => [...shapes, completedShape(dimensions, picksOfSeed(dimensions, seed), pairsNotMetBy(everyPair, shapes))],
    [],
  )
  return shapesMeetingEveryPair(dimensions, seeded, everyPair).map((positions) => valuesAt(dimensions, positions))
}

/** Each two values of two dimensions that meet in none of the shapes. */
export function pairsMetInNoShape<V extends NonNullable<unknown>>(
  dimensions: readonly Dimension<V>[],
  shapes: readonly Shape<V>[],
): Shape<V>[] {
  const notMet = pairsNotMetBy(
    combinationKeysOf(dimensions, PAIR),
    shapes.map((shape) => positionsIn(dimensions, shape)),
  )
  return [...notMet].map((key) => picksOfKey(key).map((pick) => valueAt(dimensions, pick)))
}

/** How many shapes and combinations there are, and how many of all pairs and triples of values the shapes meet. */
export function coverageOf<V extends NonNullable<unknown>>(dimensions: readonly Dimension<V>[], shapes: readonly Shape<V>[]): ShapeCoverage {
  const positions = shapes.map((shape) => positionsIn(dimensions, shape))
  const metOf = (size: number): number => new Set(positions.flatMap((shape) => combinationKeysIn(shape, size))).size
  return {
    shapes: shapes.length,
    combinations: dimensions.reduce((product, { values }) => product * values.length, 1),
    pairsMet: metOf(PAIR),
    pairs: combinationKeysOf(dimensions, PAIR).length,
    triplesMet: metOf(TRIPLE),
    triples: combinationKeysOf(dimensions, TRIPLE).length,
  }
}

function shapesMeetingEveryPair<V>(dimensions: readonly Dimension<V>[], shapes: readonly Positions[], everyPair: readonly string[]): Positions[] {
  const notYetMet = pairsNotMetBy(everyPair, shapes)
  const [firstNotYetMet] = notYetMet
  if (firstNotYetMet === undefined) return [...shapes]
  const next = completedShape(dimensions, picksOfKey(firstNotYetMet), notYetMet)
  return shapesMeetingEveryPair(dimensions, [...shapes, next], everyPair)
}

/** The pairs none of the shapes meets, in the order given. */
function pairsNotMetBy(everyPair: readonly string[], shapes: readonly Positions[]): ReadonlySet<string> {
  const met = new Set(shapes.flatMap((shape) => combinationKeysIn(shape, PAIR)))
  return new Set(everyPair.filter((key) => !met.has(key)))
}

/** A seed's values, each in the one dimension that holds it, no two in one dimension. */
function picksOfSeed<V>(dimensions: readonly Dimension<V>[], seed: readonly V[]): Pick[] {
  const picks = seed.map((value) => pickOf(dimensions, value))
  const dimensionNames = picks.map(({ dimension }) => nameOf(dimensions, dimension))
  if (new Set(dimensionNames).size !== picks.length) throw new Error(`a seed gives two values of one dimension: ${dimensionNames.join(', ')}`)
  return picks
}

function pickOf<V>(dimensions: readonly Dimension<V>[], value: V): Pick {
  const picks = dimensions.flatMap(({ values }, dimension): Pick[] => {
    const position = values.indexOf(value)
    return position === -1 ? [] : [{ dimension, value: position }]
  })
  const [pick] = picks
  if (pick === undefined || picks.length > 1) {
    throw new Error(`a seed value must be a value of exactly one dimension, and is one of ${String(picks.length)}`)
  }
  return pick
}

function completedShape<V>(dimensions: readonly Dimension<V>[], picks: readonly Pick[], notYetMet: ReadonlySet<string>): Positions {
  const started: PartialPositions = dimensions.map((_, dimension) => picks.find((pick) => pick.dimension === dimension)?.value)
  const completed = dimensions.reduce<PartialPositions>(
    (shape, { values }, dimension) =>
      shape[dimension] === undefined ? shape.with(dimension, positionMeetingMost(shape, dimension, values.length, notYetMet)) : shape,
    started,
  )
  return completed.map((position, dimension) => {
    if (position === undefined) throw new Error(`no value was picked in dimension ${String(dimension)}`)
    return position
  })
}

/** The position in the dimension whose value meets the most values not yet met beside those picked: the first of equals. */
function positionMeetingMost(shape: PartialPositions, dimension: number, valueCount: number, notYetMet: ReadonlySet<string>): number {
  const meetsNotYetMet =
    (value: number) =>
    (other: number | undefined, otherDimension: number): boolean =>
      other !== undefined && notYetMet.has(pairKeyOf({ dimension, value }, { dimension: otherDimension, value: other }))
  const counts = Array.from({ length: valueCount }, (_, value) => shape.filter(meetsNotYetMet(value)).length)
  return counts.indexOf(Math.max(...counts))
}

function positionsIn<V>(dimensions: readonly Dimension<V>[], shape: Shape<V>): Positions {
  if (shape.length !== dimensions.length) throw new Error(`a shape gives ${String(shape.length)} values for ${String(dimensions.length)} dimensions`)
  return shape.map((value, dimension) => {
    const position = valuesOf(dimensions, dimension).indexOf(value)
    if (position === -1) throw new Error(`a shape gives a value ${nameOf(dimensions, dimension)} does not have`)
    return position
  })
}

/** The key of every combination of `size` values of `size` different dimensions. */
function combinationKeysOf<V>(dimensions: readonly Dimension<V>[], size: number): string[] {
  return dimensionSubsetsOf(dimensions.length, size).flatMap((subset) =>
    productOf(subset.map((dimension) => valuesOf(dimensions, dimension).map((_, value): Pick => ({ dimension, value })))).map(keyOfPicks),
  )
}

/** The key of every combination of `size` of the shape's values. */
function combinationKeysIn(shape: Positions, size: number): string[] {
  return dimensionSubsetsOf(shape.length, size).map((subset) =>
    keyOfPicks(subset.map((dimension) => ({ dimension, value: positionIn(shape, dimension) }))),
  )
}

function pairKeyOf(first: Pick, second: Pick): string {
  return keyOfPicks([first, second].toSorted((one, other) => one.dimension - other.dimension))
}

/** Every way to choose `size` of the dimensions from `from` on, each in ascending order. */
function dimensionSubsetsOf(count: number, size: number, from = 0): number[][] {
  if (size === 0) return [[]]
  const candidates = Array.from({ length: Math.max(count - from, 0) }, (_, offset) => from + offset)
  return candidates.flatMap((dimension) => dimensionSubsetsOf(count, size - 1, dimension + 1).map((rest) => [dimension, ...rest]))
}

function productOf(lists: readonly (readonly Pick[])[]): Pick[][] {
  return lists.reduce<Pick[][]>((product, list) => product.flatMap((picks) => list.map((pick) => [...picks, pick])), [[]])
}

function keyOfPicks(picks: readonly Pick[]): string {
  return picks.map(({ dimension, value }) => `${String(dimension)}${POSITION_SEPARATOR}${String(value)}`).join(PICK_SEPARATOR)
}

function picksOfKey(key: string): Pick[] {
  return key.split(PICK_SEPARATOR).map((part) => {
    const [dimension, value] = part.split(POSITION_SEPARATOR).map(Number)
    if (dimension === undefined || value === undefined) throw new Error(`${part} is not a dimension and position`)
    return { dimension, value }
  })
}

function positionIn(shape: Positions, dimension: number): number {
  const position = shape[dimension]
  if (position === undefined) throw new Error(`a shape has no value in dimension ${String(dimension)}`)
  return position
}

function valuesAt<V extends NonNullable<unknown>>(dimensions: readonly Dimension<V>[], positions: Positions): Shape<V> {
  return positions.map((value, dimension) => valueAt(dimensions, { dimension, value }))
}

function valueAt<V extends NonNullable<unknown>>(dimensions: readonly Dimension<V>[], { dimension, value }: Pick): V {
  const found = valuesOf(dimensions, dimension)[value]
  if (found === undefined) throw new Error(`${nameOf(dimensions, dimension)} has no value at ${String(value)}`)
  return found
}

function valuesOf<V>(dimensions: readonly Dimension<V>[], dimension: number): readonly V[] {
  return dimensionAt(dimensions, dimension).values
}

function nameOf<V>(dimensions: readonly Dimension<V>[], dimension: number): string {
  return dimensionAt(dimensions, dimension).name
}

function dimensionAt<V>(dimensions: readonly Dimension<V>[], dimension: number): Dimension<V> {
  const found = dimensions[dimension]
  if (found === undefined) throw new Error(`there is no dimension ${String(dimension)}`)
  return found
}
