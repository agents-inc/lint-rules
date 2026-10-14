export function sumIndexed(items: readonly number[]): number {
  let total = 0
  for (let index = 0; index < items.length; index += 1) {
    total += items[index] ?? 0
  }
  return total
}
