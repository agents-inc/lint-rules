import { describe, expect, it } from 'vitest'

import { LINTED_EXTENSIONS } from './cases/oxlint-rule-triggers.ts'
import { buildOxlintJsonReport, buildParseError, buildRuleFinding } from './factories/oxlint-report-factories.ts'
import { FILE_TYPES, fileTextHolding, fileTypesWrittenTheRuleRunsIn, outcomesOf } from './oxlint-trigger-runs.ts'

const TRIGGER = { code: 'debugger\n', unparsedIn: [] }

describe('outcomesOf', () => {
  it("gives each file given the rule's finding, a parse error or nothing, by the diagnostics oxlint reports in it", () => {
    const report = buildOxlintJsonReport([buildRuleFinding('a.ts'), buildParseError('b.js'), buildRuleFinding('b.js')], 3)

    expect(outcomesOf(report, ['a.ts', 'b.js', 'c.mjs'])).toStrictEqual(
      new Map([
        ['a.ts', 'reports'],
        ['b.js', 'cannot parse'],
        ['c.mjs', 'silent'],
      ]),
    )
  })

  it('throws on a diagnostic in a file it was not given, naming the file', () => {
    expect(() => outcomesOf(buildOxlintJsonReport([buildRuleFinding('stray.ts')]), ['a.ts'])).toThrow(/not given: stray\.ts/)
  })
})

describe('fileTextHolding', () => {
  it.each([
    { type: 'ts' as const, text: 'debugger\n' },
    { type: 'cjs' as const, text: 'debugger\n' },
    { type: 'd.css.ts' as const, text: 'debugger\n' },
    { type: 'vue' as const, text: '<script lang="ts">\ndebugger\n</script>\n' },
    { type: 'svelte' as const, text: '<script lang="ts">\ndebugger\n</script>\n' },
    { type: 'astro' as const, text: '---\ndebugger\n---\n' },
  ])('holds the code as a $type file holds it', ({ type, text }) => {
    expect(fileTextHolding(type, TRIGGER)).toBe(text)
  })

  it.each([
    { type: 'vue' as const, script: 'tsx' as const, text: '<script lang="tsx">\ndebugger\n</script>\n' },
    { type: 'svelte' as const, script: 'tsx' as const, text: '<script lang="tsx">\ndebugger\n</script>\n' },
    { type: 'vue' as const, script: 'setup' as const, text: '<script setup lang="ts">\ndebugger\n</script>\n' },
    { type: 'svelte' as const, script: 'setup' as const, text: '<script lang="ts">\ndebugger\n</script>\n' },
  ])('opens a $type file\'s script block as the trigger asks, $script', ({ type, script, text }) => {
    expect(fileTextHolding(type, { ...TRIGGER, script })).toBe(text)
  })
})

describe('fileTypesWrittenTheRuleRunsIn', () => {
  it('keeps each extension given, and each kind of declaration file whose extension is given', () => {
    expect(fileTypesWrittenTheRuleRunsIn({ extensions: ['js', 'ts', 'cts'], skipsDeclarationFiles: false })).toStrictEqual([
      'js',
      'ts',
      'cts',
      'd.ts',
      'd.cts',
      'd.css.ts',
    ])
  })

  it('keeps no declaration file for a rule that skips them', () => {
    expect(fileTypesWrittenTheRuleRunsIn({ extensions: ['js', 'ts', 'cts'], skipsDeclarationFiles: true })).toStrictEqual(['js', 'ts', 'cts'])
  })

  it('keeps every file type for a rule of every extension oxlint lints that skips no declaration file', () => {
    expect(fileTypesWrittenTheRuleRunsIn({ extensions: [...LINTED_EXTENSIONS], skipsDeclarationFiles: false })).toStrictEqual([...FILE_TYPES])
  })
})
