export function restOfLine(text: string, index: number): string {
  const lineEnd = text.indexOf('\n', index)
  return lineEnd === -1 ? text.slice(index) : text.slice(index, lineEnd)
}
