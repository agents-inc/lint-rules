/** A WeakMap where the key is an object read for as long as it lives. */
export type ReadsKept<Key, Value> = {
  get(key: Key): Value | undefined
  set(key: Key, value: Value): unknown
}

/** A value read is never undefined. */
export function readOnce<Key, Value>(reads: ReadsKept<Key, Value>, key: Key, read: (key: Key) => Value): Value {
  const known = reads.get(key)
  if (known !== undefined) return known
  const value = read(key)
  reads.set(key, value)
  return value
}
