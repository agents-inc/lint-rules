import { describe, expect, it } from 'vitest'
import {
  LISTS_WITH_AN_EMPTY_FLAT_LIST,
  LISTS_WITH_OPT_IN_RULESETS,
  LISTS_WITH_SORTING_RULESETS,
  TEXT_WITH_AN_EMPTY_FLAT_LIST,
  TEXT_WITH_OPT_IN_RULESETS,
  TEXT_WITH_SORTING_RULESETS,
} from '../cases/init-config-texts.ts'
import { initConfigTextListing, packageJsonTextIn } from './init-factories.ts'

// The factories that lay out init's text and a package.json are test data themselves: each is
// checked here against text written out by hand, or against JSON.stringify.

const A_PACKAGE_JSON = { name: 'consumer-project', private: true, devDependencies: { eslint: '^10.0.0' }, engines: {} }

describe('initConfigTextListing', () => {
  it.each([
    { lists: LISTS_WITH_OPT_IN_RULESETS, text: TEXT_WITH_OPT_IN_RULESETS, kind: 'opt-in comments and an all-opt-in domain' },
    { lists: LISTS_WITH_AN_EMPTY_FLAT_LIST, text: TEXT_WITH_AN_EMPTY_FLAT_LIST, kind: 'an empty flat list and no libs' },
    { lists: LISTS_WITH_SORTING_RULESETS, text: TEXT_WITH_SORTING_RULESETS, kind: 'the formatter warning on opt-in rulesets that sort code' },
  ])('lays out the text written by hand for $kind', ({ lists, text }) => {
    expect(initConfigTextListing(lists)).toBe(text)
  })
})

describe('packageJsonTextIn', () => {
  it.each([
    { indent: '  ', stringifyIndent: 2 },
    { indent: '    ', stringifyIndent: 4 },
    { indent: '\t', stringifyIndent: '\t' },
  ])('lays out JSON as JSON.stringify does with an indent of $stringifyIndent, an empty object as {}', ({ indent, stringifyIndent }) => {
    expect(packageJsonTextIn(A_PACKAGE_JSON, { indent, eol: '\n', finalNewline: true })).toBe(
      `${JSON.stringify(A_PACKAGE_JSON, null, stringifyIndent)}\n`,
    )
  })

  it('ends each line with CRLF where the layout says so, and leaves the final newline out where it says so', () => {
    expect(packageJsonTextIn(A_PACKAGE_JSON, { indent: '  ', eol: '\r\n', finalNewline: false })).toBe(
      JSON.stringify(A_PACKAGE_JSON, null, 2).replaceAll('\n', '\r\n'),
    )
  })

  it('writes a value written as is unchanged, an array on one line included', () => {
    expect(packageJsonTextIn({ keywords: { writtenAsIs: '["lint", "agents"]' } }, { indent: '  ', eol: '\n', finalNewline: false })).toBe(
      '{\n  "keywords": ["lint", "agents"]\n}',
    )
  })
})
