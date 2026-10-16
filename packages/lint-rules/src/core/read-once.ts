/** Where values read once are kept: a Map, or a WeakMap where the key is an object read for as long as it lives. */
export type ReadsKept<Key, Value> = {
  get(key: Key): Value | undefined
  set(key: Key, value: Value): unknown
}

/** What is read for the key, read the first time it is asked for and kept: a value read is never undefined. */
export function readOnce<Key, Value>(reads: ReadsKept<Key, Value>, key: Key, read: (key: Key) => Value): Value {
  const known = reads.get(key)
  if (known !== undefined) return known
  const value = read(key)
  reads.set(key, value)
  return value
}
