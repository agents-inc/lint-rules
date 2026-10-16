import {
  componentFieldUndefinedValueAndNoValue,
  defaultValueField,
  disabledFieldAndOnInputHandler,
  fieldInsideLabelWithoutHandler,
  fieldNamedLikeAnInputType,
  fieldsWithOnChange,
  fieldWithSpreadProps,
  formLevelOnChange,
  formLevelOnChangeAroundMappedFields,
  hiddenResetAndSubmitInputs,
  radioAndCheckboxValues,
  readOnlyField,
  textareaAndSelectWithoutHandler,
  valueWithoutHandler,
} from '../__tests__/cases/no-controlled-field-without-change-handler.ts'
import { buildInvalidCase, buildValidCase } from '../__tests__/factories/rule-case-factories.ts'
import { houseRuleTester } from '../__tests__/house-rule-tester.ts'
import { housePlugin } from '../index.ts'

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
    ],
  },
)
