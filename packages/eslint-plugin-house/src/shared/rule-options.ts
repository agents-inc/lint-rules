import type { JSONSchema } from '@typescript-eslint/utils'

/**
 * An option the schema leaves optional and meta.defaultOptions fills. ESLint applies the default
 * whenever a config omits the key, so undefined here means the rule ran without that step.
 */
export function defaultedOption<Value>(ruleName: string, value: Value | undefined): Value {
  if (value === undefined) throw new Error(`${ruleName} ran without meta.defaultOptions applied to its options`)
  return value
}

/** An options object with one optional key, a list of strings, and nothing else: `{ hooks: ['useEffect'] }`. */
export function stringListOptionSchema(key: string): JSONSchema.JSONSchema4ObjectSchema {
  return {
    type: 'object',
    properties: { [key]: { type: 'array', items: { type: 'string' } } },
    additionalProperties: false,
  }
}
