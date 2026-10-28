import { describe, expect, it } from 'vitest'

import {
  alertdialogNamedByTitle,
  alertdialogNamedByTranslatedLabel,
  dialogNamedOnlyByBlanks,
  dynamicRole,
  intrinsicDialogWithDynamicLabelledby,
  intrinsicDialogWithoutName,
  intrinsicDialogWithPresentationRole,
  menuRole,
  roleAlertdialogWithoutName,
  roleDialogLabelledBy,
  roleDialogNamedByAriaLabel,
  roleDialogNamedByAriaLabelledby,
  roleDialogNamedByTemplateLabelledby,
  roleDialogWithoutName,
  roleDialogWithSpreadProps,
  unnamedDivWithRole,
} from '../__tests__/cases/dialog-has-accessible-name.ts'
import { fixedTextAttributeForms, interpolatedTemplateAttribute } from '../__tests__/factories/attribute-factories.ts'
import { buildInvalidCase, buildValidCase } from '../__tests__/factories/rule-case-factories.ts'
import { lintWithHouseRule } from '../__tests__/house-linter.ts'
import { houseRuleTester } from '../__tests__/house-rule-tester.ts'
import { housePlugin } from '../index.ts'

houseRuleTester.run('dialog-has-accessible-name', housePlugin.rules['dialog-has-accessible-name'], {
  valid: [
    buildValidCase('stays silent on a role="dialog" named by aria-label', roleDialogNamedByAriaLabel),
    buildValidCase('stays silent on a role="dialog" named by aria-labelledby', roleDialogNamedByAriaLabelledby),
    buildValidCase('stays silent on a role="dialog" whose spread props may carry its name', roleDialogWithSpreadProps),
    buildValidCase('stays silent on a <dialog> named by a dynamic aria-labelledby', intrinsicDialogWithDynamicLabelledby),
    buildValidCase('stays silent on role="menu", which is not a dialog', menuRole),
    buildValidCase('stays silent on a dynamic role, which is not provably a dialog', dynamicRole),
    buildValidCase('stays silent on a role="alertdialog" named by title', alertdialogNamedByTitle),
    buildValidCase(
      'stays silent on a <dialog> whose role="presentation" replaces its dialog role',
      intrinsicDialogWithPresentationRole,
    ),
    buildValidCase('stays silent on a role="alertdialog" named by a translated aria-label', alertdialogNamedByTranslatedLabel),
    buildValidCase(
      'stays silent on a role="dialog" named by a template-literal aria-labelledby',
      roleDialogNamedByTemplateLabelledby,
    ),
    buildValidCase(
      'stays silent on a role that is a template with something interpolated, which is not provably a dialog',
      unnamedDivWithRole(interpolatedTemplateAttribute('role', 'role')),
    ),
    buildValidCase(
      'stays silent on a role="dialog" whose aria-label is a template with something interpolated, taken at its word',
      roleDialogLabelledBy(interpolatedTemplateAttribute('aria-label', 'title')),
    ),
    buildValidCase(
      'stays silent on a role="dialog" with a bare aria-label, which renders aria-label="true"',
      roleDialogLabelledBy('aria-label'),
    ),
  ],
  invalid: [
    buildInvalidCase('reports a role="dialog" with no aria-label, aria-labelledby or title', roleDialogWithoutName, {
      filename: 'dialog-has-accessible-name.jsx',
      errors: [{ messageId: 'unnamed', line: 2 }],
    }),
    buildInvalidCase('reports a <dialog> with no role and no accessible name, naming it <dialog>', intrinsicDialogWithoutName, {
      filename: 'dialog-has-accessible-name.jsx',
      errors: [{ messageId: 'unnamed', line: 2, data: { what: '<dialog>' } }],
    }),
    ...fixedTextAttributeForms('role', 'dialog').map((roleAttribute) =>
      buildInvalidCase<'unnamed', []>(
        `reports an unnamed element written ${roleAttribute}, naming it role="dialog"`,
        unnamedDivWithRole(roleAttribute),
        {
          filename: 'dialog-has-accessible-name.jsx',
          errors: [{ messageId: 'unnamed', line: 2, data: { what: 'role="dialog"' } }],
        },
      ),
    ),
    ...fixedTextAttributeForms('aria-label', '').map((ariaLabelAttribute) =>
      buildInvalidCase<'unnamed', []>(
        `reports a role="dialog" whose only name is ${ariaLabelAttribute}, which names nothing`,
        roleDialogLabelledBy(ariaLabelAttribute),
        {
          filename: 'dialog-has-accessible-name.jsx',
          errors: [{ messageId: 'unnamed', line: 2, data: { what: 'role="dialog"' } }],
        },
      ),
    ),
  buildInvalidCase('reports a role="alertdialog" with no accessible name', roleAlertdialogWithoutName, {
    filename: 'dialog-has-accessible-name.jsx',
    errors: [{ messageId: 'unnamed', line: 2, data: { what: 'role="alertdialog"' } }],
  }),
  buildInvalidCase('reports a <dialog> whose aria-label is only blanks, which names nothing', dialogNamedOnlyByBlanks, {
    filename: 'dialog-has-accessible-name.jsx',
    errors: [{ messageId: 'unnamed', line: 2, data: { what: '<dialog>' } }],
  }),
  ],
})

describe('dialog-has-accessible-name messages, as a user reads them', () => {
  it('names the dialog and the ways to name it', () => {
    const messages = lintWithHouseRule('dialog-has-accessible-name', [], roleAlertdialogWithoutName, 'confirm.js')

    expect(messages.map(({ message }) => message)).toStrictEqual([
      'This role="alertdialog" has no accessible name. Add aria-labelledby pointing at the id of its heading, or aria-label="What the dialog is for" -- a screen reader announces an unnamed dialog as just "dialog".',
    ])
  })
})
