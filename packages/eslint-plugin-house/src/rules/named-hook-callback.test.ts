import { describe, expect, it } from 'vitest'

import {
  customEffectHook,
  customEffectInHookModule,
  customEffectWithArrowCallback,
  effectWithArrowCallback,
  effectWithNamedCallback,
} from '../__tests__/cases/named-hook-callback.ts'
import { caseBuildersFor } from '../__tests__/factories/rule-case-factories.ts'
import { lintWithHouseRule } from '../__tests__/house-linter.ts'
import { houseRuleTester } from '../__tests__/house-rule-tester.ts'
import { housePlugin } from '../index.ts'

const { invalidCase, validCase } = caseBuildersFor('named-hook-callback.tsx')

houseRuleTester.run('named-hook-callback', housePlugin.rules['named-hook-callback'], {
  valid: [
    validCase('stays silent on a named function expression passed to useEffect', effectWithNamedCallback),
    validCase('stays silent on an arrow function passed to a hook not in its hooks', customEffectWithArrowCallback),
  ],
  invalid: [
    invalidCase('reports an arrow function passed to useEffect', effectWithArrowCallback, {
      errors: [{ messageId: 'anonymous', line: 3 }],
    }),
    invalidCase('reports an arrow function passed to a hook its hooks option names', customEffectWithArrowCallback, {
      options: [{ hooks: [customEffectHook] }],
      errors: [{ messageId: 'anonymous', line: 3, data: { hook: customEffectHook } }],
    }),
    invalidCase(
      'reports an arrow function passed to useEffect when its options object leaves hooks out, so the default hooks apply',
      effectWithArrowCallback,
      {
        options: [{}],
        errors: [{ messageId: 'anonymous', line: 3 }],
      },
    ),
  ],
})

describe('named-hook-callback options, as ESLint checks them', () => {
  it('accepts a hooks option and applies it: an arrow passed to a hook it names is reported', () => {
    const messages = lintWithHouseRule(
      'named-hook-callback',
      [{ hooks: [customEffectHook] }],
      customEffectInHookModule,
      'use-panel-title.js',
    )

    expect(messages.map(({ ruleId }) => ruleId)).toStrictEqual(['house/named-hook-callback'])
  })

  it('refuses an option key other than hooks', () => {
    expect(() =>
      lintWithHouseRule('named-hook-callback', [{ hook: [customEffectHook] }], customEffectInHookModule, 'use-panel-title.js'),
    ).toThrowError(/Unexpected property "hook"/)
  })
})
