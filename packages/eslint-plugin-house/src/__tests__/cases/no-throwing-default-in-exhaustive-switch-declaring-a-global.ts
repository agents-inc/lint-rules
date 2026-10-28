// A case declaring a global. The cross-check against TypeScript types the rule's other cases, and each never default
// written in their place, in one program, where every copy would declare the global again (TS2451), so it is kept apart.

export const throwingDefaultOnAGlobalConst = `declare global {
  const hostEngine: 'eslint' | 'oxlint'
}

export function binOf(): string {
  switch (hostEngine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`
