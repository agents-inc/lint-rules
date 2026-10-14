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

// The comment's line break ends the return statement, so the function returns undefined and the 1
// below is unreachable. Joining the lines would make it return 1.
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
