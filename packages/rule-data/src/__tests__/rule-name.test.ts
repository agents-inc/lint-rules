import { describe, expect, it } from 'vitest'

import { ruleNameOf } from './rule-name.ts'

describe('ruleNameOf', () => {
  it('keeps a core rule ID whole, as it has no prefix', () => {
    expect(ruleNameOf('no-debugger')).toBe('no-debugger')
  })

  it("drops an unscoped prefix and keeps the rest, slashes included", () => {
    expect([ruleNameOf('unicorn/no-for-each'), ruleNameOf('n/prefer-global/buffer')]).toStrictEqual([
      'no-for-each',
      'prefer-global/buffer',
    ])
  })

  it('drops a scoped prefix whole', () => {
    expect([ruleNameOf('@typescript-eslint/no-explicit-any'), ruleNameOf('@next/next/no-img-element')]).toStrictEqual([
      'no-explicit-any',
      'no-img-element',
    ])
  })

  it("drops an oxlint scope, written with an underscore", () => {
    expect(ruleNameOf('jsx_a11y/alt-text')).toBe('alt-text')
  })
})
