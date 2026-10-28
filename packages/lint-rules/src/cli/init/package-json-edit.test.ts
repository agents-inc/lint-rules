import { describe, expect, it } from 'vitest'
import { DEV_DEPENDENCIES_AS_AN_ARRAY, PACKAGE_JSON_EDITS, PACKAGE_JSON_TEXT_EDITS } from '../../__tests__/cases/init-package-json-edits.ts'
import { PACKAGE_JSON_FILE } from '../../__tests__/factories/check-factories.ts'
import { OUR_PACKAGE, OUR_RANGE, packageJsonTextIn } from '../../__tests__/factories/init-factories.ts'
import { withDevDependency } from './package-json-edit.ts'

describe('the package.json edit init makes', () => {
  it.each(PACKAGE_JSON_TEXT_EDITS)('adds the entry where it sorts, every other byte kept: $kind', ({ before, after }) => {
    expect(withDevDependency(before, PACKAGE_JSON_FILE, OUR_PACKAGE, OUR_RANGE)).toBe(after)
  })

  it.each(PACKAGE_JSON_EDITS)('adds the entry where it sorts, in the layout of the file: $kind', ({ layout, before, after }) => {
    expect(withDevDependency(packageJsonTextIn(before, layout), PACKAGE_JSON_FILE, OUR_PACKAGE, OUR_RANGE)).toBe(packageJsonTextIn(after, layout))
  })

  it('refuses a devDependencies that is an array, naming the file', () => {
    expect(() => withDevDependency(DEV_DEPENDENCIES_AS_AN_ARRAY, PACKAGE_JSON_FILE, OUR_PACKAGE, OUR_RANGE)).toThrow(
      `${PACKAGE_JSON_FILE}: devDependencies is not a JSON object`,
    )
  })
})
