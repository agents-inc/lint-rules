function padded(text: string, width = 2): string {
  return text.padStart(width)
}

export const twoWide = padded('7', 2)
export const threeWide = padded('7', 3)
