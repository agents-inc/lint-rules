// Source that names rule IDs in strings and comments, for the scan in names-no-rule.test.ts.

export const namesARuleInEachKindOfString = `const single = 'house/no-suppressions'
const double = "eqeqeq"
const template = \`no-debugger\`
const notARule = 'agents-inc/base'
`

export const namesRulesOnlyInComments = `// house/no-suppressions is the ban, and 'eqeqeq' is quoted here
/** \`no-debugger\` in a doc comment */
export const blockName = 'agents-inc/base'
`
