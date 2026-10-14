import {
  customMinter,
  customMinterKeyInMap,
  derivedKeys,
  destructuredUuidField,
  keyedOnDataId,
  keyedOnIndex,
  methodReadingExistingId,
  mintedInsideHandler,
  mintedInsideUseMemo,
  mintedOnceInRefAndLazyState,
  mintedOutsideKey,
  mintedOutsideListCallback,
  mintedWhileBuildingList,
  nameBasedUuid,
  randomUuidKeyInMap,
} from '../__tests__/cases/no-unstable-list-keys.ts'
import { buildInvalidCase, buildValidCase } from '../__tests__/factories/rule-case-factories.ts'
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
  ],
})
