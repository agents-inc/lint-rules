export function drop(o: Record<string, number>, k: string) {
  delete o[k]
}
