/** The named groups of a match of a pattern that names its groups. */
export function namedGroupsOf({ groups }: RegExpExecArray): Readonly<Record<string, string | undefined>> {
  if (groups === undefined) throw new Error('a pattern with named groups matched without them')
  return groups
}

/** A named group the match always holds. */
export function namedGroupOf(match: RegExpExecArray, name: string): string {
  const group = namedGroupsOf(match)[name]
  if (group === undefined) throw new Error(`the pattern matched "${match[0]}" without its group ${name}`)
  return group
}
