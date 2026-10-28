import { describe, expect, it } from 'vitest'

import {
  BARE_MINTER_CALLS,
  customMinter,
  customMinterKeyInMap,
  customMinterKeyInMapModule,
  derivedKeys,
  destructuredUuidField,
  keyedOnDataId,
  HOSTED_MINTER_CALLS,
  keyedOnIndex,
  listBuiltWith,
  listKeyedBy,
  loneElementKeyedByMinter,
  methodReadingExistingId,
  mintedInsideHandler,
  mintedInsideUseMemo,
  mintedOnceInRefAndLazyState,
  mintedOutsideKey,
  mintedOutsideListCallback,
  mintedWhileBuildingList,
  minterHandedToCachingHelperInKey,
  minterInAMethodSignatureDefault,
  minterKeyInANonListCall,
  minterKeyInTheArrayAMapIsCalledOn,
  nameBasedUuid,
  OTHER_LIST_ITERATORS,
  randomUuidKeyInMap,
  versionNameOnAnotherHost,
} from '../__tests__/cases/no-unstable-list-keys.ts'
import { buildInvalidCase, buildValidCase } from '../__tests__/factories/rule-case-factories.ts'
import { lintWithHouseRule } from '../__tests__/house-linter.ts'
import { houseRuleTester } from '../__tests__/house-rule-tester.ts'
import { housePlugin } from '../index.ts'

houseRuleTester.run('no-unstable-list-keys', housePlugin.rules['no-unstable-list-keys'], {
  valid: [
    buildValidCase('stays silent on a key taken from the data', keyedOnDataId),
    buildValidCase('stays silent on an index key', keyedOnIndex),
    buildValidCase('stays silent on ids minted outside any key', mintedOutsideKey),
    buildValidCase('stays silent on composite and derived keys', derivedKeys),
    buildValidCase('stays silent on ids minted outside the list callback', mintedOutsideListCallback),
    buildValidCase('stays silent on ids minted once inside useMemo', mintedInsideUseMemo),
    buildValidCase('stays silent on ids minted while building the list', mintedWhileBuildingList),
    buildValidCase('stays silent on ids minted once in a ref and a lazy state initialiser', mintedOnceInRefAndLazyState),
    buildValidCase("stays silent on a method that reads a node's existing id", methodReadingExistingId),
    buildValidCase('stays silent on name-based uuid v5 keys', nameBasedUuid),
    buildValidCase('stays silent on an id minted inside an event handler', mintedInsideHandler),
    buildValidCase('stays silent on a destructured uuid field', destructuredUuidField),
    buildValidCase('stays silent on a list key minted by a function not in its minters', customMinterKeyInMap),
    buildValidCase('stays silent on a minted key on a lone element, outside any list callback', loneElementKeyedByMinter),
    buildValidCase(
      'stays silent on a minter wrapped in a function the key hands to a caching helper',
      minterHandedToCachingHelperInKey,
    ),
    buildValidCase("stays silent on a list key minted by v4 on nanoid, which is uuid's version name", listKeyedBy(versionNameOnAnotherHost), {
      filename: 'no-unstable-list-keys.tsx',
    }),
    buildValidCase('stays silent on a minted key in a callback handed to a call that builds no list', minterKeyInANonListCall, {
      filename: 'no-unstable-list-keys.tsx',
    }),
    buildValidCase(
      'stays silent on a minter in a parameter default of a method signature with no body, where a function boundary ends the search',
      minterInAMethodSignatureDefault,
      { filename: 'no-unstable-list-keys.tsx' },
    ),
  buildValidCase(
    'stays silent on a minted key on an element of the array map is called on, outside the callback it runs per row',
    minterKeyInTheArrayAMapIsCalledOn,
    { filename: 'no-unstable-list-keys.tsx' },
  ),
  ],
  invalid: [
    buildInvalidCase('reports a list key minted by crypto.randomUUID()', randomUuidKeyInMap, {
      filename: 'no-unstable-list-keys.tsx',
      errors: [{ messageId: 'unstable', line: 5 }],
    }),
    buildInvalidCase('reports a list key minted by a function its minters option names', customMinterKeyInMap, {
      filename: 'no-unstable-list-keys.tsx',
      options: [{ minters: [customMinter] }],
      errors: [{ messageId: 'unstable', line: 6, data: { minter: customMinter } }],
    }),
    buildInvalidCase(
      'reports a list key minted by crypto.randomUUID() when its options object leaves minters out, so the default minters apply',
      randomUuidKeyInMap,
      {
        filename: 'no-unstable-list-keys.tsx',
        options: [{}],
        errors: [{ messageId: 'unstable', line: 5 }],
      },
    ),
    // The array's type does not reach a case built inside .map, so those cases name their type arguments.
    ...[...BARE_MINTER_CALLS, ...HOSTED_MINTER_CALLS].map(({ call, minter }) =>
      buildInvalidCase<'unstable', [{ minters?: readonly string[] }]>(
        `reports a list key minted by ${call}, naming ${minter}`,
        listKeyedBy(call),
        {
          filename: 'no-unstable-list-keys.tsx',
          errors: [{ messageId: 'unstable', line: 5, data: { minter } }],
        },
      ),
    ),
    ...OTHER_LIST_ITERATORS.map((iterator) =>
      buildInvalidCase<'unstable', [{ minters?: readonly string[] }]>(
        `reports a minted key on the rows ${iterator} builds`,
        listBuiltWith(iterator),
        {
          filename: 'no-unstable-list-keys.tsx',
          errors: [{ messageId: 'unstable', line: 5, data: { minter: 'crypto.randomUUID' } }],
        },
      ),
    ),
  ],
})

describe('no-unstable-list-keys options, as ESLint checks them', () => {
  it('accepts a minters option and applies it: a list key minted by a minter it names is reported', () => {
    const messages = lintWithHouseRule(
      'no-unstable-list-keys',
      [{ minters: [customMinter] }],
      customMinterKeyInMapModule,
      'no-unstable-list-keys.js',
    )

    expect(messages.map(({ ruleId }) => ruleId)).toStrictEqual(['house/no-unstable-list-keys'])
  })

  it('refuses an option key other than minters', () => {
    expect(() =>
      lintWithHouseRule(
        'no-unstable-list-keys',
        [{ minter: [customMinter] }],
        customMinterKeyInMapModule,
        'no-unstable-list-keys.js',
      ),
    ).toThrow(/Unexpected property "minter"/u)
  })
})

describe('no-unstable-list-keys messages, as a user reads them', () => {
  it('names the minter and says what it costs', () => {
    const messages = lintWithHouseRule('no-unstable-list-keys', [], listKeyedBy('crypto.randomUUID()'), 'no-unstable-list-keys.js')

    expect(messages.map(({ message }) => message)).toStrictEqual([
      'This key calls crypto.randomUUID(), so every render mints a new key and React unmounts and remounts the row -- losing focus, scroll position and anything typed into it. Key on something stable in the data (item.id, or a composite of the fields that identify the row), or mint the id once where the list is built.',
    ])
  })
})
