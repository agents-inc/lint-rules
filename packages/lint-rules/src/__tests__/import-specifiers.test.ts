import { describe, expect, it } from 'vitest'
import { relativeImportSpecifiersIn } from './import-specifiers.ts'

const SOURCE = `import a from './a'
import './side-effect'
import fs from 'node:fs'
import { b } from '../b.js'
export { c } from './c'
export * from '../d'
export const e = [a, b, fs]
`

describe('relativeImportSpecifiersIn', () => {
  it('gives each relative specifier an import or a re-export names, in order, and no package', () => {
    expect(relativeImportSpecifiersIn(SOURCE, 'src/a.ts')).toStrictEqual(['./a', './side-effect', '../b.js', './c', '../d'])
  })

  it('gives none where the source imports packages alone', () => {
    expect(relativeImportSpecifiersIn("import fs from 'node:fs'\nexport const v = fs\n", 'src/a.ts')).toStrictEqual([])
  })
})
