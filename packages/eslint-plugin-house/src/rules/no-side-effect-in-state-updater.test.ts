import { describe, expect, it } from 'vitest'

import type { ESLintUtils } from '@typescript-eslint/utils'

import {
  arrayAndMapCopies,
  assignmentToAPlainVariable,
  bareCallNamedLikeAMutator,
  copiedSearchParamsMutated,
  effectInCallbackHandedTo,
  effectInCallbackHandedToNonIteratingCall,
  effectInCallbackScheduledBy,
  effectInClassSetStateUpdater,
  effectInFunctionExpressionUpdater,
  effectInSetterTakingThreeArguments,
  effectInUpdaterBesideOptions,
  effectsInEventHandler,
  effectsInFunctionsTheUpdaterOnlyBuilds,
  effectsInsideUpdater,
  effectsPassedToFunctionsNotNamedLikeSetters,
  everyFindingInOneUpdater,
  GLOBAL_EFFECT_CALLS,
  localSetMutatedInFilter,
  MEMBER_EFFECT_CALLS,
  MUTATING_METHODS,
  mutationOfACopyARestElementCollects,
  mutationOfANameADestructuredPropertyBinds,
  mutationOfANameAnArrayPatternBinds,
  mutationOfANameAParameterPropertyBinds,
  mutationOfANameBoundPastAHole,
  mutationOfANameBoundWithADefaultValue,
  mutationThroughANestedPath,
  nonReactSetApis,
  objectStateRebuiltBySpread,
  privateFieldNamedCurrentWrittenInUpdater,
  pureClassSetStateUpdater,
  pureComputationOnPrevAndProps,
  pureSetHelperAndBuilderApi,
  pureSetHelpersAssignedAndMapped,
  SCHEDULERS_NAMED_LIKE_SETTERS,
  setterCalledInsideUpdater,
  setterCalledWithTwoArguments,
  settersDiscardedThroughConditionalLogicalAndSequence,
  setterStoredInHandler,
  stateUpdaterRunning,
  storageWriteThrough,
  storageWriteThroughWindow,
  SYNC_CALLBACK_METHODS,
  updaterRunning,
  writeToAPropertyOfACopy,
  writeToAPropertyOfADeclaredFunction,
  writeToAPropertyOfAValueMadeOnTheSpot,
  writeToTheErrorACatchClauseBinds,
  writeToTheRestOfADestructuredObject,
} from '../__tests__/cases/no-side-effect-in-state-updater.ts'
import { buildInvalidCase, buildValidCase } from '../__tests__/factories/rule-case-factories.ts'
import { lintWithHouseRule } from '../__tests__/house-linter.ts'
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
      'stays silent on effects in functions passed to settle and resetCount, whose names do not read as state setters',
      effectsPassedToFunctionsNotNamedLikeSetters,
    ),
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
      'stays silent on a method of a known effectful global that only reads, as localStorage.getItem does',
      stateUpdaterRunning("localStorage.getItem('draft')"),
    ),
    buildValidCase(
      'stays silent on a mutator called through a computed index, which it cannot follow',
      stateUpdaterRunning('list[0].push(1)'),
    ),
    buildValidCase(
      'stays silent on a mutator called through a computed key, which it cannot follow',
      stateUpdaterRunning('list[key].push(1)'),
    ),
  // The arrays' types do not reach a case built inside .map, so those cases name their type arguments.
  ...SCHEDULERS_NAMED_LIKE_SETTERS.map((scheduler) =>
    buildValidCase<[]>(`stays silent on a storage write in a callback handed to ${scheduler}, which schedules it`, effectInCallbackScheduledBy(scheduler)),
  ),
  buildValidCase('stays silent on a set* call taking three arguments, which is not a React setter', effectInSetterTakingThreeArguments),
  buildValidCase('stays silent on writing a property of a copy the updater built', writeToAPropertyOfACopy),
  buildValidCase('stays silent on writing a property of a value made on the spot', writeToAPropertyOfAValueMadeOnTheSpot),
  buildValidCase('stays silent on writing a property of a function the updater declares', writeToAPropertyOfADeclaredFunction),
  buildValidCase(
    'stays silent on mutating a name a constructor parameter property in the updater binds, as every name bound in the updater counts as its own',
    mutationOfANameAParameterPropertyBinds,
  ),
  buildValidCase('stays silent on mutating a name a destructured property binds in the updater', mutationOfANameADestructuredPropertyBinds),
  buildValidCase('stays silent on writing to the rest of an object the updater destructures', writeToTheRestOfADestructuredObject),
  buildValidCase('stays silent on mutating a name an array pattern binds in the updater', mutationOfANameAnArrayPatternBinds),
  buildValidCase('stays silent on mutating a name the updater binds with a default value', mutationOfANameBoundWithADefaultValue),
  buildValidCase('stays silent on mutating the copy a rest element in the updater collects', mutationOfACopyARestElementCollects),
  buildValidCase('stays silent on writing a property of the error a catch clause in the updater binds', writeToTheErrorACatchClauseBinds),
  buildValidCase('stays silent on mutating a name an array pattern binds past a hole', mutationOfANameBoundPastAHole),
  buildValidCase('stays silent on assigning a plain variable, as it reads only writes to a member', assignmentToAPlainVariable),
  buildValidCase('stays silent on a set* call with two arguments inside an updater, which it does not take for a setter', setterCalledWithTwoArguments),
  buildValidCase('stays silent on a bare call named like a mutating method, which has no receiver to mutate', bareCallNamedLikeAMutator),
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
  ...SYNC_CALLBACK_METHODS.map((method) =>
    buildInvalidCase<StateUpdaterMessageIds, []>(`reports a storage write in a callback the updater hands to ${method}, which runs it at once`, effectInCallbackHandedTo(method), {
      filename: 'no-side-effect-in-state-updater.tsx',
      errors: [{ messageId: 'effect', line: 10, data: { name: 'localStorage.setItem' } }],
    }),
  ),
  ...MUTATING_METHODS.map((method) =>
    buildInvalidCase<StateUpdaterMessageIds, []>(`reports ${method} called on an array outside the updater`, updaterRunning(`seen.${method}(prev.length)`), {
      filename: 'no-side-effect-in-state-updater.tsx',
      errors: [{ messageId: 'outerMutation', line: 9, data: { name: `seen.${method}` } }],
    }),
  ),
  ...GLOBAL_EFFECT_CALLS.map((call) =>
    buildInvalidCase<StateUpdaterMessageIds, []>(`reports a call to ${call} inside an updater`, updaterRunning(`${call}(() => prev.length)`), {
      filename: 'no-side-effect-in-state-updater.tsx',
      errors: [{ messageId: 'effect', line: 9, data: { name: call } }],
    }),
  ),
  ...MEMBER_EFFECT_CALLS.map((call) =>
    buildInvalidCase<StateUpdaterMessageIds, []>(`reports a call to ${call} inside an updater`, updaterRunning(`${call}(prev.length)`), {
      filename: 'no-side-effect-in-state-updater.tsx',
      errors: [{ messageId: 'effect', line: 9, data: { name: call } }],
    }),
  ),
  buildInvalidCase('reports a storage write in a this.setState updater', effectInClassSetStateUpdater, {
    filename: 'no-side-effect-in-state-updater.tsx',
    errors: [{ messageId: 'effect', line: 6, data: { name: 'localStorage.setItem' } }],
  }),
  buildInvalidCase('reports a storage write in an updater written as a function expression', effectInFunctionExpressionUpdater, {
    filename: 'no-side-effect-in-state-updater.tsx',
    errors: [{ messageId: 'effect', line: 7, data: { name: 'localStorage.setItem' } }],
  }),
  buildInvalidCase('reports a storage write in an updater passed beside one more argument', effectInUpdaterBesideOptions, {
    filename: 'no-side-effect-in-state-updater.tsx',
    errors: [{ messageId: 'effect', line: 4, data: { name: 'localStorage.setItem' } }],
  }),
  buildInvalidCase(
    'reports a setter called through a ternary, a logical and a comma in statement position, each still discarded',
    settersDiscardedThroughConditionalLogicalAndSequence,
    {
      filename: 'no-side-effect-in-state-updater.tsx',
      errors: [
        { messageId: 'nestedUpdate', line: 9, data: { name: 'setOther' } },
        { messageId: 'nestedUpdate', line: 10, data: { name: 'setOther' } },
        { messageId: 'nestedUpdate', line: 11, data: { name: 'setOther' } },
      ],
    },
  ),
  buildInvalidCase('reports a mutating method called through a nested path outside the updater', mutationThroughANestedPath, {
    filename: 'no-side-effect-in-state-updater.tsx',
    errors: [{ messageId: 'outerMutation', line: 9, data: { name: 'store.items.push' } }],
  }),
  ],
})

describe('no-side-effect-in-state-updater messages, as a user reads them', () => {
  it('names each finding and says why it is one', () => {
    const messages = lintWithHouseRule('no-side-effect-in-state-updater', [], everyFindingInOneUpdater, 'tray.js')

    expect(messages.map(({ message }) => message)).toStrictEqual([
      "'localStorage.setItem' is a side effect, and this is a state updater. Move it to the event handler or an effect and leave the updater returning only the next state -- StrictMode runs the updater twice and a bailed-out update runs it never.",
      "'setOther' queues another state update from inside a state updater. Call it from the event handler next to this one, so it runs exactly once.",
      "'ref.current' is assigned from inside a state updater. Write the ref in the event handler or an effect -- StrictMode runs this updater twice, so the ref keeps the second run's value.",
      "'ref.current.push' mutates a ref from inside a state updater. Do it in the event handler or an effect -- StrictMode runs this updater twice, so the mutation is applied twice. A ref cannot be fixed by copying it; the updater has to stop touching it.",
      "'seen.push' mutates something that outlives this state updater, so a StrictMode double-run applies it twice and a bailed-out update never applies it. Do it in the event handler, or build the next value from the updater's argument and return that instead.",
    ])
  })
})
