/** `typeof` says `object` for `null` too; this does not. */
export function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}
