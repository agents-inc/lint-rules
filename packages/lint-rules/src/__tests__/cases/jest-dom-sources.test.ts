import { describe, expect, it } from 'vitest'
import { LINES_OF_THE_FINDINGS, TESTS_A_JEST_DOM_FIX_BREAKS } from './jest-dom-sources.ts'

describe('the tests a jest-dom fix breaks, which check-withheld-jest-dom-fixes runs', () => {
  it("are each read once from rule-data's reported jest-dom case of its path, in path order", () => {
    expect(TESTS_A_JEST_DOM_FIX_BREAKS.map(({ file }) => file)).toStrictEqual(LINES_OF_THE_FINDINGS.map(({ file }) => file))
  })
})
