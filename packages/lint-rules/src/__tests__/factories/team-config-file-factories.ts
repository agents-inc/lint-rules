// The files a merge reads a team's config from, by their text: a JSON config, as a team writes
// .oxlintrc.json, and a module exporting its config by default. A value given is written as JSON.

/** A JSON file holding the value given. */
export function jsonFileText(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

/** A JSON file holding the value given under a line comment, which oxlint reads in a JSON config and JSON.parse does not. */
export function jsonFileTextUnderAComment(value: unknown, comment: string): string {
  return `// ${comment}\n${jsonFileText(value)}`
}

/**
 * A team's JSON oxlint config writing correctness off and the rule given at a warning, a comma after
 * the last entry of each object and of the rule's array, which oxlint reads (measured, oxlint 1.87
 * --print-config) and JSON.parse does not.
 */
export function teamOxlintrcTextWithTrailingCommas(ruleId: string): string {
  return `{
  "categories": { "correctness": "off", },
  "rules": { ${JSON.stringify(ruleId)}: ["warn",], },
}
`
}

/** A module exporting the value given by default. */
export function moduleExportingByDefaultText(value: unknown): string {
  return `export default ${JSON.stringify(value, null, 2)}\n`
}

/** A module that throws an error of the message given as it loads. */
export function moduleThrowingText(message: string): string {
  return `throw new Error(${JSON.stringify(message)})\n`
}

/** A module that awaits at its top level, then exports the value given by default. */
export function moduleAwaitingAtItsTopLevelText(value: unknown): string {
  return `await Promise.resolve()\n${moduleExportingByDefaultText(value)}`
}
