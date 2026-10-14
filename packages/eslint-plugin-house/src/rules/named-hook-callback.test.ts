import {
  customEffectHook,
  customEffectWithArrowCallback,
  effectWithArrowCallback,
  effectWithNamedCallback,
} from '../__tests__/cases/named-hook-callback.ts'
import { buildInvalidCase, buildValidCase } from '../__tests__/factories/rule-case-factories.ts'
import { houseRuleTester } from '../__tests__/house-rule-tester.ts'
import { housePlugin } from '../index.ts'

houseRuleTester.run('named-hook-callback', housePlugin.rules['named-hook-callback'], {
  valid: [
    buildValidCase('stays silent on a named function expression passed to useEffect', effectWithNamedCallback, {
      filename: 'named-hook-callback.tsx',
    }),
    buildValidCase('stays silent on an arrow function passed to a hook not in its hooks', customEffectWithArrowCallback, {
      filename: 'named-hook-callback.tsx',
    }),
  ],
  invalid: [
    buildInvalidCase('reports an arrow function passed to useEffect', effectWithArrowCallback, {
      filename: 'named-hook-callback.tsx',
      errors: [{ messageId: 'anonymous', line: 3 }],
    }),
    buildInvalidCase(
      'reports an arrow function passed to a hook its hooks option names',
      customEffectWithArrowCallback,
      {
        filename: 'named-hook-callback.tsx',
        options: [{ hooks: [customEffectHook] }],
        errors: [{ messageId: 'anonymous', line: 3, data: { hook: customEffectHook } }],
      },
    ),
    buildInvalidCase(
      'reports an arrow function passed to useEffect when its options object leaves hooks out, so the default hooks apply',
      effectWithArrowCallback,
      {
        filename: 'named-hook-callback.tsx',
        options: [{}],
        errors: [{ messageId: 'anonymous', line: 3 }],
      },
    ),
  ],
})
