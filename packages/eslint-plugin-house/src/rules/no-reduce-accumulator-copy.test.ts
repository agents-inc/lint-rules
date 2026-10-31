import { describe, expect, it } from 'vitest'

import {
  accumulatorParameterRedeclared,
  boardCopiedByToSorted,
  cellsJoinedFromAnInferredReceiver,
  groupsJoinedFromObjectValues,
  idsCopiedByArrayFrom,
  idsCopiedBySlice,
  initialValueUnderAnAngleBracketAssertion,
  KNOWN_ARRAYS_REPORTED,
  LOOKALIKES_SILENT,
  tagsCollectedByANamedReducer,
  tagsCollectedByConcat,
  tagsCollectedByConcatAsJavaScript,
  tagsCollectedByConcatInALoop,
  tagsCollectedByFlatMap,
  tagsCollectedBySpread,
  totalOfPrices,
  UPSTREAM_REPORTED,
  UPSTREAM_SILENT,
  usersIndexedByObjectAssign,
  usersIndexedByObjectFromEntries,
} from '../__tests__/cases/no-reduce-accumulator-copy.ts'
import { buildInvalidCase, buildValidCase } from '../__tests__/factories/rule-case-factories.ts'
import { lintWithHouseRule } from '../__tests__/house-linter.ts'
import { houseRuleTester } from '../__tests__/house-rule-tester.ts'
import { housePlugin } from '../index.ts'

// A port of anti-slop/no-reduce-accumulator-copy: it reports a reduce or reduceRight callback that copies its
// accumulator (concat, slice, toSorted, toReversed, toSpliced, with, Array.from, Object.assign into a new object),
// matching the accumulator by its node's range where upstream reads oxlint's `.start`. Spreads are
// oxc/no-accumulating-spread's. It reads no types, so any receiver of a reduce call counts: upstream PR #51's opt-in
// guard, which keeps only receivers with local signs of an array, would silence the corpus's one authored report.

houseRuleTester.run('no-reduce-accumulator-copy', housePlugin.rules['no-reduce-accumulator-copy'], {
  valid: [
    buildValidCase("stays silent on the page's fix, flatMap", tagsCollectedByFlatMap),
    buildValidCase('stays silent on a reducer whose accumulator is a number', totalOfPrices),
    buildValidCase('stays silent on Object.fromEntries, which builds an index in one pass', usersIndexedByObjectFromEntries),
    buildValidCase('stays silent on a spread copy, which oxc/no-accumulating-spread reports', tagsCollectedBySpread),
    buildValidCase('stays silent on concat in a loop, which unicorn/no-array-concat-in-loop reports', tagsCollectedByConcatInALoop),
    ...Object.entries(UPSTREAM_SILENT).map(([title, code]) => buildValidCase<[]>(title, code)),
    ...Object.entries(LOOKALIKES_SILENT).map(([title, code]) => buildValidCase<[]>(title, code)),
  ],
  invalid: [
    buildInvalidCase("reports the page's example, concat on the accumulator", tagsCollectedByConcat, {
      errors: [{ messageId: 'accumulatorCopy', line: 3 }],
    }),
    buildInvalidCase('reports slice copying the accumulator of a typed reduce', idsCopiedBySlice, { errors: [{ messageId: 'accumulatorCopy', line: 3 }] }),
    buildInvalidCase('reports Array.from copying the accumulator of a typed reduce', idsCopiedByArrayFrom, { errors: [{ messageId: 'accumulatorCopy', line: 3 }] }),
    buildInvalidCase('reports toSorted copying the accumulator of a typed reduce', boardCopiedByToSorted, { errors: [{ messageId: 'accumulatorCopy', line: 3 }] }),
    buildInvalidCase('reports a copy in a named function expression, whose name is no accumulator', tagsCollectedByANamedReducer, {
      errors: [{ messageId: 'accumulatorCopy', line: 5 }],
    }),
    buildInvalidCase('reports Object.assign copying an object accumulator', usersIndexedByObjectAssign, {
      errors: [{ messageId: 'accumulatorCopy', line: 4 }],
    }),
    buildInvalidCase('reports a copy whose receiver is read from Object.values, with no local sign of an array', groupsJoinedFromObjectValues, {
      errors: [{ messageId: 'accumulatorCopy', line: 2 }],
    }),
    buildInvalidCase('reports a copy whose receiver has a type inferred from a call', cellsJoinedFromAnInferredReceiver, {
      errors: [{ messageId: 'accumulatorCopy', line: 5 }],
    }),
    ...Object.entries(UPSTREAM_REPORTED).map(([title, code]) =>
      buildInvalidCase<'accumulatorCopy', []>(title, code, { errors: [{ messageId: 'accumulatorCopy', line: 1 }] }),
    ),
    ...Object.entries(KNOWN_ARRAYS_REPORTED).map(([title, code]) =>
      buildInvalidCase<'accumulatorCopy', []>(title, code, { errors: [{ messageId: 'accumulatorCopy', line: 1 }] }),
    ),
    buildInvalidCase('reports concat on an initial value under an angle-bracket type assertion', initialValueUnderAnAngleBracketAssertion, {
      filename: 'file.ts',
      errors: [{ messageId: 'accumulatorCopy', line: 1 }],
    }),
    buildInvalidCase('reports concat on a var that redeclares the accumulator parameter', accumulatorParameterRedeclared, {
      filename: 'file.js',
      errors: [{ messageId: 'accumulatorCopy', line: 1 }],
    }),
  ],
})

describe('no-reduce-accumulator-copy messages, as a user reads them', () => {
  // functional/immutable-data, which ships, bans mutating an accumulator, so the message offers the one-pass builders.
  it('points to flatMap, map and Object.fromEntries, and never to mutating or pushing onto the accumulator', () => {
    const messages = lintWithHouseRule('no-reduce-accumulator-copy', [], tagsCollectedByConcatAsJavaScript, 'no-reduce-accumulator-copy.js')

    expect(
      messages.map(({ line, message }) => ({
        line,
        namesFlatMap: message.includes('flatMap'),
        namesMap: /\bmap\b/u.test(message),
        namesObjectFromEntries: message.includes('Object.fromEntries'),
        saysMutate: /mutat/iu.test(message),
        saysPush: /\bpush/iu.test(message),
      })),
    ).toStrictEqual([{ line: 1, namesFlatMap: true, namesMap: true, namesObjectFromEntries: true, saysMutate: false, saysPush: false }])
  })
})
