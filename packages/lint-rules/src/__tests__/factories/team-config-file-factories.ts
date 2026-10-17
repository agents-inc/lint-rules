export function jsonFileText(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

/** A JSON file holding the value given under a line comment, which oxlint reads in a JSON config and JSON.parse does not. */
export function jsonFileTextUnderAComment(value: unknown, comment: string): string {
  return `// ${comment}\n${jsonFileText(value)}`
}

/** Trailing commas, which oxlint reads (measured, oxlint 1.87 --print-config) and JSON.parse does not. */
export function teamOxlintrcTextWithTrailingCommas(ruleId: string): string {
  return `{
  "categories": { "correctness": "off", },
  "rules": { ${JSON.stringify(ruleId)}: ["warn",], },
}
`
}

export function moduleExportingByDefaultText(value: unknown): string {
  return `export default ${JSON.stringify(value, null, 2)}\n`
}

export function moduleThrowingText(message: string): string {
  return `throw new Error(${JSON.stringify(message)})\n`
}

export function moduleAwaitingAtItsTopLevelText(value: unknown): string {
  return `await Promise.resolve()\n${moduleExportingByDefaultText(value)}`
}
