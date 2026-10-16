import { describe, expect, it } from 'vitest'

import { parseEngine, parseOxlintCategory, parseRulesetList } from './parse-names.ts'

describe('parseEngine', () => {
  it('takes each engine as itself', () => {
    expect(['oxlint', 'eslint'].map(parseEngine)).toStrictEqual(['oxlint', 'eslint'])
  })

  it('refuses any other name, quoting it and naming both engines', () => {
    expect(() => parseEngine('biome')).toThrow(new Error('"biome" is not an engine (oxlint or eslint)'))
  })
})

describe('parseRulesetList', () => {
  it('takes each ruleset list as itself', () => {
    expect(['quality', 'libs', 'runtimes', 'languages'].map(parseRulesetList)).toStrictEqual(['quality', 'libs', 'runtimes', 'languages'])
  })

  it('refuses any other name, quoting it and naming every list', () => {
    expect(() => parseRulesetList('extras')).toThrow(new Error('"extras" is not a ruleset list (quality, libs, runtimes, languages)'))
  })
})

describe('parseOxlintCategory', () => {
  it('takes each oxlint category as itself', () => {
    const categories = ['correctness', 'nursery', 'pedantic', 'perf', 'restriction', 'style', 'suspicious']

    expect(categories.map(parseOxlintCategory)).toStrictEqual(categories)
  })

  it('refuses any other name, quoting it and naming every category', () => {
    expect(() => parseOxlintCategory('fixes')).toThrow(
      new Error('"fixes" is not an oxlint category (correctness, nursery, pedantic, perf, restriction, style, suspicious)'),
    )
  })
})
