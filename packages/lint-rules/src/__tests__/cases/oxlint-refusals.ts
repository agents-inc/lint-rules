// What oxlint 1.87 prints on stdout where it refuses its config (measured): a header line, then the reason,
// which tells a team which setting to change.

/** The rule a config names that oxlint does not have. */
export const RULE_OXLINT_DOES_NOT_HAVE = 'no-such-rule'

/** An option of no-console's that oxlint refuses: `allow` takes a list. */
export const NO_CONSOLE_OPTION_OXLINT_REFUSES = { allow: 'warn' }

export const OXLINT_REFUSAL_OF_A_RULE = ['Failed to parse oxlint configuration file.', '', "  x Rule 'no-such-rule' not found in plugin 'eslint'"].join('\n')

export const OXLINT_REFUSAL_OF_AN_OPTION = [
  'Failed to parse oxlint configuration file.',
  '',
  '  x Invalid configuration for rule `no-console`:',
  '  |   invalid type: string "warn", expected a sequence',
  '  |   received config: `{ "allow": "warn" }`',
].join('\n')
