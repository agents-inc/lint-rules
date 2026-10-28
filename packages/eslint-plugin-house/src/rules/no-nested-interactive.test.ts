import { describe, expect, it } from 'vitest'

import {
  backdropBesidePanel,
  buttonInsideClickableDiv,
  childrenFromPropsInsideLink,
  clickableChildInsideHreflessAnchor,
  clickHandlerInsideButtonModule,
  controlsInsideOneForm,
  deepNestingInsideOneForm,
  hiddenInputInsideButton,
  inputInsideButtonModule,
  inputTypedByInsideButton,
  labelledFieldsAndClickableDivInsideForm,
  linkInsideLinkModule,
  linksInsideListInsideNav,
  nestedControlsLinksAndForms,
  nonClickableChildrenInsideLink,
  selectTypedHiddenInsideButton,
  siblingButtons,
  textareaInsideButton,
  triggerBesideMenu,
} from '../__tests__/cases/no-nested-interactive.ts'
import {
  fixedTextAttributeForms,
  interpolatedTemplateAttribute,
  templateAttribute,
} from '../__tests__/factories/attribute-factories.ts'
import { buildInvalidCase, buildValidCase } from '../__tests__/factories/rule-case-factories.ts'
import { lintWithHouseRule } from '../__tests__/house-linter.ts'
import { houseRuleTester } from '../__tests__/house-rule-tester.ts'
import { housePlugin } from '../index.ts'

houseRuleTester.run('no-nested-interactive', housePlugin.rules['no-nested-interactive'], {
  valid: [
    buildValidCase('stays silent on sibling buttons', siblingButtons),
    buildValidCase('stays silent on a button inside a clickable div', buttonInsideClickableDiv),
    buildValidCase('stays silent on links inside a list inside a nav', linksInsideListInsideNav),
    buildValidCase('stays silent on form controls, a button and a link inside one form', controlsInsideOneForm),
    buildValidCase('stays silent on non-clickable children inside a link', nonClickableChildrenInsideLink),
    buildValidCase('stays silent on a click-away backdrop beside its panel', backdropBesidePanel),
    buildValidCase('stays silent on a clickable child inside an href-less <a>', clickableChildInsideHreflessAnchor),
    buildValidCase(
      'stays silent on labelled fields and a clickable div inside a form',
      labelledFieldsAndClickableDivInsideForm,
    ),
    buildValidCase('stays silent on a menu trigger beside its menu', triggerBesideMenu),
    buildValidCase('stays silent on children a link receives through props', childrenFromPropsInsideLink),
    buildValidCase('stays silent on deep nesting inside one form', deepNestingInsideOneForm),
    buildValidCase('stays silent on a hidden input inside a button', hiddenInputInsideButton),
    ...fixedTextAttributeForms('type', 'hidden').map((typeAttribute) =>
      buildValidCase<[]>(
        `stays silent on a hidden input written ${typeAttribute} inside a button`,
        inputTypedByInsideButton(typeAttribute),
      ),
    ),
  ],
  invalid: [
    buildInvalidCase(
      'reports controls inside a button, links inside a link, a form inside a form, and click handlers inside each',
      nestedControlsLinksAndForms,
      {
        filename: 'no-nested-interactive.tsx',
        errors: [
          { messageId: 'swallowed', line: 6 },
          { messageId: 'reparented', line: 7 },
          { messageId: 'handler', line: 8 },
          { messageId: 'reparented', line: 11 },
          { messageId: 'handler', line: 12 },
          { messageId: 'reparented', line: 15 },
        ],
      },
    ),
    buildInvalidCase(
      'reports an input inside a button whose type is a template with something interpolated, which it cannot read',
      inputTypedByInsideButton(interpolatedTemplateAttribute('type', 'kind')),
      {
        filename: 'no-nested-interactive.tsx',
        errors: [{ messageId: 'swallowed', line: 4, data: { inner: 'input', outer: 'button' } }],
      },
    ),
    buildInvalidCase('reports a select written type="hidden" inside a button', selectTypedHiddenInsideButton, {
      filename: 'no-nested-interactive.tsx',
      errors: [{ messageId: 'swallowed', line: 4, data: { inner: 'select', outer: 'button' } }],
    }),
    buildInvalidCase(
      'reports an input inside a button whose type is a template reading text',
      inputTypedByInsideButton(templateAttribute('type', 'text')),
      {
        filename: 'no-nested-interactive.tsx',
        errors: [{ messageId: 'swallowed', line: 4, data: { inner: 'input', outer: 'button' } }],
      },
    ),
  buildInvalidCase('reports a textarea inside a button', textareaInsideButton, {
    filename: 'no-nested-interactive.tsx',
    errors: [{ messageId: 'swallowed', line: 4, data: { inner: 'textarea', outer: 'button' } }],
  }),
  ],
})

describe('no-nested-interactive messages, as a user reads them', () => {
  it('says a link inside a link is re-emitted as its sibling', () => {
    const messages = lintWithHouseRule('no-nested-interactive', [], linkInsideLinkModule, 'crumbs.js')

    expect(messages.map(({ message }) => message)).toStrictEqual([
      'Nesting <a> inside <a> is invalid HTML -- the parser closes the outer <a> and re-emits this one as its sibling, so the click lands on a control the JSX never described. Make them siblings deliberately, or demote the outer <a> to a plain element and move its handler here.',
    ])
  })

  it('says a control inside a button cannot be operated', () => {
    const messages = lintWithHouseRule('no-nested-interactive', [], inputInsideButtonModule, 'composer.js')

    expect(messages.map(({ message }) => message)).toStrictEqual([
      'A <input> inside a <button> cannot be operated reliably -- the button takes the click and the focus. Move the <input> out of the <button> and make them siblings.',
    ])
  })

  it('says a click handler inside a button fires the button too', () => {
    const messages = lintWithHouseRule('no-nested-interactive', [], clickHandlerInsideButtonModule, 'row.js')

    expect(messages.map(({ message }) => message)).toStrictEqual([
      'This onClick is inside <button>, which already owns the click -- it fires the <button> too unless the handler stops propagation, and a control nested this way cannot be reached by keyboard. Move the <span> out of the enclosing <button> and make them siblings.',
    ])
  })
})
