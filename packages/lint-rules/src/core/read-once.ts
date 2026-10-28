/** A WeakMap where the key is an object read for as long as it lives. */
export type ReadsKept<Key, Value> = {
  readonly get: (key: Key) => Value | undefined
  readonly set: (key: Key, value: Value) => unknown
}

/** A value read is never undefined. */
export function readOnce<Key, Value>(reads: ReadsKept<Key, Value>, key: Key, read: (key: Key) => Value): Value {
  const known = reads.get(key)
  if (known !== undefined) return known
  const value = read(key)
  // eslint-disable-next-line functional/no-expression-statements -- keeping the value is the point: the next call for the key finds it in the map the caller holds, and what set returns, that map, is not needed
  reads.set(key, value)
  return value
}
