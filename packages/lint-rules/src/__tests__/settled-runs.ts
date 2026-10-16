/** How a run ended: the result it gave, or what it threw. */
export type Settled<Result> = { readonly gave: Result } | { readonly threw: unknown }

/** A promise's result or its rejection, as data an assertion can hold. */
export function settledOf<Result>(run: Promise<Result>): Promise<Settled<Result>> {
  return run.then(
    (gave) => ({ gave }),
    (error: unknown) => ({ threw: error }),
  )
}
