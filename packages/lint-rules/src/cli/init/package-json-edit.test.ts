import { describe, expect, it } from 'vitest'
import { DEV_DEPENDENCIES_AS_AN_ARRAY, PACKAGE_JSON_TEXT_EDITS } from '../../__tests__/cases/init-package-json-edits.ts'
import { PACKAGE_JSON_FILE } from '../../__tests__/factories/check-factories.ts'
import { OUR_PACKAGE, OUR_RANGE } from '../../__tests__/factories/init-factories.ts'
import { withDevDependency } from './package-json-edit.ts'

// q-i4 (spec-cli.md "The package.json edit"): the edit scans the text JSON.parse accepted to find
// where the entry goes, and writes it there, keeping every other byte. init.integration.test.ts runs
// its layouts through the bin; these are texts the scanner must read past, and one it refuses.

describe('the package.json edit init makes', () => {
  it.each(PACKAGE_JSON_TEXT_EDITS)('adds the entry where it sorts, every other byte kept: $kind', ({ before, after }) => {
    expect(withDevDependency(before, PACKAGE_JSON_FILE, OUR_PACKAGE, OUR_RANGE)).toBe(after)
  })

  it('refuses a devDependencies that is an array, naming the file', () => {
    expect(() => withDevDependency(DEV_DEPENDENCIES_AS_AN_ARRAY, PACKAGE_JSON_FILE, OUR_PACKAGE, OUR_RANGE)).toThrowError(
      `${PACKAGE_JSON_FILE}: devDependencies is not a JSON object`,
    )
  })
})
