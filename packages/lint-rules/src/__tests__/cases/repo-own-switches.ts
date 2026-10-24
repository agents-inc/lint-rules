// A switch over every case of a union, ended the two ways this repo's own code might end it.

export const SWITCH_ENDING_IN_A_THROWING_DEFAULT = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const LINE_OF_THE_THROWING_DEFAULT = 9

export const SWITCH_ENDING_IN_A_NEVER_DEFAULT = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default: {
      const unhandled: never = engine
      return unhandled
    }
  }
}
`
