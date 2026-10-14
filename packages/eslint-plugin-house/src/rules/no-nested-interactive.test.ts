import {
  backdropBesidePanel,
  buttonInsideClickableDiv,
  childrenFromPropsInsideLink,
  clickableChildInsideHreflessAnchor,
  controlsInsideOneForm,
  deepNestingInsideOneForm,
  hiddenInputInsideButton,
  labelledFieldsAndClickableDivInsideForm,
  linksInsideListInsideNav,
  nestedControlsLinksAndForms,
  nonClickableChildrenInsideLink,
  siblingButtons,
  triggerBesideMenu,
} from '../__tests__/cases/no-nested-interactive.ts'
import { buildInvalidCase, buildValidCase } from '../__tests__/factories/rule-case-factories.ts'
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
  ],
})
