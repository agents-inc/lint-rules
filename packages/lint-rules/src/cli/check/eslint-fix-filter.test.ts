import { describe, expect, it } from 'vitest'
import { buildLintMessage, buildLintWarning, buildWithheldFixes, linesChanged, wholeFileChanged } from '../../__tests__/factories/check-factories.ts'
import { eslintFixFilter } from './eslint-fix-filter.ts'

const A_FIXABLE_RULE = 'object-shorthand'
const A_WITHHELD_RULE = 'perfectionist/sort-arrays'
const NONE_WITHHELD = buildWithheldFixes()

describe("the filter on ESLint's fixes", () => {
  it('applies a fix reported on a changed line, and not one reported on an unchanged line', () => {
    const filter = eslintFixFilter(linesChanged(3, 5), NONE_WITHHELD)

    expect([3, 4, 5].map((line) => filter(buildLintMessage({ ruleId: A_FIXABLE_RULE, line })))).toStrictEqual([true, false, true])
  })

  it('applies a fix on any line of a wholly changed file', () => {
    const filter = eslintFixFilter(wholeFileChanged(), NONE_WITHHELD)

    expect([1, 40].map((line) => filter(buildLintMessage({ ruleId: A_FIXABLE_RULE, line })))).toStrictEqual([true, true])
  })

  it("never applies a withheld rule's fix, even in a wholly changed file", () => {
    expect(eslintFixFilter(wholeFileChanged(), buildWithheldFixes(A_WITHHELD_RULE))(buildLintMessage({ ruleId: A_WITHHELD_RULE, line: 1 }))).toBe(
      false,
    )
  })

  it("applies the same rule's fix where the withheld fixes do not list it", () => {
    expect(eslintFixFilter(wholeFileChanged(), NONE_WITHHELD)(buildLintMessage({ ruleId: A_WITHHELD_RULE, line: 1 }))).toBe(true)
  })

  it("never applies a fix of ESLint's own, which names no rule, such as removing an unused suppression, beside a rule's fix it applies", () => {
    const filter = eslintFixFilter(wholeFileChanged(), NONE_WITHHELD)

    expect([null, A_FIXABLE_RULE].map((ruleId) => filter(buildLintMessage({ ruleId, line: 1 })))).toStrictEqual([false, true])
  })

  // A team that sets a rule to warn has it listed, not fixed: check fixes errors alone.
  it("never applies a warning's fix, even in a wholly changed file, beside the same rule's fix at error, which it applies", () => {
    const filter = eslintFixFilter(wholeFileChanged(), NONE_WITHHELD)

    expect([buildLintWarning({ ruleId: A_FIXABLE_RULE, line: 1 }), buildLintMessage({ ruleId: A_FIXABLE_RULE, line: 1 })].map(filter)).toStrictEqual([false, true])
  })

  it("applies another rule's fix beside a withheld one", () => {
    expect(
      eslintFixFilter(wholeFileChanged(), buildWithheldFixes(A_WITHHELD_RULE))(buildLintMessage({ ruleId: A_FIXABLE_RULE, line: 1 })),
    ).toBe(true)
  })
})
