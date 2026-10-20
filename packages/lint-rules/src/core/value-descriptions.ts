// Printed, an object reads "[object Object]" and an array its items, as if a string were given, so an error
// names each of them, and null, by its kind.

/** Its kind, or its type and text: `an object`, `number 42`. */
export function describeValue(value: unknown): string {
  const kind = kindOf(value)
  return kind === null ? `${typeof value} ${String(value)}` : kind
}

/** Null for any other value, whose text shows what it is. */
function kindOf(value: unknown): string | null {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'an array'
  return typeof value === 'object' ? 'an object' : null
}
