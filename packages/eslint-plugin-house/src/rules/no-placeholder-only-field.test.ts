import {
  componentField,
  inputWithPlaceholder,
  namedByAriaLabel,
  namedByIdAndLabelFor,
  namedByLabelledbyTitleOrEmptyPlaceholder,
  namedByTemplateIdAndLabelFor,
  noPlaceholder,
  placeholderOnlyInput,
  restSpreadAfterPlaceholder,
  spreadMayCarryName,
  wrappedInFormLabelComponent,
  wrappedInLabel,
  wrappedInLabelWithCaption,
  wrappedInNamespacedLabel,
} from '../__tests__/cases/no-placeholder-only-field.ts'
import {
  fixedTextAttributeForms,
  interpolatedTemplateAttribute,
  templateAttribute,
} from '../__tests__/factories/attribute-factories.ts'
import { buildInvalidCase, buildValidCase } from '../__tests__/factories/rule-case-factories.ts'
import { houseRuleTester } from '../__tests__/house-rule-tester.ts'
import { housePlugin } from '../index.ts'

houseRuleTester.run('no-placeholder-only-field', housePlugin.rules['no-placeholder-only-field'], {
  valid: [
    buildValidCase('stays silent on a field named by aria-label', namedByAriaLabel),
    buildValidCase('stays silent on a field with an id that a label points at', namedByIdAndLabelFor),
    buildValidCase('stays silent on a field with no placeholder', noPlaceholder),
    buildValidCase('stays silent on a field whose spread props may carry its name', spreadMayCarryName),
    buildValidCase('stays silent on a field wrapped in a <label>', wrappedInLabel),
    buildValidCase('stays silent on a component field', componentField),
    buildValidCase(
      'stays silent on fields named by aria-labelledby or title, and on an empty placeholder',
      namedByLabelledbyTitleOrEmptyPlaceholder,
    ),
    buildValidCase('stays silent on a field wrapped in a FormLabel component', wrappedInFormLabelComponent),
    buildValidCase('stays silent on a field wrapped in a <label> with a caption', wrappedInLabelWithCaption),
    buildValidCase('stays silent on a field whose template-literal id a label points at', namedByTemplateIdAndLabelFor),
    buildValidCase('stays silent on a field with rest props spread after its placeholder', restSpreadAfterPlaceholder),
    buildValidCase('stays silent on a field wrapped in Form.Label', wrappedInNamespacedLabel),
    ...fixedTextAttributeForms('placeholder', '').map((placeholderAttribute) =>
      buildValidCase<[]>(
        `stays silent on an empty placeholder written ${placeholderAttribute}, which names nothing`,
        inputWithPlaceholder(placeholderAttribute),
      ),
    ),
  ],
  invalid: [
    buildInvalidCase('reports an input whose only accessible name is its placeholder', placeholderOnlyInput, {
      filename: 'no-placeholder-only-field.tsx',
      errors: [{ messageId: 'placeholderOnly', line: 2 }],
    }),
    buildInvalidCase(
      'reports a placeholder that is a template with something interpolated, which it cannot read',
      inputWithPlaceholder(interpolatedTemplateAttribute('placeholder', 'hint')),
      {
        filename: 'no-placeholder-only-field.tsx',
        errors: [{ messageId: 'placeholderOnly', line: 2, data: { tag: 'input' } }],
      },
    ),
    buildInvalidCase(
      'reports a placeholder that is a template reading text',
      inputWithPlaceholder(templateAttribute('placeholder', 'Search projects')),
      {
        filename: 'no-placeholder-only-field.tsx',
        errors: [{ messageId: 'placeholderOnly', line: 2, data: { tag: 'input' } }],
      },
    ),
  ],
})
