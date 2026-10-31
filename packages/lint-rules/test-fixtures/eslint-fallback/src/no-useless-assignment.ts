export function latest(read: () => string, reread: () => string) {
  let text = read()
  text = reread()
  return text
}
