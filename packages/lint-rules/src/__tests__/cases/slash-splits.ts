// Modules a program is made of, each cutting strings one way.

export const PREFIX_CUT_AT_A_WRITTEN_SLASH = `export function prefixOf(ruleId: string): string {
  return ruleId.slice(0, ruleId.indexOf('/'))
}
`

export const SPLIT_AT_A_SLASH_HELD_IN_A_CONSTANT = `const SEPARATOR = '/'

export const namePartsOf = (ruleId: string): string[] => ruleId.split(SEPARATOR)
`

export const LAST_SLASH_FOUND_IN_A_CALLBACK = `export function lastSegmentsOf(ids: readonly string[]): string[] {
  return ids.map((id: string) => id.slice(id.lastIndexOf('/') + 1))
}
`

export const SPLIT_AT_A_SLASH_AT_THE_TOP_LEVEL = `export const PARTS = 'house/no-classic-loops'.split('/')
`

// The ID typed as a union of rule IDs, as rule-data's generated RuleId is.
export const PREFIX_CUT_OF_A_RULE_ID_UNION = `type RuleId = 'house/no-classic-loops' | 'n/prefer-global/buffer'

export function prefixOf(ruleId: RuleId): string {
  return ruleId.slice(0, ruleId.indexOf('/'))
}
`

export const SPLIT_OF_AN_ID_THAT_MAY_BE_MISSING = `export function namePartsOf(ruleId: string | undefined): string[] | undefined {
  return ruleId?.split('/')
}
`

export const SPLIT_OF_AN_ID_THAT_MAY_BE_NULL = `export function namePartsOf(ruleId: string | null): string[] | undefined {
  return ruleId?.split('/')
}
`

export const CUTS_AT_NO_SLASH =`export function wordsOf(text: string): string[] {
  return text.split(' ')
}

export function commaAt(text: string): number {
  return text.indexOf(',')
}

export function slashAmong(names: readonly string[]): number {
  return names.indexOf('/')
}

export function joined(parts: readonly string[]): string {
  return parts.join('/')
}
`

// The ID typed as a parameter constrained to string, as a function generic over rule IDs takes it.
export const PREFIX_CUT_OF_A_GENERIC_ID = `export function prefixOf<Id extends string>(ruleId: Id): string {
  return ruleId.slice(0, ruleId.indexOf('/'))
}
`

// A list with its own indexOf, which a type parameter is constrained to.
export const SLASH_SEARCH_OF_A_LIST_A_GENERIC_IS_CONSTRAINED_TO = `type Names = { indexOf(name: string): number }

export function slashAmong<Given extends Names>(names: Given): number {
  return names.indexOf('/')
}
`

// A value that is a string or a list with its own indexOf.
export const SLASH_SEARCH_OF_A_STRING_OR_A_LIST = `type Names = { indexOf(name: string): number }

export function slashIn(idOrNames: string | Names): number {
  return idOrNames.indexOf('/')
}
`
