export function f(v) {
  if (typeof v !== 'string') {
    throw new Error('not a string')
  }
  return v
}
