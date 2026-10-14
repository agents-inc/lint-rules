import {
  DEFAULT_HOOK_LIMIT,
  LIMIT_BELOW_SEVEN,
  componentWithNineHooks,
  componentWithSevenHooks,
  hookCalledFourTimesInNineHookComponent,
} from '../__tests__/cases/max-hooks-per-component.ts'
import { buildInvalidCase, buildValidCase } from '../__tests__/factories/rule-case-factories.ts'
import { houseRuleTester } from '../__tests__/house-rule-tester.ts'
import { housePlugin } from '../index.ts'

houseRuleTester.run('max-hooks-per-component', housePlugin.rules['max-hooks-per-component'], {
  valid: [
    buildValidCase('stays silent on a component calling exactly seven hooks, the limit', componentWithSevenHooks, {
      filename: 'max-hooks-per-component.tsx',
    }),
    buildValidCase(
      'stays silent on a component whose hooks are within the limit once its ignore option leaves some uncounted',
      componentWithNineHooks,
      {
        filename: 'max-hooks-per-component.tsx',
        options: [{ max: DEFAULT_HOOK_LIMIT, ignore: [hookCalledFourTimesInNineHookComponent] }],
      },
    ),
  ],
  invalid: [
    buildInvalidCase('reports a component calling nine hooks', componentWithNineHooks, {
      filename: 'max-hooks-per-component.tsx',
      errors: [{ messageId: 'tooMany', line: 3 }],
    }),
    buildInvalidCase('reports a component calling seven hooks when its max option is six', componentWithSevenHooks, {
      filename: 'max-hooks-per-component.tsx',
      options: [{ max: LIMIT_BELOW_SEVEN, ignore: [] }],
      errors: [{ messageId: 'tooMany', line: 2, data: { name: 'Panel', count: '7', limit: String(LIMIT_BELOW_SEVEN) } }],
    }),
    buildInvalidCase(
      'reports a component calling seven hooks when its options object gives only max, so the default ignore list applies',
      componentWithSevenHooks,
      {
        filename: 'max-hooks-per-component.tsx',
        options: [{ max: LIMIT_BELOW_SEVEN }],
        errors: [{ messageId: 'tooMany', line: 2, data: { name: 'Panel', count: '7', limit: String(LIMIT_BELOW_SEVEN) } }],
      },
    ),
  ],
})
