// Each fix measured on oxlint 1.87.0 and eslint-plugin-unicorn 78.0.0.

type WrittenFile = { readonly file: string; readonly source: string }

/** ESLint's prefer-at reports the last item of an array, and its fix reads it with `.at(-1)`. */
export const LAST_ITEM: WrittenFile & { readonly fixed: string } = {
  file: 'src/last-item.ts',
  source: 'export const lastOf = (items: string[]) => items[items.length - 1]\n',
  fixed: 'export const lastOf = (items: string[]) => items.at(-1)\n',
}

/** oxlint's prefer-at rewrites this to `cells.at(-1)`, which a NodeList does not have; ESLint's leaves it. */
export const LAST_CELL: WrittenFile = {
  file: 'src/last-cell.ts',
  source: `export function lastCell() {
  const cells = document.querySelectorAll('td')
  return cells[cells.length - 1]
}
`,
}

/** oxlint's prefer-single-call merges these into `buffer.push(1, 2)`, which this push reads as `push(1)`; ESLint's leaves them. */
export const OWN_PUSH: WrittenFile = {
  file: 'src/ring-buffer.ts',
  source: `class RingBuffer {
  readonly #items: number[] = []

  push(value: number) {
    this.#items.push(value)
  }
}

export function filled() {
  const buffer = new RingBuffer()
  buffer.push(1)
  buffer.push(2)
  return buffer
}
`,
}

/** ESLint's prefer-single-call reports the second call here, and its own fix would merge the two. */
export const CLASS_LIST: WrittenFile & { readonly finding: string } = {
  file: 'src/mark.ts',
  source: `export function mark(element: Element) {
  element.classList.add('first')
  element.classList.add('second')
}
`,
  finding: 'src/mark.ts:3 unicorn/prefer-single-call',
}
