/** A plain object read from outside, JSON or a team's config: `typeof` says `object` for `null` and arrays too. */
export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
