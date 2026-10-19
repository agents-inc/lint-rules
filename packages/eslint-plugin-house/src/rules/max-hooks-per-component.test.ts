import { describe, expect, it } from 'vitest'

import {
  DEFAULT_HOOK_LIMIT,
  LIMIT_BELOW_SEVEN,
  LIMIT_OF_THE_MEMO_MODULE,
  camelCaseRenderHelperWithNineHooks,
  componentWithAMemoHookModule,
  componentWithNineHooks,
  componentWithSevenHooks,
  hookCalledFourTimesInNineHookComponent,
  ignoreListLeavingUseMemoCounted,
  pascalCaseProviderWithNineHooks,
} from '../__tests__/cases/max-hooks-per-component.ts'
import { caseBuildersFor } from '../__tests__/factories/rule-case-factories.ts'
import { lintWithHouseRule } from '../__tests__/house-linter.ts'
import { houseRuleTester } from '../__tests__/house-rule-tester.ts'
import { housePlugin } from '../index.ts'

const RULE_NAME = 'max-hooks-per-component'
const RULE_ID = 'house/max-hooks-per-component'
const JAVASCRIPT_FILENAME = 'max-hooks-per-component.js'
const { invalidCase, validCase } = caseBuildersFor('max-hooks-per-component.tsx')

houseRuleTester.run('max-hooks-per-component', housePlugin.rules['max-hooks-per-component'], {
  valid: [
    validCase('stays silent on a component calling exactly seven hooks, the limit', componentWithSevenHooks),
    validCase(
      'stays silent on a component whose hooks are within the limit once its ignore option leaves some uncounted',
      componentWithNineHooks,
      { options: [{ max: DEFAULT_HOOK_LIMIT, ignore: [hookCalledFourTimesInNineHookComponent] }] },
    ),
    validCase(
      'stays silent on a PascalCase function calling nine hooks that renders no JSX itself',
      pascalCaseProviderWithNineHooks,
    ),
    validCase(
      'stays silent on a function named in camelCase that calls nine hooks and renders JSX',
      camelCaseRenderHelperWithNineHooks,
    ),
  ],
  invalid: [
    invalidCase('reports a component calling nine hooks', componentWithNineHooks, {
      errors: [{ messageId: 'tooMany', line: 3 }],
    }),
    invalidCase('reports a component calling seven hooks when its max option is six', componentWithSevenHooks, {
      options: [{ max: LIMIT_BELOW_SEVEN, ignore: [] }],
      errors: [{ messageId: 'tooMany', line: 2, data: { name: 'Panel', count: '7', limit: String(LIMIT_BELOW_SEVEN) } }],
    }),
    invalidCase(
      'reports a component calling seven hooks when its options object gives only max, so the default ignore list applies',
      componentWithSevenHooks,
      {
        options: [{ max: LIMIT_BELOW_SEVEN }],
        errors: [{ messageId: 'tooMany', line: 2, data: { name: 'Panel', count: '7', limit: String(LIMIT_BELOW_SEVEN) } }],
      },
    ),
  ],
})

describe('max-hooks-per-component options, as ESLint checks them', () => {
  it('accepts an ignore option and applies it: useMemo is counted when ignore names only useCallback', () => {
    const messages = lintWithHouseRule(
      RULE_NAME,
      [{ max: LIMIT_OF_THE_MEMO_MODULE, ignore: ignoreListLeavingUseMemoCounted }],
      componentWithAMemoHookModule,
      JAVASCRIPT_FILENAME,
    )

    expect(messages.map(({ ruleId }) => ruleId)).toStrictEqual([RULE_ID])
  })

  it('refuses an option key other than max and ignore', () => {
    expect(() =>
      lintWithHouseRule(
        RULE_NAME,
        [{ max: LIMIT_OF_THE_MEMO_MODULE, ignores: ignoreListLeavingUseMemoCounted }],
        componentWithAMemoHookModule,
        JAVASCRIPT_FILENAME,
      ),
    ).toThrowError(/Unexpected property "ignores"/)
  })
})
