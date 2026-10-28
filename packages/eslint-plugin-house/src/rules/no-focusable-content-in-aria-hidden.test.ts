import { describe, expect, it } from 'vitest'

import {
  ARIA_HIDDEN_FOCUSABLE_ELEMENTS,
  ariaHiddenAroundAButtonModule,
  ariaHiddenAroundButton,
  ariaHiddenBesideSpreads,
  ariaHiddenButton,
  ariaHiddenButtonModule,
  ariaHiddenControlsOutOfTabOrder,
  ariaHiddenDivWithPlusZeroTabIndex,
  ariaHiddenHiddenButton,
  ariaHiddenInsideAnOrdinaryElement,
  ariaHiddenInsideAriaHidden,
  ariaHiddenMemberTagInTabOrder,
  buttonInAFragmentRenderedByAnExpressionInsideAriaHidden,
  buttonInASpreadChildOfAFragmentInsideAriaHidden,
  buttonInFragmentInsideAriaHidden,
  buttonInSpanInsideAriaHidden,
  buttonInsideWrapperWith,
  buttonRenderedByAnExpressionInsideAriaHidden,
  buttonWithTabIndexInsideAriaHidden,
  checkboxBesideAriaHiddenTrack,
  componentAndNonFocusableDescendants,
  componentReturning,
  controlsParkedWithNegativeTabIndex,
  decorationOnly,
  decorativeListConditionalAndCall,
  disabledAndUnreadableTabIndex,
  divWithTabIndexInsideAriaHidden,
  focusableElementPassedAsProp,
  focusableSibling,
  inertAncestor,
  inertDynamicFalseHreflessAndHidden,
  inertPartWayDown,
  inputTypedByInsideAriaHidden,
  nestedDecorativeWrappers,
} from '../__tests__/cases/no-focusable-content-in-aria-hidden.ts'
import {
  bracedStringAttribute,
  expressionAttribute,
  fixedTextAttributeForms,
  interpolatedTemplateAttribute,
  quotedAttribute,
  templateAttribute,
} from '../__tests__/factories/attribute-factories.ts'
import { buildInvalidCase, buildValidCase } from '../__tests__/factories/rule-case-factories.ts'
import { lintWithHouseRule } from '../__tests__/house-linter.ts'
import { houseRuleTester } from '../__tests__/house-rule-tester.ts'
import { housePlugin } from '../index.ts'

const ARIA_HIDDEN = 'aria-hidden'
const TAB_INDEX = 'tabIndex'
// A bare aria-hidden renders "true" as well.
const ARIA_HIDDEN_TRUE_FORMS = [
  ARIA_HIDDEN,
  expressionAttribute(ARIA_HIDDEN, 'true'),
  ...fixedTextAttributeForms(ARIA_HIDDEN, 'true'),
]
const TAB_INDEX_ZERO_FORMS = [expressionAttribute(TAB_INDEX, '0'), ...fixedTextAttributeForms(TAB_INDEX, '0')]
const LOWERCASE_TAB_INDEX = 'tabindex'

houseRuleTester.run('no-focusable-content-in-aria-hidden', housePlugin.rules['no-focusable-content-in-aria-hidden'], {
  valid: [
    buildValidCase('stays silent on aria-hidden around decoration only', decorationOnly),
    buildValidCase('stays silent on an aria-hidden button that is hidden too', ariaHiddenHiddenButton),
    buildValidCase('stays silent on an aria-hidden div with tabIndex={+0}, a unary plus it does not read', ariaHiddenDivWithPlusZeroTabIndex),
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
    ...fixedTextAttributeForms('type', 'hidden').map((typeAttribute) =>
      buildValidCase<[]>(
        `stays silent on a hidden input written ${typeAttribute} inside aria-hidden`,
        inputTypedByInsideAriaHidden(typeAttribute),
      ),
    ),
    buildValidCase(
      'stays silent on an aria-hidden that is a template with something interpolated, which it cannot read',
      buttonInsideWrapperWith(interpolatedTemplateAttribute(ARIA_HIDDEN, 'hidden')),
    ),
    buildValidCase(
      'stays silent on an aria-hidden that is a template reading false',
      buttonInsideWrapperWith(templateAttribute(ARIA_HIDDEN, 'false')),
    ),
    buildValidCase(
      'stays silent on a tabIndex that is a template with something interpolated, which it cannot read',
      divWithTabIndexInsideAriaHidden(interpolatedTemplateAttribute(TAB_INDEX, 'index')),
    ),
    buildValidCase(
      'stays silent on a div with a bare tabIndex inside aria-hidden, which renders no tabindex',
      divWithTabIndexInsideAriaHidden(TAB_INDEX),
    ),
    ...[expressionAttribute(ARIA_HIDDEN, 'false'), bracedStringAttribute(ARIA_HIDDEN, 'false')].map((ariaHiddenAttribute) =>
      buildValidCase<[]>(
        `stays silent on a button inside a wrapper written ${ariaHiddenAttribute}`,
        buttonInsideWrapperWith(ariaHiddenAttribute),
      ),
    ),
    buildValidCase(
      'stays silent on a button written tabindex="-1" inside aria-hidden',
      buttonWithTabIndexInsideAriaHidden(quotedAttribute(LOWERCASE_TAB_INDEX, '-1')),
    ),
  buildValidCase(
    'stays silent on a button in a spread child of a fragment inside aria-hidden, as it does not read spread children',
    buttonInASpreadChildOfAFragmentInsideAriaHidden,
  ),
  ],
  invalid: [
    buildInvalidCase('reports aria-hidden around a focusable button', ariaHiddenAroundButton, {
      filename: 'no-focusable-content-in-aria-hidden.tsx',
      errors: [{ messageId: 'focusable', line: 3 }],
    }),
    ...ARIA_HIDDEN_TRUE_FORMS.map((ariaHiddenAttribute) =>
      buildInvalidCase<'focusable' | 'self', []>(
        `reports a button inside a wrapper written ${ariaHiddenAttribute}`,
        buttonInsideWrapperWith(ariaHiddenAttribute),
        {
          filename: 'no-focusable-content-in-aria-hidden.tsx',
          errors: [{ messageId: 'focusable', line: 3, data: { descendant: 'button' } }],
        },
      ),
    ),
    buildInvalidCase(
      'reports an input inside aria-hidden whose type is a template with something interpolated, which it cannot read',
      inputTypedByInsideAriaHidden(interpolatedTemplateAttribute('type', 'kind')),
      {
        filename: 'no-focusable-content-in-aria-hidden.tsx',
        errors: [{ messageId: 'focusable', line: 3, data: { descendant: 'input' } }],
      },
    ),
    ...TAB_INDEX_ZERO_FORMS.map((tabIndexAttribute) =>
      buildInvalidCase<'focusable' | 'self', []>(
        `reports a div written ${tabIndexAttribute} inside aria-hidden`,
        divWithTabIndexInsideAriaHidden(tabIndexAttribute),
        {
          filename: 'no-focusable-content-in-aria-hidden.tsx',
          errors: [{ messageId: 'focusable', line: 3, data: { descendant: 'div' } }],
        },
      ),
    ),
    buildInvalidCase(
      'reports a div written tabindex="0" inside aria-hidden',
      divWithTabIndexInsideAriaHidden(quotedAttribute(LOWERCASE_TAB_INDEX, '0')),
      {
        filename: 'no-focusable-content-in-aria-hidden.tsx',
        errors: [{ messageId: 'focusable', line: 3, data: { descendant: 'div' } }],
      },
    ),
    buildInvalidCase(
      'reports a div written tabIndex={-0} inside aria-hidden, which renders tabindex="0"',
      divWithTabIndexInsideAriaHidden(expressionAttribute(TAB_INDEX, '-0')),
      {
        filename: 'no-focusable-content-in-aria-hidden.tsx',
        errors: [{ messageId: 'focusable', line: 3, data: { descendant: 'div' } }],
      },
    ),
    buildInvalidCase(
      'reports a button written tabIndex={null} inside aria-hidden, which renders no tabindex and stays focusable',
      buttonWithTabIndexInsideAriaHidden(expressionAttribute(TAB_INDEX, 'null')),
      {
        filename: 'no-focusable-content-in-aria-hidden.tsx',
        errors: [{ messageId: 'focusable', line: 3, data: { descendant: 'button' } }],
      },
    ),
    buildInvalidCase('reports an aria-hidden button that is itself focusable, naming its tag', ariaHiddenButton, {
      filename: 'no-focusable-content-in-aria-hidden.tsx',
      errors: [{ messageId: 'self', line: 2, data: { tag: 'button' } }],
    }),
    buildInvalidCase(
      'reports an aria-hidden member tag in the tab order as itself focusable, calling it an element',
      ariaHiddenMemberTagInTabOrder,
      {
        filename: 'no-focusable-content-in-aria-hidden.tsx',
        errors: [{ messageId: 'self', line: 2, data: { tag: 'element' } }],
      },
    ),
    buildInvalidCase('reports a button inside a fragment inside aria-hidden', buttonInFragmentInsideAriaHidden, {
      filename: 'no-focusable-content-in-aria-hidden.tsx',
      errors: [{ messageId: 'focusable', line: 3, data: { descendant: 'button' } }],
    }),
    buildInvalidCase(
      'reports a button inside a span, neither focusable nor inert, inside aria-hidden',
      buttonInSpanInsideAriaHidden,
      {
        filename: 'no-focusable-content-in-aria-hidden.tsx',
        errors: [{ messageId: 'focusable', line: 3, data: { descendant: 'button' } }],
      },
    ),
    // The array's type does not reach a case built inside .map, so those cases name their type arguments.
    ...ARIA_HIDDEN_FOCUSABLE_ELEMENTS.map(({ element, tag }) =>
      buildInvalidCase<'focusable' | 'self', []>(`reports an aria-hidden <${tag}> that is itself focusable`, componentReturning(element), {
        filename: 'no-focusable-content-in-aria-hidden.tsx',
        errors: [{ messageId: 'self', line: 2, data: { tag } }],
      }),
    ),
    buildInvalidCase(
      'reports aria-hidden around a button inside an element that is neither aria-hidden nor inert',
      ariaHiddenInsideAnOrdinaryElement,
      {
        filename: 'no-focusable-content-in-aria-hidden.tsx',
        errors: [{ messageId: 'focusable', line: 4, data: { descendant: 'button' } }],
      },
    ),
    buildInvalidCase(
      'reports only the outer of two nested aria-hidden elements around a button, which already covers the inner one',
      ariaHiddenInsideAriaHidden,
      {
        filename: 'no-focusable-content-in-aria-hidden.tsx',
        errors: [{ messageId: 'focusable', line: 3, data: { descendant: 'button' } }],
      },
    ),
    buildInvalidCase(
      'reports aria-hidden around a button an expression renders',
      buttonRenderedByAnExpressionInsideAriaHidden,
      {
        filename: 'no-focusable-content-in-aria-hidden.tsx',
        errors: [{ messageId: 'focusable', line: 3, data: { descendant: 'button' } }],
      },
    ),
    buildInvalidCase(
      'reports aria-hidden around a button in a fragment an expression renders',
      buttonInAFragmentRenderedByAnExpressionInsideAriaHidden,
      {
        filename: 'no-focusable-content-in-aria-hidden.tsx',
        errors: [{ messageId: 'focusable', line: 3, data: { descendant: 'button' } }],
      },
    ),
  ],
})

describe('no-focusable-content-in-aria-hidden messages, as a user reads them', () => {
  it('names the focusable element inside an aria-hidden one', () => {
    const messages = lintWithHouseRule('no-focusable-content-in-aria-hidden', [], ariaHiddenAroundAButtonModule, 'toolbar.js')

    expect(messages.map(({ message }) => message)).toStrictEqual([
      'This element is aria-hidden but contains a focusable <button>. Keyboard users tab into something screen readers say is not there -- drop aria-hidden if the content is real, or add `inert` here (tabIndex={-1} on the descendant if you cannot).',
    ])
  })

  it('names an aria-hidden element that is itself focusable', () => {
    const messages = lintWithHouseRule('no-focusable-content-in-aria-hidden', [], ariaHiddenButtonModule, 'close.js')

    expect(messages.map(({ message }) => message)).toStrictEqual([
      'This <button> is aria-hidden but is itself focusable. Keyboard users tab into something screen readers say is not there -- drop aria-hidden if the control is real, or take it out of the tab order with tabIndex={-1}.',
    ])
  })
})
