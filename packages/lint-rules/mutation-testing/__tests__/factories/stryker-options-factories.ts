import type { StrykerOptions } from '../../stryker-round.ts'

/** A config's options holding `mutate` as given, whatever it holds. */
export function strykerOptionsWithMutate(mutate: unknown): StrykerOptions {
  return { mutate }
}

/** A config's options that hold no `mutate` key. */
export function strykerOptionsWithoutMutate(): StrykerOptions {
  return {}
}
