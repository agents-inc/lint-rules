// Config modules that fail as they load in ways a team's config can, beside those
// team-config-file-factories.ts writes: throwing an error that carries a code, as Node's own errors
// do, or throwing a value that is no Error.

/** A module that throws, as it loads, an error of the message given carrying the code given. */
export function moduleThrowingCodedErrorText(message: string, code: string): string {
  return `throw Object.assign(new Error(${JSON.stringify(message)}), { code: ${JSON.stringify(code)} })\n`
}

/** A module that throws, as it loads, the string given, which is no Error. */
export function moduleThrowingAStringText(thrown: string): string {
  return `throw ${JSON.stringify(thrown)}\n`
}
