// ESLint suppressions. In a line comment ESLint reads only -disable-line and -disable-next-line,
// but oxlint reads `// eslint-disable` as a file-level disable (measured, oxlint 1.87).

export const fileLevelDisable = `/* eslint-disable */
debugger
`

export const disableNamingRules = `/* eslint-disable no-debugger, eqeqeq */
debugger
`

export const lineCommentDisable = `// eslint-disable
debugger
`

export const nextLineDisable = `// eslint-disable-next-line no-debugger
debugger
`

export const blockNextLineDisable = `/* eslint-disable-next-line no-debugger */
debugger
`

export const bareNextLineDisable = `// eslint-disable-next-line
debugger
`

export const sameLineDisable = `debugger // eslint-disable-line no-debugger
`

export const blockSameLineDisable = `debugger /* eslint-disable-line no-debugger */
`

export const disableThenEnable = `/* eslint-disable no-debugger */
debugger
/* eslint-enable no-debugger */
`

export const lineCommentEnable = `debugger
// eslint-enable no-debugger
`

export const inlineRuleConfig = `/* eslint no-debugger: off */
debugger
`

export const disableWithReason = `// eslint-disable-next-line no-debugger -- the debugger is intended
debugger
`

export const unspacedLineDisable = `//eslint-disable-next-line no-debugger
debugger
`

export const unspacedBlockDisable = `/*eslint-disable*/
debugger
`

export const multiLineBlockDisable = `/*
  eslint-disable
*/
debugger
`

export const disableOfTheBan = `/* eslint-disable house/no-suppressions */
debugger
`

export const inlineConfigOfTheBan = `/* eslint house/no-suppressions: off */
debugger
`

export const disableInJsx = `export const panel = (
  <div>
    {/* eslint-disable-next-line react/no-danger */}
    <span />
  </div>
)
`

// oxlint suppressions, which ESLint never reads.

export const oxlintFileLevelDisable = `/* oxlint-disable */
debugger
`

export const oxlintLineCommentDisable = `// oxlint-disable
debugger
`

export const oxlintNextLineDisable = `// oxlint-disable-next-line no-debugger
debugger
`

export const oxlintBlockNextLineDisable = `/* oxlint-disable-next-line no-debugger */
debugger
`

export const oxlintSameLineDisable = `debugger // oxlint-disable-line no-debugger
`

export const oxlintDisableThenEnable = `/* oxlint-disable no-debugger */
debugger
/* oxlint-enable no-debugger */
`

// Comments that are not suppressions in either engine.

export const proseNamingADirective = `// the gate bans eslint-disable comments
export const total = 1
`

export const noteQuotingADirective = `// note: eslint-disable is banned here
export const total = 1
`

export const disabledAsAWord = `// eslint-disabled until the API lands
export const total = 1
`

export const oxlintDisabledAsAWord = `// oxlint-disabled until the API lands
export const total = 1
`

export const pluginPackageName = `// eslint-plugin-unicorn provides this rule
export const total = 1
`

// Neither engine reads a line comment as rule config: this is prose about ESLint.
export const proseAboutEslint = `// eslint runs after oxlint
export const total = 1
`

export const jsdocNamingADirective = `/** Explains why eslint-disable comments are banned. */
export const total = 1
`

export const jsdocShapedLikeADirective = `/** eslint-disable */
debugger
`

export const eslintEnvComment = `/* eslint-env browser */
window.alert('saved')
`

export const globalComment = `/* global analytics */
analytics.track('saved')
`

export const exportedComment = `/* exported total */
var total = 1
`

export const typeScriptDirective = `// @ts-expect-error the total is a string here
export const total = 1
`

export const directiveInAString = `export const directive = '/* eslint-disable */'
`
