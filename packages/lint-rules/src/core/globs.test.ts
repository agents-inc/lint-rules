import { describe, expect, it } from 'vitest'
import { normalizeGlob } from './globs.ts'

// oxlint matches a slash-free glob at any depth and ESLint only at the root, so the package
// writes every such glob in the form both engines read the same way.
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
})
