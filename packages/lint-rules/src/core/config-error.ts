/** An engine loads the consumer's config before it lints anything, so the error names the file to fix first. */
export function configErrorIn(file: string, problem: string, options?: ErrorOptions): Error {
  return new Error(configProblemIn(file, problem), options)
}

/** configErrorIn's message, for a look-up that throws it through foundOr. */
export function configProblemIn(file: string, problem: string): string {
  return `${file}: ${problem}`
}
