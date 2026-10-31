// What oxlint 1.87 prints on stdout where it refuses its config (measured): a header line, then the reason,
// which tells a team which setting to change.

/** The rule a config names that oxlint does not have. */
export const RULE_OXLINT_DOES_NOT_HAVE = 'no-such-rule'

/** A rule we ship, given an option oxlint refuses: `max` takes a number. */
export const MAX_PARAMS = 'max-params'
export const MAX_PARAMS_OPTION_OXLINT_REFUSES = { max: 'four' }

export const OXLINT_REFUSAL_OF_A_RULE = ['Failed to parse oxlint configuration file.', '', "  x Rule 'no-such-rule' not found in plugin 'eslint'"].join('\n')

export const OXLINT_REFUSAL_OF_AN_OPTION = [
  'Failed to parse oxlint configuration file.',
  '',
  '  x Invalid configuration for rule `max-params`:',
  '  |   invalid type: string "four", expected u32',
  '  |   received config: `{ "max": "four" }`',
].join('\n')
