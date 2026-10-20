// What tsc prints to stdout where its output is no terminal (TypeScript 6.0.3, measured on a consumer's
// agents-inc.lint.mts), for the tests of the reader in tsc-errors.ts.

export const TSC_STDOUT_WITH_ONE_LINE_ERRORS = `agents-inc.lint.mts(9,34): error TS2353: Object literal may only specify known properties, and ''not-a/rule'' does not exist in type 'RuleSettings'.
agents-inc.lint.mts(10,52): error TS2322: Type '"nope"' is not assignable to type 'QualityRulesetName'.
`

export const TSC_STDOUT_WITH_CHAINED_ERRORS = `agents-inc.lint.mts(10,7): error TS2322: Type 'number[]' is not assignable to type 'readonly string[]'.
  Type 'number' is not assignable to type 'string'.
agents-inc.lint.mts(13,7): error TS2322: Type '[]' is not assignable to type '[number]'.
  Source has 0 element(s) but target requires 1.
`

export const TSC_STDOUT_OPENING_ON_A_CHAINED_LINE = `  Source has 0 element(s) but target requires 1.
`

export const TSC_STDOUT_WITH_AN_ERROR_OF_NO_FILE = `error TS18003: No inputs were found in config file 'tsconfig.json'.
`
