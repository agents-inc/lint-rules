// `index` is never a line break: a break at `index` would be read as the start of the next line.
export function lineStartOf(text: string, index: number): number {
  return text.lastIndexOf('\n', index) + 1
}

export function restOfLine(text: string, index: number): string {
  const lineEnd = text.indexOf('\n', index)
  return lineEnd === -1 ? text.slice(index) : text.slice(index, lineEnd)
}
