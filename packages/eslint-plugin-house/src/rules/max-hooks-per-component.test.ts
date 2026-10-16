import {
  DEFAULT_HOOK_LIMIT,
  LIMIT_BELOW_SEVEN,
  camelCaseRenderHelperWithNineHooks,
  componentWithNineHooks,
  componentWithSevenHooks,
  hookCalledFourTimesInNineHookComponent,
  pascalCaseProviderWithNineHooks,
} from '../__tests__/cases/max-hooks-per-component.ts'
import { caseBuildersFor } from '../__tests__/factories/rule-case-factories.ts'
import { houseRuleTester } from '../__tests__/house-rule-tester.ts'
import { housePlugin } from '../index.ts'

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
