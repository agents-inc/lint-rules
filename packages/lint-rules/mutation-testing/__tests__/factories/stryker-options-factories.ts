import type { StrykerOptions } from '../../stryker-round.ts'

export function strykerOptionsWithMutate(mutate: unknown): StrykerOptions {
  return { mutate }
}

export function strykerOptionsWithoutMutate(): StrykerOptions {
  return {}
}
