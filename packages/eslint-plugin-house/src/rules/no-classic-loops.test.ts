import { describe, expect, it } from 'vitest'

import {
  arrayMethods,
  classicForInsideForOf,
  classicIndexedFor,
  doWhileLoop,
  forAwaitOfLoop,
  forInOverRecord,
  forOfLoop,
  forOfOverEntries,
  javascriptClassicFor,
  javascriptDoWhile,
  javascriptForIn,
  javascriptWhile,
  labelledClassicFor,
  whileLoop,
  whileTrueWithBreak,
} from '../__tests__/cases/no-classic-loops.ts'
import { caseBuildersFor } from '../__tests__/factories/rule-case-factories.ts'
import { lintWithHouseRule } from '../__tests__/house-linter.ts'
import { houseRuleTester } from '../__tests__/house-rule-tester.ts'
import { housePlugin } from '../index.ts'

const { invalidCase, validCase } = caseBuildersFor('no-classic-loops.ts')

// No invalid case declares an `output` or `suggestions`: the tester then fails any fix or
// suggestion the rule offers, which is how "no autofix" is pinned.
houseRuleTester.run('no-classic-loops', housePlugin.rules['no-classic-loops'], {
  valid: [
    validCase('stays silent on a for…of loop', forOfLoop),
    validCase('stays silent on a for await…of loop', forAwaitOfLoop),
    validCase("stays silent on a for…of over Object.entries, for…in's replacement", forOfOverEntries),
    validCase('stays silent on forEach, map and reduce', arrayMethods),
  ],
  invalid: [
    invalidCase('reports a classic indexed for loop', classicIndexedFor, {
      errors: [{ messageId: 'classicLoop', line: 3 }],
    }),
    invalidCase('reports a for…in loop', forInOverRecord, {
      errors: [{ messageId: 'classicLoop', line: 3 }],
    }),
    invalidCase('reports a while loop', whileLoop, {
      errors: [{ messageId: 'classicLoop', line: 3 }],
    }),
    invalidCase('reports a do…while loop', doWhileLoop, {
      errors: [{ messageId: 'classicLoop', line: 3 }],
    }),
    invalidCase('reports a while (true) loop left by break', whileTrueWithBreak, {
      errors: [{ messageId: 'classicLoop', line: 2 }],
    }),
    invalidCase('reports a labelled classic for loop, and not the for…of inside it', labelledClassicFor, {
      errors: [{ messageId: 'classicLoop', line: 3 }],
    }),
    invalidCase('reports a classic for loop nested in a for…of, and not the for…of', classicForInsideForOf, {
      errors: [{ messageId: 'classicLoop', line: 4 }],
    }),
  ],
})

const CLASSIC_LOOPS = [
  { loop: 'for', code: javascriptClassicFor },
  { loop: 'for…in', code: javascriptForIn },
  { loop: 'while', code: javascriptWhile },
  { loop: 'do…while', code: javascriptDoWhile },
]

describe('no-classic-loops message', () => {
  it.each(CLASSIC_LOOPS)('names for…of and an array method as the alternative to a $loop loop', ({ code }) => {
    const messages = lintWithHouseRule('no-classic-loops', [], code, 'no-classic-loops.js')

    expect(
      messages.map(({ ruleId, message }) => ({
        ruleId,
        namesForOf: message.includes('for…of'),
        namesArrayMethod: message.includes('array method'),
      })),
    ).toStrictEqual([{ ruleId: 'house/no-classic-loops', namesForOf: true, namesArrayMethod: true }])
  })
})
