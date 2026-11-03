export function isEmpty(record: Readonly<Record<string, unknown>>): boolean {
  return Object.keys(record).length === 0
}
