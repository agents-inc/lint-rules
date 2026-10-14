/** Plain code-unit order, the order `<` gives: stable across machines, unlike `localeCompare`. */
export function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1
  return left > right ? 1 : 0
}

/** Groups in the order their key first appears. */
export function groupBy<Item>(items: readonly Item[], keyOf: (item: Item) => string): ReadonlyMap<string, readonly Item[]> {
  const groups = new Map<string, Item[]>()
  for (const item of items) {
    const key = keyOf(item)
    const group = groups.get(key)
    if (group === undefined) groups.set(key, [item])
    else group.push(item)
  }
  return groups
}

/** Every key two or more items share, with those items. */
export function sharedKeys<Item>(
  items: readonly Item[],
  keyOf: (item: Item) => string,
): readonly (readonly [string, readonly Item[]])[] {
  return [...groupBy(items, keyOf)].filter(([, group]) => group.length > 1)
}
