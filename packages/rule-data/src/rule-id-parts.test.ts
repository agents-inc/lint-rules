import { describe, expect, it } from 'vitest'

import {
  canonicalIdOf,
  eslintAliasCandidatesOf,
  oxlintPluginOf,
  oxlintSpellingsOf,
  pluginPrefixOf,
} from './rule-id-parts.ts'

describe('pluginPrefixOf', () => {
  it('takes only the first segment of an unscoped ID, as ESLint does for n/prefer-global/buffer', () => {
    expect(pluginPrefixOf('n/prefer-global/buffer')).toBe('n')
  })

  it('keeps every segment but the last of a scoped ID, as ESLint does for @next/next/no-img-element', () => {
    expect(pluginPrefixOf('@next/next/no-img-element')).toBe('@next/next')
  })

  it('takes the npm scope of a scoped ID with one rule segment', () => {
    expect(pluginPrefixOf('@typescript-eslint/no-explicit-any')).toBe('@typescript-eslint')
  })

  it('answers null for a core rule, which has no plugin', () => {
    expect(pluginPrefixOf('no-debugger')).toBeNull()
  })
})

describe('canonicalIdOf', () => {
  it("maps oxlint's typescript scope to @typescript-eslint", () => {
    expect(canonicalIdOf('typescript/no-explicit-any')).toBe('@typescript-eslint/no-explicit-any')
  })

  it("maps oxlint's eslint scope to the bare core ID", () => {
    expect(canonicalIdOf('eslint/no-debugger')).toBe('no-debugger')
  })

  it('keeps a bare core name, the spelling oxlint prints, bare', () => {
    expect(canonicalIdOf('no-debugger')).toBe('no-debugger')
  })

  it('maps a hook rule oxlint files under react to react-hooks', () => {
    expect(canonicalIdOf('react/rules-of-hooks')).toBe('react-hooks/rules-of-hooks')
  })

  it('keeps an eslint-plugin-react rule under react, because the react-hooks move is per rule', () => {
    expect(canonicalIdOf('react/jsx-key')).toBe('react/jsx-key')
  })

  it('maps react/only-export-components to react-refresh', () => {
    expect(canonicalIdOf('react/only-export-components')).toBe('react-refresh/only-export-components')
  })

  it("maps oxlint's node scope to eslint-plugin-n's n", () => {
    expect(canonicalIdOf('node/no-exports-assign')).toBe('n/no-exports-assign')
  })

  it("maps oxlint's import scope to import-x", () => {
    expect(canonicalIdOf('import/no-cycle')).toBe('import-x/no-cycle')
  })

  it("maps oxlint's jsx_a11y scope to jsx-a11y", () => {
    expect(canonicalIdOf('jsx_a11y/alt-text')).toBe('jsx-a11y/alt-text')
  })

  it('keeps an oxc rule under oxc, which exists only in oxlint', () => {
    expect(canonicalIdOf('oxc/no-accumulating-spread')).toBe('oxc/no-accumulating-spread')
  })

  it('maps the two unicorn rules ESLint renamed to their current names', () => {
    expect([
      canonicalIdOf('unicorn/no-array-for-each'),
      canonicalIdOf('unicorn/prefer-dom-node-dataset'),
    ]).toStrictEqual(['unicorn/no-for-each', 'unicorn/dom-node-dataset'])
  })

  it('keeps unicorn/no-hex-escape, which unicorn replaced by two rules rather than renamed', () => {
    expect(canonicalIdOf('unicorn/no-hex-escape')).toBe('unicorn/no-hex-escape')
  })

  describe('a scope oxlint-scopes.json does not list', () => {
    it('throws, naming the scope', () => {
      expect(() => canonicalIdOf('svelte/valid-compile')).toThrow(/svelte/)
    })

    it('does not stop a listed scope from mapping', () => {
      expect(canonicalIdOf('promise/no-nesting')).toBe('promise/no-nesting')
    })
  })
})

describe('oxlintPluginOf', () => {
  it('names a core rule, which oxlint prints bare, under the eslint plugin', () => {
    expect(oxlintPluginOf('no-debugger')).toBe('eslint')
  })

  it("spells a plugin the way oxlint's plugins list does, which is not always the scope", () => {
    expect([
      oxlintPluginOf('jsx_a11y/alt-text'),
      oxlintPluginOf('react_perf/jsx-no-new-object-as-prop'),
    ]).toStrictEqual(['jsx-a11y', 'react-perf'])
  })

  it('keeps a hook rule under the react plugin, though its canonical ID moves to react-hooks', () => {
    expect(oxlintPluginOf('react/rules-of-hooks')).toBe('react')
  })

  it("names the plugin of a scope whose ESLint prefix differs, by oxlint's spelling", () => {
    expect([oxlintPluginOf('typescript/no-explicit-any'), oxlintPluginOf('node/no-exports-assign')]).toStrictEqual([
      'typescript',
      'node',
    ])
  })

  describe('a scope oxlint-scopes.json does not list', () => {
    it('throws, naming the scope', () => {
      expect(() => oxlintPluginOf('svelte/valid-compile')).toThrow(/svelte/)
    })

    it('does not stop a listed scope from answering', () => {
      expect(oxlintPluginOf('promise/no-nesting')).toBe('promise')
    })
  })
})

describe('eslintAliasCandidatesOf', () => {
  it('answers the same rule under every alias prefix of its scope, as import/ beside import-x/', () => {
    expect(eslintAliasCandidatesOf('import/no-cycle')).toStrictEqual(['import/no-cycle'])
  })

  it("answers a core rule's typescript-eslint extension, listed per rule", () => {
    expect(eslintAliasCandidatesOf('no-unused-vars')).toStrictEqual(['@typescript-eslint/no-unused-vars'])
  })

  it("answers a renamed rule's old ESLint name, listed per rule", () => {
    expect(eslintAliasCandidatesOf('unicorn/prefer-dom-node-dataset')).toStrictEqual([
      'unicorn/prefer-dom-node-dataset',
    ])
  })

  it('answers nothing for a rule with one ESLint spelling', () => {
    expect([
      eslintAliasCandidatesOf('no-debugger'),
      eslintAliasCandidatesOf('typescript/no-explicit-any'),
      eslintAliasCandidatesOf('react/rules-of-hooks'),
    ]).toStrictEqual([[], [], []])
  })

  describe('a scope oxlint-scopes.json does not list', () => {
    it('throws, naming the scope', () => {
      expect(() => eslintAliasCandidatesOf('svelte/valid-compile')).toThrow(/svelte/)
    })

    it('does not stop a listed scope from answering', () => {
      expect(eslintAliasCandidatesOf('import/no-duplicates')).toStrictEqual(['import/no-duplicates'])
    })
  })
})

// Each list is every key oxlint 1.87's config accepts for the rule, in ascending code-unit order:
// the scope's own name, its other names, and each name's npm package form.
describe('oxlintSpellingsOf', () => {
  describe('a core rule', () => {
    it('is spelled bare, under eslint/, and under its package form', () => {
      expect(oxlintSpellingsOf('no-debugger')).toStrictEqual([
        'eslint-plugin-eslint/no-debugger',
        'eslint/no-debugger',
        'no-debugger',
      ])
    })

    it("is also spelled under every typescript name when typescript-eslint extends it, as oxlint maps those to the core rule", () => {
      expect(oxlintSpellingsOf('no-unused-vars')).toStrictEqual([
        '@typescript-eslint/eslint-plugin/no-unused-vars',
        '@typescript-eslint/no-unused-vars',
        'eslint-plugin-eslint/no-unused-vars',
        'eslint-plugin-typescript-eslint/no-unused-vars',
        'eslint-plugin-typescript/no-unused-vars',
        'eslint/no-unused-vars',
        'no-unused-vars',
        'typescript-eslint/no-unused-vars',
        'typescript/no-unused-vars',
      ])
    })
  })

  it('spells a typescript rule under typescript/, @typescript-eslint/, typescript-eslint/ and their package forms', () => {
    expect(oxlintSpellingsOf('typescript/no-explicit-any')).toStrictEqual([
      '@typescript-eslint/eslint-plugin/no-explicit-any',
      '@typescript-eslint/no-explicit-any',
      'eslint-plugin-typescript-eslint/no-explicit-any',
      'eslint-plugin-typescript/no-explicit-any',
      'typescript-eslint/no-explicit-any',
      'typescript/no-explicit-any',
    ])
  })

  it('spells an import rule under import/ and import-x/', () => {
    expect(oxlintSpellingsOf('import/no-cycle')).toStrictEqual([
      'eslint-plugin-import-x/no-cycle',
      'eslint-plugin-import/no-cycle',
      'import-x/no-cycle',
      'import/no-cycle',
    ])
  })

  it('spells a jsx_a11y rule with the underscore and with the hyphen', () => {
    expect(oxlintSpellingsOf('jsx_a11y/alt-text')).toStrictEqual([
      'eslint-plugin-jsx-a11y/alt-text',
      'eslint-plugin-jsx_a11y/alt-text',
      'jsx-a11y/alt-text',
      'jsx_a11y/alt-text',
    ])
  })

  it('spells a react_perf rule with the underscore and with the hyphen', () => {
    expect(oxlintSpellingsOf('react_perf/jsx-no-new-object-as-prop')).toStrictEqual([
      'eslint-plugin-react-perf/jsx-no-new-object-as-prop',
      'eslint-plugin-react_perf/jsx-no-new-object-as-prop',
      'react-perf/jsx-no-new-object-as-prop',
      'react_perf/jsx-no-new-object-as-prop',
    ])
  })

  it('spells a nextjs rule under nextjs/, @next/next/ and @next/, with their package forms', () => {
    expect(oxlintSpellingsOf('nextjs/no-img-element')).toStrictEqual([
      '@next/eslint-plugin-next/no-img-element',
      '@next/eslint-plugin/no-img-element',
      '@next/next/no-img-element',
      '@next/no-img-element',
      'eslint-plugin-nextjs/no-img-element',
      'nextjs/no-img-element',
    ])
  })

  it('spells an oxc rule under oxc/ and deepscan/', () => {
    expect(oxlintSpellingsOf('oxc/no-accumulating-spread')).toStrictEqual([
      'deepscan/no-accumulating-spread',
      'eslint-plugin-deepscan/no-accumulating-spread',
      'eslint-plugin-oxc/no-accumulating-spread',
      'oxc/no-accumulating-spread',
    ])
  })

  describe('a react rule', () => {
    it('is spelled under react/ and react-hooks/, for a hook rule', () => {
      expect(oxlintSpellingsOf('react/rules-of-hooks')).toStrictEqual([
        'eslint-plugin-react-hooks/rules-of-hooks',
        'eslint-plugin-react/rules-of-hooks',
        'react-hooks/rules-of-hooks',
        'react/rules-of-hooks',
      ])
    })

    it('is spelled under react-hooks/ too when it is no hook rule, because oxlint maps the whole prefix', () => {
      expect(oxlintSpellingsOf('react/jsx-key')).toStrictEqual([
        'eslint-plugin-react-hooks/jsx-key',
        'eslint-plugin-react/jsx-key',
        'react-hooks/jsx-key',
        'react/jsx-key',
      ])
    })

    it("is not spelled under react-refresh/, which oxlint refuses, though it is only-export-components' RuleId prefix", () => {
      expect(oxlintSpellingsOf('react/only-export-components')).toStrictEqual([
        'eslint-plugin-react-hooks/only-export-components',
        'eslint-plugin-react/only-export-components',
        'react-hooks/only-export-components',
        'react/only-export-components',
      ])
    })
  })

  describe('a node rule', () => {
    it('is spelled under node/ and its package form', () => {
      expect(oxlintSpellingsOf('node/no-exports-assign')).toStrictEqual([
        'eslint-plugin-node/no-exports-assign',
        'node/no-exports-assign',
      ])
    })

    it("is not spelled under n/, eslint-plugin-n's prefix, which oxlint refuses", () => {
      expect(oxlintSpellingsOf('node/no-exports-assign')).not.toContain('n/no-exports-assign')
    })
  })

  describe('a vitest rule', () => {
    it('is spelled under vitest/ and its package form', () => {
      expect(oxlintSpellingsOf('vitest/no-focused-tests')).toStrictEqual([
        'eslint-plugin-vitest/no-focused-tests',
        'vitest/no-focused-tests',
      ])
    })

    it("is not spelled under @vitest/, @vitest/eslint-plugin's prefix, which oxlint refuses", () => {
      expect(oxlintSpellingsOf('vitest/no-focused-tests')).not.toContain('@vitest/no-focused-tests')
    })
  })

  describe('a rule oxlint knows under an old name', () => {
    it("is spelled under oxlint's name only", () => {
      expect(oxlintSpellingsOf('unicorn/no-array-for-each')).toStrictEqual([
        'eslint-plugin-unicorn/no-array-for-each',
        'unicorn/no-array-for-each',
      ])
    })

    it('is not spelled under its RuleId, which oxlint refuses', () => {
      expect(oxlintSpellingsOf('unicorn/no-array-for-each')).not.toContain('unicorn/no-for-each')
    })
  })

  it('spells a rule of a scope with one name under that name and its package form', () => {
    expect(oxlintSpellingsOf('promise/no-nesting')).toStrictEqual(['eslint-plugin-promise/no-nesting', 'promise/no-nesting'])
  })

  describe('a scope oxlint-scopes.json does not list', () => {
    it('throws, naming the scope', () => {
      expect(() => oxlintSpellingsOf('svelte/valid-compile')).toThrow(/svelte/)
    })

    it('does not stop a listed scope from answering', () => {
      expect(oxlintSpellingsOf('jest/no-focused-tests')).toStrictEqual([
        'eslint-plugin-jest/no-focused-tests',
        'jest/no-focused-tests',
      ])
    })
  })
})
