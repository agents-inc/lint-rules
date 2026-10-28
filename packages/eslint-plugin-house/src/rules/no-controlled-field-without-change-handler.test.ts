import { describe, expect, it } from 'vitest'

import {
  CAPTURE_CHANGE_HANDLERS,
  componentFieldUndefinedValueAndNoValue,
  defaultValueField,
  disabledFieldAndOnInputHandler,
  fieldInsideLabelWithoutHandler,
  fieldNamedLikeAnInputType,
  fieldsUnderAFormWithClassAndOnChange,
  fieldsWithOnChange,
  fieldWithSpreadProps,
  formLevelOnChange,
  formLevelOnChangeAroundMappedFields,
  hiddenResetAndSubmitInputs,
  inputWithValueTypedBy,
  inputWithValueWrittenAs,
  OTHER_NON_TEXT_INPUT_TYPES,
  radioAndCheckboxValues,
  readOnlyField,
  textareaAndSelectWithoutHandler,
  valueWithoutHandler,
} from '../__tests__/cases/no-controlled-field-without-change-handler.ts'
import {
  fixedTextAttributeForms,
  interpolatedTemplateAttribute,
  quotedAttribute,
  templateAttribute,
} from '../__tests__/factories/attribute-factories.ts'
import { buildInvalidCase, buildValidCase } from '../__tests__/factories/rule-case-factories.ts'
import { lintWithHouseRule } from '../__tests__/house-linter.ts'
import { houseRuleTester } from '../__tests__/house-rule-tester.ts'
import { housePlugin } from '../index.ts'

// `\x65` is "e", so the template renders "hidden".
const HIDDEN_SPELLED_WITH_AN_ESCAPE = 'hidd\\x65n'
const VALUE = 'value'

houseRuleTester.run(
  'no-controlled-field-without-change-handler',
  housePlugin.rules['no-controlled-field-without-change-handler'],
  {
    valid: [
      buildValidCase('stays silent on a readOnly field', readOnlyField),
      buildValidCase('stays silent on a field whose spread props may carry the handler', fieldWithSpreadProps),
      buildValidCase('stays silent on an uncontrolled field with defaultValue', defaultValueField),
      buildValidCase('stays silent on an input, textarea and select that each have onChange', fieldsWithOnChange),
      buildValidCase(
        'stays silent on hidden, reset and submit inputs, whose value is not editable content',
        hiddenResetAndSubmitInputs,
      ),
      buildValidCase('stays silent on a disabled field and on a field driven by onInput', disabledFieldAndOnInputHandler),
      buildValidCase(
        'stays silent on a component field, value={undefined}, and a field with no value',
        componentFieldUndefinedValueAndNoValue,
      ),
      buildValidCase('stays silent on radio and checkbox values, which are submitted payloads', radioAndCheckboxValues),
      buildValidCase('stays silent on fields under a form-level onChange', formLevelOnChange),
      buildValidCase('stays silent on mapped fields under a form-level onChange', formLevelOnChangeAroundMappedFields),
      ...fixedTextAttributeForms('type', 'hidden').map((typeAttribute) =>
        buildValidCase<[]>(
          `stays silent on a hidden input written ${typeAttribute}`,
          inputWithValueTypedBy(typeAttribute),
        ),
      ),
      buildValidCase(
        'stays silent on a template type spelling hidden with an escape, read as the text it renders',
        inputWithValueTypedBy(templateAttribute('type', HIDDEN_SPELLED_WITH_AN_ESCAPE)),
      ),
    ...CAPTURE_CHANGE_HANDLERS.map((handler) =>
      buildValidCase<[]>(`stays silent on a field driven by ${handler}`, inputWithValueWrittenAs(`value={draft} ${handler}={update}`)),
    ),
    ...OTHER_NON_TEXT_INPUT_TYPES.map((type) =>
      buildValidCase<[]>(`stays silent on a ${type} input, whose value is not editable content`, inputWithValueTypedBy(`type="${type}"`)),
    ),
    buildValidCase('stays silent on a field with a value beside a defaultValue', inputWithValueWrittenAs('value={draft} defaultValue="draft"')),
    buildValidCase('stays silent on value={null}, which opts the field out of being controlled', inputWithValueWrittenAs('value={null}')),
    buildValidCase('stays silent on a field under a form whose attributes include onChange among others', fieldsUnderAFormWithClassAndOnChange),
    ],
    invalid: [
      buildInvalidCase('reports an input with a value and no change handler', valueWithoutHandler, {
        filename: 'no-controlled-field-without-change-handler.tsx',
        errors: [{ messageId: 'frozen', line: 2 }],
      }),
      buildInvalidCase('reports a textarea and a select with a value and no change handler', textareaAndSelectWithoutHandler, {
        filename: 'no-controlled-field-without-change-handler.tsx',
        errors: [
          { messageId: 'frozen', line: 4, data: { element: 'textarea' } },
          { messageId: 'frozen', line: 5, data: { element: 'select' } },
        ],
      }),
      buildInvalidCase(
        'reports a field inside a label whose attributes include no change handler',
        fieldInsideLabelWithoutHandler,
        {
          filename: 'no-controlled-field-without-change-handler.tsx',
          errors: [{ messageId: 'frozen', line: 5, data: { element: 'input' } }],
        },
      ),
      buildInvalidCase(
        'reports an input whose name, not its type, is a value-is-not-content type such as image',
        fieldNamedLikeAnInputType,
        {
          filename: 'no-controlled-field-without-change-handler.tsx',
          errors: [{ messageId: 'frozen', line: 2, data: { element: 'input' } }],
        },
      ),
      buildInvalidCase(
        'reports an input whose type is a template with something interpolated, which it cannot read',
        inputWithValueTypedBy(interpolatedTemplateAttribute('type', 'kind')),
        {
          filename: 'no-controlled-field-without-change-handler.tsx',
          errors: [{ messageId: 'frozen', line: 2, data: { element: 'input' } }],
        },
      ),
      buildInvalidCase(
        'reports an input whose type is a template reading text, an editable type',
        inputWithValueTypedBy(templateAttribute('type', 'text')),
        {
          filename: 'no-controlled-field-without-change-handler.tsx',
          errors: [{ messageId: 'frozen', line: 2, data: { element: 'input' } }],
        },
      ),
      buildInvalidCase(
        'reports an input whose value is quoted text and that has no change handler',
        inputWithValueWrittenAs(quotedAttribute(VALUE, 'Hello')),
        {
          filename: 'no-controlled-field-without-change-handler.tsx',
          errors: [{ messageId: 'frozen', line: 2, data: { element: 'input' } }],
        },
      ),
      buildInvalidCase(
        'reports an input with a bare value attribute and no change handler',
        inputWithValueWrittenAs(VALUE),
        {
          filename: 'no-controlled-field-without-change-handler.tsx',
          errors: [{ messageId: 'frozen', line: 2, data: { element: 'input' } }],
        },
      ),
    buildInvalidCase(
      'reports an input whose value is a string in braces and that has no change handler',
      inputWithValueWrittenAs("value={'Hello'}"),
      {
        filename: 'no-controlled-field-without-change-handler.tsx',
        errors: [{ messageId: 'frozen', line: 2, data: { element: 'input' } }],
      },
    ),
    ],
  },
)

describe('no-controlled-field-without-change-handler messages, as a user reads them', () => {
  it('names the element and the ways out', () => {
    const messages = lintWithHouseRule('no-controlled-field-without-change-handler', [], inputWithValueWrittenAs('value="Hello"'), 'greeting.js')

    expect(messages.map(({ message }) => message)).toStrictEqual([
      '<input value={…}> has no onChange, so typing in it does nothing -- React resets the value on every render. Add onChange to drive the state, or use defaultValue if the field should be uncontrolled, or readOnly if it is display-only.',
    ])
  })
})
