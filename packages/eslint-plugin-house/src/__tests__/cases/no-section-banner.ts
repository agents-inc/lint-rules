export const bannerAndLabelBlock = `// ============================================================
// Helpers
// ============================================================
export const total = 1`

export const labelLeftAfterFirstPass = `// Helpers
export const total = 1`

export const totalDeclaration = `export const total = 1`

export const explanatoryComment = `// Totals include tax because the API returns gross amounts.
export const total = 1
`

export const labelTrailingCode = `export const x = 1 // helpers
export const y = 2
`

export const blockBannerTrailingCode = `export const x = 1 /* ---- */
export const y = 2
`

export const multiLineBlockBannerBetweenStatements = `export const x = 1 /* ----
---- */ export const y = 2
`

export const multiLineBlockBannerEndingItsLine = `export const x = 1 /* ----
---- */
export const y = 2
`

// The comment's line break ends the return, so the 1 is unreachable; joining the lines would return it.
export const multiLineBlockBannerAfterReturn = `export function verify() {
  return /* ----
   ---- */ 1
}
`

export const bareReturnAboveUnreachableValue = `export function verify() {
  return
  1
}
`

export const bannerAloneOnItsLine = `export const x = 1
// ----
export const y = 2
`

export const declarationsWithoutComment = `export const x = 1
export const y = 2
`

export const titledDashBanner = `export const x = 1
// ---------- helpers ----------
export const y = 2
`

export const titledEqualsBanner = `export const x = 1
// ===== Section =====
export const y = 2
`

export const titledAsteriskBanner = `export const x = 1
// *** Date Math ***
export const y = 2
`

export const titledBlockBanner = `export const x = 1
/* --- Setup --- */
export const y = 2
`

export const unevenTitledBanner = `export const x = 1
// --- registry ---------------------------------------------------------------
export const y = 2
`

export const titledBannerFramingASentence = `export const x = 1
// --- Check 3: re-open edit and the dual-scope badges render. ---
export const y = 2
`

export const indentedTitledBanner = `export function verify() {
  // --- Phase 1 verification ---
  return 1
}
`

export const functionWithoutComment = `export function verify() {
  return 1
}
`

export const titledBannerTrailingCode = `export const x = 1 // === Abstract Operations ===
export const y = 2
`

export const titledBlockBannerTrailingCode = `export const x = 1 /* --- Setup --- */
export const y = 2
`

export const dashNote = `// -- note
export const x = 1
`

export const spacedHyphens = `// a - b - c
export const x = 1
`

export const todoWithDashes = `// TODO --- later
export const x = 1
`

export const twoCharacterFrame = `// -- XY Charts --
export const x = 1
`

export const cliFlagComments = `// Run \`eslint --fix\` to apply the change.
// bun run test -- --watch
export const x = 1
`

export const lintDirectiveReason = `// eslint-disable-next-line no-console -- the CLI prints its report
console.log(1)
`

export const paragraphBetweenRuns = `// --- Surface 2: what the user saw. The stack is named on screen, so the
// config assertions below are about the stack the run said it installed. ---
export const x = 1
`

export const comparisonInProse = `// Even if merged === existing, existing may have come from a lower layer.
export const x = 1
`

export const docBlockWithTitledHeading = `/**
 * Manual checks for playback.
 *
 * === Transition playback ===
 *
 * Play through the transition and check that no frame takes longer than 16ms.
 */
export const x = 1
`

export const docBlockWithMarkdownHeading = `/**
 * ## Usage
 *
 * Call it once per render.
 */
export const x = 1
`

export const markdownTableComments = `// | Flag  | Effect        |
// | ----- | ------------- |
// | --fix | applies fixes |
export const x = 1
`

export const titledBannerWithShortLeadingRun = `export const x = 1
// -- Module shape ------------------------------------------------------------
export const y = 2
`

export const blockBannerJoiningAKeywordToAName = `export const kind = typeof/*----*/globalThis
`

export const blockBannerAfterASpacedKeyword = `export const kind = typeof /*----*/globalThis
`

export const keywordSpacedFromAName = `export const kind = typeof globalThis
`

// Joined, the two operators read as one `++`, which does not parse here.
export const blockBannerJoiningTwoPluses = `export const sum = 1 +/*----*/+'2'
`

export const plusSpacedFromAUnaryPlus = `export const sum = 1 + +'2'
`

export const blockBannerInsideEmptyParentheses = `export const empty = String(/*----*/)
`

export const emptyCall = `export const empty = String()
`

export const blockBannerJoiningTwoMinuses = `export const difference = 1 -/*----*/-1
`

export const minusSpacedFromAUnaryMinus = `export const difference = 1 - -1
`

// Joined, the division and the regular expression read as a \`//\` comment running to the end of the line.
export const blockBannerBetweenADivisionAndARegularExpression = `export const ratio = 1 / /*----*//a/.lastIndex
`

export const divisionSpacedFromARegularExpression = `export const ratio = 1 / /a/.lastIndex
`

// Joined, the name reads as the regular expression's flags.
export const blockBannerJoiningARegularExpressionToAName = `export const isRegExp = /a//*----*/instanceof RegExp
`

export const regularExpressionSpacedFromAName = `export const isRegExp = /a/ instanceof RegExp
`

// Joined, the dot reads as the number's decimal point.
export const blockBannerJoiningANumberToAMemberAccess = `export const fixed = 1/*----*/.toFixed(2)
`

export const numberSpacedFromAMemberAccess = `export const fixed = 1 .toFixed(2)
`

export const blockBannerJoiningAKeywordToADollarName = `export const kind = typeof/*----*/$ref
`

export const keywordSpacedFromADollarName = `export const kind = typeof $ref
`

export const blockBannerJoiningAKeywordToAnEscapedName = `export const kind = typeof/*----*/\\u0067lobalThis
`

export const keywordSpacedFromAnEscapedName = `export const kind = typeof \\u0067lobalThis
`

// `𝑎` and `𠮷` lie outside Unicode's basic plane, so JavaScript holds each as two UTF-16 units.
export const blockBannerJoiningAKeywordToANameOutsideTheBasicPlane = `export const kind = typeof/*----*/𝑎
`

export const keywordSpacedFromANameOutsideTheBasicPlane = `export const kind = typeof 𝑎
`

export const blockBannerJoiningANameOutsideTheBasicPlaneToAKeyword = `const 𠮷 = 'kind'
export const has = 𠮷/*----*/in globalThis
`

export const nameOutsideTheBasicPlaneSpacedFromAKeyword = `const 𠮷 = 'kind'
export const has = 𠮷 in globalThis
`

// Joined, the non-null assertion and the assignment read as \`!=\`, a comparison.
export const blockBannerJoiningANonNullAssertionToAnAssignment = `export let count: number | undefined
count!/*----*/= 1
`

export const nonNullAssertionSpacedFromAnAssignment = `export let count: number | undefined
count! = 1
`

// Joined, the comparison and the type assertion read as a \`<<\` shift.
export const blockBannerJoiningAComparisonToATypeAssertion = `export const less = 1 < /*----*/<number>2
`

export const comparisonSpacedFromATypeAssertion = `export const less = 1 < <number>2
`

// Joined, either way, the comparison, negation and decrement read as \`<!--\`, which opens a comment in CommonJS.
export const blockBannerJoiningAComparisonToANegation = `export const c = a </*----*/!--b
`

export const comparisonSpacedFromANegation = `export const c = a < !--b
`

export const blockBannerJoiningANegationToADecrement = `export const c = a <!/*----*/--b
`

export const negationSpacedFromADecrement = `export const c = a <! --b
`

export const blockBannerBetweenAParenthesisAndAName = `export const name = String(/*----*/globalThis)
`

export const callOnAName = `export const name = String(globalThis)
`

export const blockBannerBeforeAMemberAccess = `export const name = globalThis/*----*/.name
`

export const memberAccessOnAName = `export const name = globalThis.name
`

export const blockBannerBetweenANumberAndAParenthesis = `export const one = String(1/*----*/)
`

export const callOnANumber = `export const one = String(1)
`

export const blockLabel = `export const x = 1
/*
 Helpers
*/
export const y = 2
`

export const blockCommentListingTwoLabels = `export const x = 1
/*
 Helpers
 Utils
*/
export const y = 2
`

export const titledLineAmongBlankLines = `export const x = 1
/*

 --- Setup ---
*/
export const y = 2
`
