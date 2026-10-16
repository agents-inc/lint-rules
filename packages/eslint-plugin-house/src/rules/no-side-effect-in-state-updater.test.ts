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
  pureClassSetStateUpdater,
  pureComputationOnPrevAndProps,
  pureSetHelperAndBuilderApi,
  pureSetHelpersAssignedAndMapped,
  setterCalledInsideUpdater,
  setterStoredInHandler,
  storageWriteThroughWindow,
} from '../__tests__/cases/no-side-effect-in-state-updater.ts'
import { buildInvalidCase, buildValidCase } from '../__tests__/factories/rule-case-factories.ts'
import { houseRuleTester } from '../__tests__/house-rule-tester.ts'
import { housePlugin } from '../index.ts'

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
  ],
})
