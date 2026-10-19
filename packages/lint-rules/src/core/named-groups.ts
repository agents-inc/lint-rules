import { foundOr } from '@workspace/rule-data/collections'

export function namedGroupsOf({ groups }: RegExpExecArray): Readonly<Record<string, string | undefined>> {
  return foundOr(groups, 'a pattern with named groups matched without them')
}

export function namedGroupOf(match: RegExpExecArray, name: string): string {
  return foundOr(namedGroupsOf(match)[name], `the pattern matched "${match[0]}" without its group ${name}`)
}
