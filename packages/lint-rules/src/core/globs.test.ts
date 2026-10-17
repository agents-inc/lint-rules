import { describe, expect, it } from 'vitest'
import { literalGlobOf, normalizeGlob, pathNamedBy } from './globs.ts'

describe('normalizeGlob', () => {
  it('lets a slash-free glob match at any depth', () => {
    expect(normalizeGlob('*.test.ts')).toBe('**/*.test.ts')
  })

  it('lets a slash-free glob with a brace list match at any depth', () => {
    expect(normalizeGlob('*.{ts,tsx}')).toBe('**/*.{ts,tsx}')
  })

  it('leaves a glob rooted at a directory as it is', () => {
    expect(normalizeGlob('src/*.ts')).toBe('src/*.ts')
  })

  it('leaves a glob that already matches at any depth as it is', () => {
    expect(normalizeGlob('**/x')).toBe('**/x')
  })

  it('lets a negated slash-free glob match at any depth, its ! kept in front', () => {
    expect(normalizeGlob('!*.gen.ts')).toBe('!**/*.gen.ts')
  })
})

// A path with glob syntax in it, as a Next.js route folder has.
const PATH_WITH_GLOB_SYNTAX = 'app/[locale]/page.tsx'

describe('pathNamedBy', () => {
  it('names the path a literal glob of it matches, its glob syntax included', () => {
    expect(pathNamedBy(literalGlobOf(PATH_WITH_GLOB_SYNTAX))).toBe(PATH_WITH_GLOB_SYNTAX)
  })

  it('names no path for a glob matching more than one', () => {
    expect(pathNamedBy('app/*/page.tsx')).toBeNull()
  })
})
