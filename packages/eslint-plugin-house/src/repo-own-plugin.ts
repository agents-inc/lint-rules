import type { TSESLint } from '@typescript-eslint/utils'

import { noThrowingDefaultInExhaustiveSwitch } from './rules/no-throwing-default-in-exhaustive-switch.ts'

/** Rules this repo holds its own code to and does not ship; its eslint.config.mjs registers them. */
export const repoOwnPlugin = {
  meta: { name: 'house-repo', namespace: 'house-repo' },
  rules: {
    'no-throwing-default-in-exhaustive-switch': noThrowingDefaultInExhaustiveSwitch,
  },
} satisfies TSESLint.FlatConfig.Plugin
