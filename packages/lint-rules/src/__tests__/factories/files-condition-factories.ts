import type { FilesTerm } from '../../core/file-conditions.ts'

/** A draw from a seeded sequence: a whole number below the bound given. */
export type Draw = (bound: number) => number

// The constants of the linear congruential generator glibc's rand uses, so a seed gives one sequence everywhere.
const MULTIPLIER = 1_103_515_245
const INCREMENT = 12_345
const MODULUS = 2 ** 31
const MAX_GLOBS_IN_A_LIST = 3
const MAX_TERMS = 4
// One glob of `all` in this many is negated.
const NEGATED_ONE_IN = 6

export function seededDraws(seed: number): Draw {
  let state = seed
  return (bound) => {
    state = (state * MULTIPLIER + INCREMENT) % MODULUS
    return state % bound
  }
}

/** One to four terms, each glob of `all` negated now and then, as merged block globs are. */
export function buildDrawnTerms(draw: Draw, globs: readonly string[]): FilesTerm[] {
  return Array.from({ length: 1 + draw(MAX_TERMS) }, () => buildDrawnTerm(draw, globs))
}

function buildDrawnTerm(draw: Draw, globs: readonly string[]): FilesTerm {
  const pick = (): string => {
    const glob = globs[draw(globs.length)]
    if (glob === undefined) throw new Error('a draw falls within the globs given')
    return glob
  }
  return {
    all: Array.from({ length: draw(MAX_GLOBS_IN_A_LIST) }, () => (draw(NEGATED_ONE_IN) === 0 ? `!${pick()}` : pick())),
    none: Array.from({ length: draw(MAX_GLOBS_IN_A_LIST) }, pick),
  }
}

/** A file meets it where it matches each of `all` and none of `none`. */
export function buildFilesTerm(all: readonly string[], none: readonly string[] = []): FilesTerm {
  return { all: [...all], none: [...none] }
}
