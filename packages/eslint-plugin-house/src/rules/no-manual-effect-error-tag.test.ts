import { describe, expect, it } from 'vitest'

import {
  anotherFieldComparedInCatchAll,
  EQUALITY_OPERATORS,
  reasonTagComparedInCatchAllFunction,
  reasonTagComparedInCatchTag,
  reasonTagReadByAComputedKey,
  tagAndReasonComparedInCatchAllAsJavaScript,
  tagComparedInAFunctionNestedInTheHandler,
  tagComparedInAStreamCatchAll,
  tagComparedInCatch,
  tagComparedInCatchAll,
  tagComparedInCatchAllWith,
  tagComparedOutsideAnyHandler,
  tagComparedWithAVariable,
  tagComparedWithNullInCatchAll,
  tagHandledByCatchTag,
  tagJoinedToAStringInCatchAll,
  tagOnTheRightOfTheComparison,
  tagReadByAComputedKey,
  tagSwitchedInAReducer,
  tagSwitchedInCatchIf,
  tagSwitchedOnAReasonInCatchAll,
} from '../__tests__/cases/no-manual-effect-error-tag.ts'
import { buildInvalidCase, buildValidCase } from '../__tests__/factories/rule-case-factories.ts'
import { lintWithHouseRule } from '../__tests__/house-linter.ts'
import { houseRuleTester } from '../__tests__/house-rule-tester.ts'
import { housePlugin } from '../index.ts'

// A port of anti-slop-effect/no-manual-effect-error-tag: it reports a `_tag` compared with a string, or switched on, in
// the callback a broad Effect catch is handed (Effect 3's catchAll, Effect 4's catch, and catchIf), and nowhere else.

houseRuleTester.run('no-manual-effect-error-tag', housePlugin.rules['no-manual-effect-error-tag'], {
  valid: [
    buildValidCase("stays silent on Effect.catchTag, which handles the one tag and lets every other failure through", tagHandledByCatchTag),
    buildValidCase('stays silent on a _tag comparison outside any Effect handler', tagComparedOutsideAnyHandler),
    buildValidCase('stays silent on a switch over _tag outside any Effect handler', tagSwitchedInAReducer),
    buildValidCase("stays silent on a reason's _tag compared in Effect.catchTag's callback, which is no broad catch", reasonTagComparedInCatchTag),
    buildValidCase(
      'stays silent on a _tag comparison in a function nested in the handler, which tests no failure the handler caught',
      tagComparedInAFunctionNestedInTheHandler,
    ),
    buildValidCase("stays silent on a _tag comparison in Stream.catchAll's callback, which is no Effect handler", tagComparedInAStreamCatchAll),
    buildValidCase('stays silent on a _tag compared with a variable, whose tag it cannot read', tagComparedWithAVariable),
    buildValidCase("stays silent on a field other than _tag compared in Effect.catchAll's callback", anotherFieldComparedInCatchAll),
    buildValidCase('stays silent on a _tag joined to a string by +, which compares nothing', tagJoinedToAStringInCatchAll),
    buildValidCase('stays silent on a _tag compared with null, which names no tag', tagComparedWithNullInCatchAll),
  ],
  invalid: [
    buildInvalidCase("reports a _tag compared with a string in Effect.catchAll's callback", tagComparedInCatchAll, {
      errors: [{ messageId: 'tag', line: 4 }],
    }),
    buildInvalidCase("reports a _tag compared with a string in Effect.catch's callback, Effect 4's broad catch", tagComparedInCatch, {
      errors: [{ messageId: 'tag', line: 4 }],
    }),
    buildInvalidCase("reports a switch over _tag in Effect.catchIf's callback, its second argument", tagSwitchedInCatchIf, {
      errors: [{ messageId: 'tag', line: 5 }],
    }),
    // The array's type does not reach a case built inside .map, so those cases name their type arguments.
    ...EQUALITY_OPERATORS.map((operator) =>
      buildInvalidCase<'tag', []>(`reports a _tag compared with a string by ${operator} in Effect.catchAll's callback`, tagComparedInCatchAllWith(operator), {
        errors: [{ messageId: 'tag', line: 4 }],
      }),
    ),
    buildInvalidCase('reports a _tag compared with a string on its left', tagOnTheRightOfTheComparison, {
      errors: [{ messageId: 'tag', line: 4 }],
    }),
    buildInvalidCase("reports a _tag read by a computed key, error['_tag']", tagReadByAComputedKey, {
      errors: [{ messageId: 'tag', line: 4 }],
    }),
    buildInvalidCase(
      "reports a reason's _tag compared in a function expression handed to Effect.catchAll, pointing to catchReason",
      reasonTagComparedInCatchAllFunction,
      { errors: [{ messageId: 'reason', line: 5 }] },
    ),
    buildInvalidCase("reports a reason read by a computed key, error['reason']._tag, pointing to catchReason", reasonTagReadByAComputedKey, {
      errors: [{ messageId: 'reason', line: 4 }],
    }),
    buildInvalidCase("reports a switch over a reason's _tag in Effect.catchAll's callback, pointing to catchReason", tagSwitchedOnAReasonInCatchAll, {
      errors: [{ messageId: 'reason', line: 5 }],
    }),
  ],
})

describe('no-manual-effect-error-tag messages, as a user reads them', () => {
  it("names the handler that takes the tag, and for a reason's tag the one that takes the reason, in upstream's words", () => {
    const messages = lintWithHouseRule('no-manual-effect-error-tag', [], tagAndReasonComparedInCatchAllAsJavaScript, 'no-manual-effect-error-tag.js')

    expect(messages.map(({ line, message }) => ({ line, message }))).toStrictEqual([
      {
        line: 4,
        message: 'Use Effect.catchTag or Effect.catchTags instead of manually discriminating a tagged error in a broad Effect catch handler.',
      },
      {
        line: 8,
        message: 'Use Effect.catchReason or Effect.catchReasons instead of manually discriminating a tagged `reason` in a broad Effect catch handler.',
      },
    ])
  })
})
