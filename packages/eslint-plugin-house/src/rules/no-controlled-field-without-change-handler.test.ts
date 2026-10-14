import {
  componentFieldUndefinedValueAndNoValue,
  defaultValueField,
  disabledFieldAndOnInputHandler,
  fieldsWithOnChange,
  fieldWithSpreadProps,
  formLevelOnChange,
  formLevelOnChangeAroundMappedFields,
  hiddenResetAndSubmitInputs,
  radioAndCheckboxValues,
  readOnlyField,
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
    ],
  },
)
