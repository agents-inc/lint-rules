import { describe, expect, it } from 'vitest'
import { hasEslintVersion, movedRules, twinnedMovedRules } from './eslint-versions.ts'

// The oracle the ESLint-fallback specs read: an answer it got wrong would hide a moved rule, or
// invent one.
describe('hasEslintVersion', () => {
  it.each([
    { id: 'eqeqeq', kind: 'an ESLint core rule' },
    { id: '@typescript-eslint/array-type', kind: 'a rule of a plugin we install, under a scoped prefix' },
    { id: 'unicorn/no-null', kind: 'a rule of a plugin we install' },
    { id: 'import-x/no-cycle', kind: 'a rule whose oxlint name has another prefix' },
    { id: 'jsx-a11y/alt-text', kind: 'a rule of eslint-plugin-jsx-a11y-x, which we install under jsx-a11y' },
    { id: 'vitest/expect-expect', kind: 'a rule of @vitest/eslint-plugin, which we install under vitest' },
    { id: 'react-hooks/rules-of-hooks', kind: 'a rule of eslint-plugin-react-hooks, which we install' },
    { id: 'react-perf/jsx-no-new-object-as-prop', kind: 'a rule of eslint-plugin-react-perf, which we install' },
  ])('answers yes for $id, $kind', ({ id }) => {
    expect(hasEslintVersion(id)).toBe(true)
  })

  it.each([
    { id: 'oxc/approx-constant', kind: 'a prefix only oxlint has' },
    { id: 'jsdoc/check-access', kind: 'a prefix whose ESLint plugin we do not install' },
    { id: 'react/no-clone-element', kind: 'a name only oxlint has, under a prefix we install' },
    { id: 'not-a-core-rule', kind: 'a core name ESLint does not have' },
  ])('answers no for $id, $kind', ({ id }) => {
    expect(hasEslintVersion(id)).toBe(false)
  })
})

describe('twinnedMovedRules', () => {
  it('pairs a moved core rule with the current typescript-eslint rule that extends it', () => {
    expect(twinnedMovedRules()).toContainEqual({ core: 'no-unused-vars', twin: '@typescript-eslint/no-unused-vars' })
  })

  it('pairs a moved core rule with a typed extension too', () => {
    expect(twinnedMovedRules()).toContainEqual({ core: 'prefer-destructuring', twin: '@typescript-eslint/prefer-destructuring' })
  })

  it('leaves out a moved core rule whose only typescript-eslint extension is deprecated in its favour', () => {
    const moved = movedRules().map(({ id }) => id)
    const twinned = twinnedMovedRules().map(({ core }) => core)

    expect({ moved: moved.includes('no-loop-func'), twinned: twinned.includes('no-loop-func') }).toStrictEqual({
      moved: true,
      twinned: false,
    })
  })

  it('leaves out a core rule with a current extension that is not moved, since ESLint runs it with or without oxlint', () => {
    const moved = movedRules().map(({ id }) => id)
    const twinned = twinnedMovedRules().map(({ core }) => core)

    expect({ moved: moved.includes('no-throw-literal'), twinned: twinned.includes('no-throw-literal') }).toStrictEqual({
      moved: false,
      twinned: false,
    })
  })
})
