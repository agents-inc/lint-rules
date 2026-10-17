const ROOT_PATH = '$'

/** Walks plain objects and arrays: `$.a.b[0]`. A value met twice is walked once, so a cycle ends the walk. */
export function pathsOfFunctionsIn(value: unknown): string[] {
  return pathsOfFunctionsUnder(value, ROOT_PATH, new WeakSet())
}

function pathsOfFunctionsUnder(value: unknown, path: string, walked: WeakSet<object>): string[] {
  if (typeof value === 'function') return [path]
  if (typeof value !== 'object' || value === null || walked.has(value)) return []
  walked.add(value)
  const children = Array.isArray(value)
    ? value.map((child, index): [string, unknown] => [`${path}[${index}]`, child])
    : Object.entries(value).map(([key, child]): [string, unknown] => [`${path}.${key}`, child])
  return children.flatMap(([childPath, child]) => pathsOfFunctionsUnder(child, childPath, walked))
}
