/** An engine loads the consumer's config before it lints anything, so the error names the file to fix first. */
export function configErrorIn(file: string, problem: string, options?: ErrorOptions): Error {
  return new Error(`${file}: ${problem}`, options)
}
