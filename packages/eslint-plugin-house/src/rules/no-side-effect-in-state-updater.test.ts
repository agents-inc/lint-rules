import type { ESLintUtils } from '@typescript-eslint/utils'

import {
  arrayAndMapCopies,
  copiedSearchParamsMutated,
  effectInCallbackHandedToNonIteratingCall,
  effectsInEventHandler,
  effectsInFunctionsTheUpdaterOnlyBuilds,
  effectsInsideUpdater,
  localSetMutatedInFilter,
  nonReactSetApis,
  objectStateRebuiltBySpread,
  privateFieldNamedCurrentWrittenInUpdater,
  pureClassSetStateUpdater,
  pureComputationOnPrevAndProps,
  pureSetHelperAndBuilderApi,
  pureSetHelpersAssignedAndMapped,
  setterCalledInsideUpdater,
  setterStoredInHandler,
  stateUpdaterRunning,
  storageWriteThrough,
  storageWriteThroughWindow,
} from '../__tests__/cases/no-side-effect-in-state-updater.ts'
import { buildInvalidCase, buildValidCase } from '../__tests__/factories/rule-case-factories.ts'
import { houseRuleTester } from '../__tests__/house-rule-tester.ts'
import { housePlugin } from '../index.ts'

// The invalid array's type does not reach a case built inside .map, so those cases name it outright.
type StateUpdaterMessageIds = ESLintUtils.InferMessageIdsTypeFromRule<
  (typeof housePlugin.rules)['no-side-effect-in-state-updater']
>

const GLOBAL_ALIASES_BESIDE_WINDOW = ['globalThis', 'self']

houseRuleTester.run('no-side-effect-in-state-updater', housePlugin.rules['no-side-effect-in-state-updater'], {
  valid: [
    buildValidCase('stays silent on a copy of the previous params, mutated and returned', copiedSearchParamsMutated),
    buildValidCase('stays silent on array and Map copies built inside the updater', arrayAndMapCopies),
    buildValidCase('stays silent on pure computation over the previous state and props', pureComputationOnPrevAndProps),
    buildValidCase('stays silent on a setter captured in a handler stored in state', setterStoredInHandler),
    buildValidCase('stays silent on effects in the event handler around the updater', effectsInEventHandler),
    buildValidCase('stays silent on object state rebuilt by spread', objectStateRebuiltBySpread),
    buildValidCase('stays silent on set* APIs that are not React state', nonReactSetApis),
    buildValidCase(
      'stays silent on a pure set* helper in return position and on a builder API taking a callback',
      pureSetHelperAndBuilderApi,
    ),
    buildValidCase('stays silent on a local Set mutated inside a filter callback', localSetMutatedInFilter),
    buildValidCase('stays silent on a pure this.setState updater', pureClassSetStateUpdater),
    buildValidCase(
      'stays silent on pure set* helpers assigned to a local and called inside a map',
      pureSetHelpersAssignedAndMapped,
    ),
    buildValidCase(
      'stays silent on effects inside arrow, function-expression and declared functions the updater builds but never calls',
      effectsInFunctionsTheUpdaterOnlyBuilds,
    ),
    buildValidCase(
      'stays silent on an effect inside a callback handed to a call that is not an array iteration',
      effectInCallbackHandedToNonIteratingCall,
    ),
    buildValidCase(
      'stays silent on a method of a known effectful global called through a computed key, which it cannot read',
      stateUpdaterRunning("axios[method]('/x')"),
    ),
    buildValidCase(
      'stays silent on a mutator called through a computed index, which it cannot follow',
      stateUpdaterRunning('list[0].push(1)'),
    ),
    buildValidCase(
      'stays silent on a mutator called through a computed key, which it cannot follow',
      stateUpdaterRunning('list[key].push(1)'),
    ),
  ],
  invalid: [
    buildInvalidCase('reports a URL revoke, a storage write and a ref write inside a state updater', effectsInsideUpdater, {
      filename: 'no-side-effect-in-state-updater.tsx',
      errors: [
        { messageId: 'effect', line: 9 },
        { messageId: 'effect', line: 10 },
        { messageId: 'refWrite', line: 11 },
      ],
    }),
    buildInvalidCase('reports a state setter called inside another state updater', setterCalledInsideUpdater, {
      filename: 'no-side-effect-in-state-updater.tsx',
      errors: [{ messageId: 'nestedUpdate', line: 9, data: { name: 'setCount' } }],
    }),
    buildInvalidCase('reports a storage write reached through window. inside a state updater', storageWriteThroughWindow, {
      filename: 'no-side-effect-in-state-updater.tsx',
      errors: [{ messageId: 'effect', line: 9, data: { name: 'window.localStorage.setItem' } }],
    }),
    buildInvalidCase(
      'reports a write to a property of an outer object as an outer mutation',
      stateUpdaterRunning('settings.value = prev'),
      {
        filename: 'no-side-effect-in-state-updater.tsx',
        errors: [{ messageId: 'outerMutation', line: 2, data: { name: 'settings.value' } }],
      },
    ),
    buildInvalidCase(
      'reports a write to an outer computed [current] as an outer mutation, not a ref write',
      stateUpdaterRunning('ref[current] = prev'),
      {
        filename: 'no-side-effect-in-state-updater.tsx',
        errors: [{ messageId: 'outerMutation', line: 2, data: { name: 'ref[current]' } }],
      },
    ),
    buildInvalidCase(
      'reports a write to a property under current as an outer mutation, not a ref write',
      stateUpdaterRunning('cache.current.items = prev'),
      {
        filename: 'no-side-effect-in-state-updater.tsx',
        errors: [{ messageId: 'outerMutation', line: 2, data: { name: 'cache.current.items' } }],
      },
    ),
    buildInvalidCase(
      "reports a write to another instance's private #current as an outer mutation, not a ref write",
      privateFieldNamedCurrentWrittenInUpdater,
      {
        filename: 'no-side-effect-in-state-updater.tsx',
        errors: [{ messageId: 'outerMutation', line: 6, data: { name: 'other.#current' } }],
      },
    ),
    ...GLOBAL_ALIASES_BESIDE_WINDOW.map((globalAlias) =>
      buildInvalidCase<StateUpdaterMessageIds, []>(
        `reports a storage write reached through ${globalAlias}. inside a state updater`,
        storageWriteThrough(globalAlias),
        {
          filename: 'no-side-effect-in-state-updater.tsx',
          errors: [{ messageId: 'effect', line: 9, data: { name: `${globalAlias}.localStorage.setItem` } }],
        },
      ),
    ),
  ],
})
