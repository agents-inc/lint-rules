export function label(k: string): string {
  let out = ''
  switch (k) {
    case 'a':
      out = 'A'
    case 'b':
      out = 'B'
      break
    default:
      out = '?'
  }
  return out
}
