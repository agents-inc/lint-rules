export const classicIndexedFor = `export function sumIndexed(items: readonly number[]): number {
  let total = 0
  for (let index = 0; index < items.length; index += 1) {
    total += items[index] ?? 0
  }
  return total
}
`

export const forInOverRecord = `export function keysOf(record: Readonly<Record<string, number>>): string[] {
  const keys: string[] = []
  for (const key in record) {
    keys.push(key)
  }
  return keys
}
`

export const whileLoop = `export function countTo(limit: number): number {
  let count = 0
  while (count < limit) {
    count += 1
  }
  return count
}
`

export const doWhileLoop = `export function countAtLeastOnce(limit: number): number {
  let count = 0
  do {
    count += 1
  } while (count < limit)
  return count
}
`

export const whileTrueWithBreak = `export function drain(queue: string[]): void {
  while (true) {
    if (queue.length === 0) break
    console.info(queue.pop())
  }
}
`

export const labelledClassicFor = `export function hasNegative(rows: readonly number[][]): boolean {
  let found = false
  outer: for (let row = 0; row < rows.length; row += 1) {
    for (const cell of rows[row] ?? []) {
      if (cell < 0) {
        found = true
        break outer
      }
    }
  }
  return found
}
`

export const classicForInsideForOf = `export function pairs(groups: readonly number[][]): number {
  let total = 0
  for (const group of groups) {
    for (let index = 1; index < group.length; index += 1) {
      total += (group[index] ?? 0) - (group[index - 1] ?? 0)
    }
  }
  return total
}
`

// Plain JavaScript: ESLint's default parser reads no types.
export const javascriptClassicFor = `for (let index = 0; index < 3; index += 1) {
  console.info(index)
}
`

export const javascriptForIn = `for (const key in globalThis) {
  console.info(key)
}
`

export const javascriptWhile = `while (Math.random() > 0.5) {
  console.info('again')
}
`

export const javascriptDoWhile = `do {
  console.info('once')
} while (Math.random() > 0.5)
`

export const forOfLoop = `export function sum(items: readonly number[]): number {
  let total = 0
  for (const item of items) {
    total += item
  }
  return total
}
`

export const forAwaitOfLoop = `export async function sumStream(stream: AsyncIterable<number>): Promise<number> {
  let total = 0
  for await (const chunk of stream) {
    total += chunk
  }
  return total
}
`

export const forOfOverEntries = `export function describe(record: Readonly<Record<string, number>>): string[] {
  const lines: string[] = []
  for (const [key, value] of Object.entries(record)) {
    lines.push(\`\${key}=\${value}\`)
  }
  return lines
}
`

export const arrayMethods = `export function totals(items: readonly number[]): number {
  items.forEach((item, index) => {
    console.info(index, item)
  })
  return items.map((item) => item * 2).reduce((total, item) => total + item, 0)
}
`

export const everyClassicLoop = `export function drain(items, record) {
  do { items.pop() } while (items.length > 0)
  for (const key in record) { items.push(key) }
  for (let index = 0; index < 1; index += 1) { items.push(index) }
  while (items.length > 0) { items.pop() }
}
`
