import {
  ariaHiddenAroundButton,
  ariaHiddenBesideSpreads,
  ariaHiddenButton,
  ariaHiddenControlsOutOfTabOrder,
  ariaHiddenMemberTagInTabOrder,
  buttonInFragmentInsideAriaHidden,
  buttonInSpanInsideAriaHidden,
  buttonInsideWrapperWith,
  buttonWithTabIndexInsideAriaHidden,
  checkboxBesideAriaHiddenTrack,
  componentAndNonFocusableDescendants,
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
  ],
})
