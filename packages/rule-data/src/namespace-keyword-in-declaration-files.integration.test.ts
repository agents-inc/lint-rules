import { describe, expect, it } from 'vitest'

import { NAMESPACE_KEYWORD_IN_DECLARATION_FILES } from './__tests__/cases/ruleset-moves.ts'
import { setUpRuleCaseOutcomes } from './__tests__/rule-case-outcomes.ts'
import { catalog } from './catalog.ts'

// In other files no-namespace reports the namespace prefer-namespace-keyword's fix would write, so the line never clears.

const ENGINES_TIMEOUT_MS = 120_000

describe('@typescript-eslint/prefer-namespace-keyword, run as the catalog ships it on each engine that may run it', () => {
  const { outcomesOfCase } = setUpRuleCaseOutcomes(catalog)

  it(
    'reports `module Shapes` in a .d.ts, .d.mts or .d.cts file, and stays silent on it in a .ts file and on a quoted module name',
    async () => {
      const { actual, expected } = await outcomesOfCase('namespace-keyword', NAMESPACE_KEYWORD_IN_DECLARATION_FILES)

      expect(actual).toStrictEqual(expected)
    },
    ENGINES_TIMEOUT_MS,
  )
})
