import {
  ariaHiddenAroundButton,
  ariaHiddenBesideSpreads,
  ariaHiddenControlsOutOfTabOrder,
  checkboxBesideAriaHiddenTrack,
  componentAndNonFocusableDescendants,
  controlsParkedWithNegativeTabIndex,
  decorationOnly,
  decorativeListConditionalAndCall,
  disabledAndUnreadableTabIndex,
  focusableElementPassedAsProp,
  focusableSibling,
  inertAncestor,
  inertDynamicFalseHreflessAndHidden,
  inertPartWayDown,
  nestedDecorativeWrappers,
} from '../__tests__/cases/no-focusable-content-in-aria-hidden.ts'
import { buildInvalidCase, buildValidCase } from '../__tests__/factories/rule-case-factories.ts'
import { houseRuleTester } from '../__tests__/house-rule-tester.ts'
import { housePlugin } from '../index.ts'

houseRuleTester.run('no-focusable-content-in-aria-hidden', housePlugin.rules['no-focusable-content-in-aria-hidden'], {
  valid: [
    buildValidCase('stays silent on aria-hidden around decoration only', decorationOnly),
    buildValidCase('stays silent on a focusable sibling of an aria-hidden element', focusableSibling),
    buildValidCase('stays silent on controls parked with tabIndex={-1}', controlsParkedWithNegativeTabIndex),
    buildValidCase(
      'stays silent on inert, dynamic and "false" aria-hidden, an href-less <a> and a hidden input',
      inertDynamicFalseHreflessAndHidden,
    ),
    buildValidCase('stays silent on a focusable element passed as a prop', focusableElementPassedAsProp),
    buildValidCase(
      'stays silent on component and non-focusable intrinsic descendants',
      componentAndNonFocusableDescendants,
    ),
    buildValidCase('stays silent on a disabled descendant and an unreadable tabIndex', disabledAndUnreadableTabIndex),
    buildValidCase('stays silent on a checkbox beside an aria-hidden switch track', checkboxBesideAriaHiddenTrack),
    buildValidCase('stays silent under an inert ancestor', inertAncestor),
    buildValidCase(
      'stays silent on decorative children rendered by map, a conditional and a call',
      decorativeListConditionalAndCall,
    ),
    buildValidCase('stays silent on aria-hidden beside spread attributes', ariaHiddenBesideSpreads),
    buildValidCase('stays silent on nested decorative aria-hidden wrappers', nestedDecorativeWrappers),
    buildValidCase('stays silent when inert is applied part-way down the hidden subtree', inertPartWayDown),
    buildValidCase('stays silent on aria-hidden controls that are out of the tab order', ariaHiddenControlsOutOfTabOrder),
  ],
  invalid: [
    buildInvalidCase('reports aria-hidden around a focusable button', ariaHiddenAroundButton, {
      filename: 'no-focusable-content-in-aria-hidden.tsx',
      errors: [{ messageId: 'focusable', line: 3 }],
    }),
  ],
})
