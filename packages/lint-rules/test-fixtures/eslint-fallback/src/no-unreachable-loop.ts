export function first(xs: readonly number[]): number | undefined {
  for (const x of xs) { return x }
  return undefined
}
