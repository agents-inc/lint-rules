import {
  alertdialogNamedByTitle,
  alertdialogNamedByTranslatedLabel,
  dynamicRole,
  intrinsicDialogWithDynamicLabelledby,
  intrinsicDialogWithPresentationRole,
  menuRole,
  roleDialogNamedByAriaLabel,
  roleDialogNamedByAriaLabelledby,
  roleDialogNamedByTemplateLabelledby,
  roleDialogWithoutName,
  roleDialogWithSpreadProps,
} from '../__tests__/cases/dialog-has-accessible-name.ts'
import { buildInvalidCase, buildValidCase } from '../__tests__/factories/rule-case-factories.ts'
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
  ],
  invalid: [
    buildInvalidCase('reports a role="dialog" with no aria-label, aria-labelledby or title', roleDialogWithoutName, {
      filename: 'dialog-has-accessible-name.jsx',
      errors: [{ messageId: 'unnamed', line: 2 }],
    }),
  ],
})
