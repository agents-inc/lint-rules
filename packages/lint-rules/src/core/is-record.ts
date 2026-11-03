/** `typeof` says `object` for `null` and arrays too. */
export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** `Array.isArray` narrows to `any[]`, whose members would read as anything. */
export function isList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value)
}
