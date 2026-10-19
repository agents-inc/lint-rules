import { beforeAll, describe, expect, it } from 'vitest'

import type { RuleRoute } from '../catalog.ts'
import { buildEslintRoute, buildOxlintRoute } from './factories/inventory-factories.ts'
import { buildShippedRule, buildShippedRuleDecidedBySuppressions } from './factories/shipped-rule-factories.ts'
import { type CaseFile, UNSHIPPED_RULE_SETTINGS, eslintBlocksOf, eslintOutcomesOf, oxlintOutcomesOf, shippedSettingsOf, writeCaseFiles } from './rule-case-runs.ts'
import { setUpTempDir } from './temp-dirs.ts'

const ENGINES_TIMEOUT_MS = 60_000
const SKIPPED = 'skipped/**'
const DEBUGGER_FILE: CaseFile = { path: 'src/debugger.js', source: 'debugger\n' }
const QUIET_FILE: CaseFile = { path: 'src/quiet.js', source: 'export const value = 1\n' }
const UNPARSABLE_FILE: CaseFile = { path: 'src/unparsable.js', source: 'export const = 1\n' }
const SKIPPED_FILE: CaseFile = { path: 'skipped/debugger.js', source: 'debugger\n' }
const EXTENSION = '@typescript-eslint/no-unused-vars'

const noDebuggerInOxlint = buildOxlintRoute('no-debugger', {
  oxlintName: 'no-debugger',
  oxlintPlugin: 'eslint',
  eslintAliases: [],
  oxlintSpellings: ['no-debugger'],
  shipped: buildShippedRule('correctness', { ignores: [SKIPPED] }),
})

function oxlintCoreRule(id: string): RuleRoute {
  return buildOxlintRoute(id, { oxlintName: id, oxlintPlugin: 'eslint', eslintAliases: [], oxlintSpellings: [id], shipped: buildShippedRule('redundancy') })
}

function eslintRule(id: string): RuleRoute {
  return buildEslintRoute(id, { typed: false, oxlintSpellings: [], shipped: null })
}

describe('shippedSettingsOf', () => {
  it("gives a shipped rule's options, files and ignores", () => {
    const route = buildEslintRoute('max-lines', { typed: false, oxlintSpellings: [], shipped: buildShippedRule('complexity', { options: [{ max: 200 }], files: ['**/*.tsx'], ignores: ['**/*.test.tsx'] }) })

    expect(shippedSettingsOf(route)).toStrictEqual({ options: [{ max: 200 }], files: ['**/*.tsx'], ignores: ['**/*.test.tsx'] })
  })

  it('gives a rule allowSuppressions decides the options it runs with where suppressions are allowed, not its own', () => {
    const route = buildEslintRoute('house/allowed-only', {
      typed: false,
      oxlintSpellings: [],
      shipped: buildShippedRuleDecidedBySuppressions({ banned: 'off', allowed: { options: ['allowed'] } }, { options: ['own'] }),
    })

    expect(shippedSettingsOf(route)).toStrictEqual({ options: ['allowed'], files: null, ignores: null })
  })

  it('throws for a rule we do not ship, and for one that is off where suppressions are allowed, naming the rule', () => {
    const offWhereAllowed = buildEslintRoute('house/banned-only', { typed: false, oxlintSpellings: [], shipped: buildShippedRuleDecidedBySuppressions({ banned: { options: [] }, allowed: 'off' }) })

    expect(() => shippedSettingsOf(eslintRule('plugin/unshipped'))).toThrow(/plugin\/unshipped is not shipped/)
    expect(() => shippedSettingsOf(offWhereAllowed)).toThrow(/house\/banned-only is off where suppressions are allowed/)
  })
})

describe('eslintBlocksOf', () => {
  const settings = { ...UNSHIPPED_RULE_SETTINGS, ignores: [SKIPPED] }

  it('runs a moved core rule on JS files and its current typescript-eslint extension on TS files, each with its ignores', () => {
    const catalogParts = { rules: new Map([['no-unused-vars', oxlintCoreRule('no-unused-vars')], [EXTENSION, eslintRule(EXTENSION)]]), coreRuleExtensions: new Map([['no-unused-vars', [EXTENSION]]]) }

    expect(eslintBlocksOf(oxlintCoreRule('no-unused-vars'), settings, catalogParts)).toStrictEqual([
      { ruleId: 'no-unused-vars', settings: { ...settings, files: ['**/*.{js,jsx,mjs,cjs}'] } },
      { ruleId: EXTENSION, settings: { ...settings, files: ['**/*.{ts,tsx,mts,cts}'] } },
    ])
  })

  it('runs the rule alone where ESLint runs it, where its extension is no RuleId, and where nothing extends it', () => {
    const coreRuleExtensions = new Map([
      ['no-shadow', ['@typescript-eslint/no-shadow']],
      ['no-loop-func', ['@typescript-eslint/no-loop-func']],
    ])
    const rules = new Map([['@typescript-eslint/no-shadow', eslintRule('@typescript-eslint/no-shadow')]])

    expect(
      [eslintRule('no-shadow'), oxlintCoreRule('no-loop-func'), oxlintCoreRule('no-debugger')].map((route) => eslintBlocksOf(route, settings, { rules, coreRuleExtensions })),
    ).toStrictEqual([
      [{ ruleId: 'no-shadow', settings }],
      [{ ruleId: 'no-loop-func', settings }],
      [{ ruleId: 'no-debugger', settings }],
    ])
  })

  it('throws for a moved core rule two current extensions extend, naming both', () => {
    const extensions = ['@typescript-eslint/no-invalid-this', 'other/no-invalid-this']
    const catalogParts = { rules: new Map(extensions.map((id) => [id, eslintRule(id)])), coreRuleExtensions: new Map([['no-invalid-this', extensions]]) }

    expect(() => eslintBlocksOf(oxlintCoreRule('no-invalid-this'), settings, catalogParts)).toThrow(/@typescript-eslint\/no-invalid-this, other\/no-invalid-this/)
  })
})

describe("each engine's outcome on each file, against the installed engines", () => {
  const projectDir = setUpTempDir('rule-data-rule-case-runs-')

  beforeAll(async () => {
    await writeCaseFiles(projectDir(), [DEBUGGER_FILE, QUIET_FILE, UNPARSABLE_FILE, SKIPPED_FILE])
  })

  it(
    "gives ESLint's finding, its silence, a file it cannot parse or no block matches as not linted, and silence in the rule's ignores",
    async () => {
      const svelteFile: CaseFile = { path: 'src/counter.svelte', source: '<script>\n  debugger\n</script>\n' }
      const outcomes = await eslintOutcomesOf(
        projectDir(),
        [{ ruleId: 'no-debugger', settings: { ...UNSHIPPED_RULE_SETTINGS, ignores: [SKIPPED] } }],
        [DEBUGGER_FILE, QUIET_FILE, UNPARSABLE_FILE, SKIPPED_FILE, svelteFile],
        { typed: false },
      )

      expect(Object.fromEntries(outcomes)).toStrictEqual({
        [DEBUGGER_FILE.path]: 'reports',
        [QUIET_FILE.path]: 'silent',
        [UNPARSABLE_FILE.path]: 'not linted',
        [SKIPPED_FILE.path]: 'silent',
        [svelteFile.path]: 'not linted',
      })
    },
    ENGINES_TIMEOUT_MS,
  )

  it(
    "gives oxlint's finding, its silence, a file it cannot parse as not linted, and silence in the rule's ignores",
    async () => {
      const outcomes = oxlintOutcomesOf(projectDir(), 'outcomes.oxlintrc.json', { oxlintName: 'no-debugger', oxlintPlugin: 'eslint' }, shippedSettingsOf(noDebuggerInOxlint), [
        DEBUGGER_FILE,
        QUIET_FILE,
        UNPARSABLE_FILE,
        SKIPPED_FILE,
      ])

      expect(Object.fromEntries(outcomes)).toStrictEqual({
        [DEBUGGER_FILE.path]: 'reports',
        [QUIET_FILE.path]: 'silent',
        [UNPARSABLE_FILE.path]: 'not linted',
        [SKIPPED_FILE.path]: 'silent',
      })
    },
    ENGINES_TIMEOUT_MS,
  )

  it(
    'gives every file as not linted where oxlint refuses the config',
    () => {
      const outcomes = oxlintOutcomesOf(projectDir(), 'refused.oxlintrc.json', { oxlintName: 'no-such-rule', oxlintPlugin: 'eslint' }, UNSHIPPED_RULE_SETTINGS, [DEBUGGER_FILE, QUIET_FILE])

      expect(Object.fromEntries(outcomes)).toStrictEqual({ [DEBUGGER_FILE.path]: 'not linted', [QUIET_FILE.path]: 'not linted' })
    },
    ENGINES_TIMEOUT_MS,
  )

  it('throws for a rule shipping files of its own, which the oxlint build refuses', () => {
    expect(() => oxlintOutcomesOf(projectDir(), 'files.oxlintrc.json', { oxlintName: 'no-debugger', oxlintPlugin: 'eslint' }, { ...UNSHIPPED_RULE_SETTINGS, files: ['**/*.ts'] }, [DEBUGGER_FILE])).toThrow(
      /no-debugger ships files of its own/,
    )
  })
})
