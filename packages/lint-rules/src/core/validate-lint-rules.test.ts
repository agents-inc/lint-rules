import { describe, expect, it } from 'vitest'
import {
  buildCatalog,
  buildLanguageRuleset,
  buildLibsRuleset,
  buildOxlintRoute,
  buildQualityRuleset,
  buildRuntimeRuleset,
  buildShippedRule,
} from '../__tests__/factories/catalog-factories.ts'
import { buildTwoSetFileOverride, buildTwoSetLintRules } from '../__tests__/factories/lint-rules-factories.ts'
import { validateLintRules } from './validate-lint-rules.ts'

const catalog = buildCatalog({
  rulesets: [
    buildQualityRuleset('correctness'),
    buildLibsRuleset('react', 'ui'),
    buildLibsRuleset('vitest', 'testing'),
    buildRuntimeRuleset('node', 'node'),
    buildLanguageRuleset('json'),
  ],
  rules: [
    buildOxlintRoute('no-debugger', {
      oxlintName: 'no-debugger',
      oxlintPlugin: 'eslint',
      shipped: buildShippedRule('correctness'),
    }),
  ],
})

describe('validateLintRules', () => {
  it('accepts a config whose every ruleset, domain, rule ID and severity is known, in both sets', () => {
    const everyKind = {
      quality: ['correctness'],
      libs: { ui: ['react'], testing: ['vitest'] },
      runtimes: ['node'],
      languages: ['json'],
    }
    const lintRules = buildTwoSetLintRules(
      { agentRulesets: everyKind, editorRulesets: everyKind },
      {
        rules: { 'no-debugger': ['warn', { allow: true }] },
        fileOverrides: [
          buildTwoSetFileOverride(['**/*.test.ts'], {
            agentRulesets: { libs: {}, runtimes: [] },
            editorRulesets: { libs: {}, runtimes: [] },
            rules: { 'no-debugger': 'off' },
          }),
        ],
      },
    )

    expect(() => validateLintRules(lintRules, catalog)).not.toThrow()
  })

  describe('a ruleset name', () => {
    it('is refused when no ruleset has it, naming the value, its set and its list', () => {
      const lintRules = buildTwoSetLintRules({ agentRulesets: { quality: ['not-a-ruleset'] } })

      expect(() => validateLintRules(lintRules, catalog)).toThrowError(
        new Error('agents-inc.lint.mts: agentRulesets.quality: unknown ruleset "not-a-ruleset"'),
      )
    })

    it('is refused in the editor set too, naming that set', () => {
      const lintRules = buildTwoSetLintRules({ editorRulesets: { quality: ['not-a-ruleset'] } })

      expect(() => validateLintRules(lintRules, catalog)).toThrowError(
        new Error('agents-inc.lint.mts: editorRulesets.quality: unknown ruleset "not-a-ruleset"'),
      )
    })

    it('is accepted in the list its ruleset belongs to, in either set', () => {
      const lintRules = buildTwoSetLintRules({
        agentRulesets: { quality: ['correctness'] },
        editorRulesets: { quality: ['correctness'] },
      })

      expect(() => validateLintRules(lintRules, catalog)).not.toThrow()
    })

    it('is refused in the quality list when it belongs to libs', () => {
      const lintRules = buildTwoSetLintRules({ agentRulesets: { quality: ['react'] } })

      expect(() => validateLintRules(lintRules, catalog)).toThrowError(
        new Error('agents-inc.lint.mts: agentRulesets.quality: "react" is not a quality ruleset'),
      )
    })

    it('is refused in the runtimes list when it belongs to quality', () => {
      const lintRules = buildTwoSetLintRules({ agentRulesets: { runtimes: ['correctness'] } })

      expect(() => validateLintRules(lintRules, catalog)).toThrowError(
        new Error('agents-inc.lint.mts: agentRulesets.runtimes: "correctness" is not a runtimes ruleset'),
      )
    })

    it('is refused in the languages list when no language ruleset has it', () => {
      const lintRules = buildTwoSetLintRules({ agentRulesets: { languages: ['markdown'] } })

      expect(() => validateLintRules(lintRules, catalog)).toThrowError(
        new Error('agents-inc.lint.mts: agentRulesets.languages: unknown ruleset "markdown"'),
      )
    })

    it('is accepted in the languages list when it is a language ruleset', () => {
      const lintRules = buildTwoSetLintRules({ agentRulesets: { languages: ['json'] } })

      expect(() => validateLintRules(lintRules, catalog)).not.toThrow()
    })
  })

  describe('a libs domain', () => {
    it('is refused when no libs ruleset has it', () => {
      const lintRules = buildTwoSetLintRules({ agentRulesets: { libs: { database: ['react'] } } })

      expect(() => validateLintRules(lintRules, catalog)).toThrowError(
        new Error('agents-inc.lint.mts: agentRulesets.libs: unknown domain "database"'),
      )
    })

    it('refuses a libs ruleset filed under another domain', () => {
      const lintRules = buildTwoSetLintRules({ agentRulesets: { libs: { testing: ['react'] } } })

      expect(() => validateLintRules(lintRules, catalog)).toThrowError(
        new Error('agents-inc.lint.mts: agentRulesets.libs.testing: "react" is not a testing ruleset'),
      )
    })

    it('accepts a libs ruleset under its own domain', () => {
      const lintRules = buildTwoSetLintRules({ agentRulesets: { libs: { testing: ['vitest'] } } })

      expect(() => validateLintRules(lintRules, catalog)).not.toThrow()
    })
  })

  describe('a rule set in rules', () => {
    it('is refused when its ID is not in the catalog', () => {
      const lintRules = buildTwoSetLintRules({}, { rules: { 'not/a-rule': 'error' } })

      expect(() => validateLintRules(lintRules, catalog)).toThrowError(
        new Error('agents-inc.lint.mts: rules: unknown rule ID "not/a-rule"'),
      )
    })

    it('is refused when its severity is none of error, warn or off', () => {
      const lintRules = buildTwoSetLintRules({}, { rules: { 'no-debugger': 'warning' } })

      expect(() => validateLintRules(lintRules, catalog)).toThrowError(
        new Error('agents-inc.lint.mts: rules: invalid severity "warning" for "no-debugger"'),
      )
    })

    it('is refused when the severity leading its options is invalid', () => {
      const lintRules = buildTwoSetLintRules({}, { rules: { 'no-debugger': ['warning', { allow: true }] } })

      expect(() => validateLintRules(lintRules, catalog)).toThrowError(
        new Error('agents-inc.lint.mts: rules: invalid severity "warning" for "no-debugger"'),
      )
    })

    it.each([['error'], ['warn'], ['off']])('is accepted at %s', (severity) => {
      const lintRules = buildTwoSetLintRules({}, { rules: { 'no-debugger': severity } })

      expect(() => validateLintRules(lintRules, catalog)).not.toThrow()
    })
  })

  // Types are stripped when agents-inc.lint.mts loads, so a quoted 'false' would otherwise allow suppressions.
  describe('allowSuppressions', () => {
    it.each([[true], [false]])('is accepted as %s', (allowSuppressions) => {
      const lintRules = buildTwoSetLintRules({}, { allowSuppressions })

      expect(() => validateLintRules(lintRules, catalog)).not.toThrow()
    })

    it('is refused when it is not true or false, naming the value', () => {
      const lintRules = buildTwoSetLintRules({}, { allowSuppressions: 'false' })

      expect(() => validateLintRules(lintRules, catalog)).toThrowError(
        new Error('agents-inc.lint.mts: allowSuppressions: "false" is not true or false'),
      )
    })

    it('is accepted in a file override as true or false', () => {
      const lintRules = buildTwoSetLintRules(
        {},
        {
          fileOverrides: [
            buildTwoSetFileOverride(['legacy/**'], { allowSuppressions: true }),
            buildTwoSetFileOverride(['legacy/strict/**'], { allowSuppressions: false }),
          ],
        },
      )

      expect(() => validateLintRules(lintRules, catalog)).not.toThrow()
    })

    it('is refused in a file override when it is not true or false, with the index of the entry in the path', () => {
      const lintRules = buildTwoSetLintRules(
        {},
        {
          fileOverrides: [
            buildTwoSetFileOverride(['legacy/**'], { allowSuppressions: true }),
            buildTwoSetFileOverride(['legacy/strict/**'], { allowSuppressions: 'yes' }),
          ],
        },
      )

      expect(() => validateLintRules(lintRules, catalog)).toThrowError(
        new Error('agents-inc.lint.mts: fileOverrides[1].allowSuppressions: "yes" is not true or false'),
      )
    })
  })

  describe('a file override', () => {
    it('is refused with the index of the entry and its set in the path', () => {
      const lintRules = buildTwoSetLintRules(
        {},
        {
          fileOverrides: [
            buildTwoSetFileOverride(['apps/api/**'], { editorRulesets: { libs: { ui: ['react'] } } }),
            buildTwoSetFileOverride(['apps/web/**'], { editorRulesets: { libs: { ui: ['vitest'] } } }),
          ],
        },
      )

      expect(() => validateLintRules(lintRules, catalog)).toThrowError(
        new Error('agents-inc.lint.mts: fileOverrides[1].editorRulesets.libs.ui: "vitest" is not a ui ruleset'),
      )
    })

    it('is refused in its agent set too, naming that set', () => {
      const lintRules = buildTwoSetLintRules(
        {},
        { fileOverrides: [buildTwoSetFileOverride(['apps/web/**'], { agentRulesets: { libs: { ui: ['vitest'] } } })] },
      )

      expect(() => validateLintRules(lintRules, catalog)).toThrowError(
        new Error('agents-inc.lint.mts: fileOverrides[0].agentRulesets.libs.ui: "vitest" is not a ui ruleset'),
      )
    })

    it('is refused when its rules name an unknown rule ID', () => {
      const lintRules = buildTwoSetLintRules(
        {},
        { fileOverrides: [buildTwoSetFileOverride(['**/*.test.ts'], { rules: { 'not/a-rule': 'off' } })] },
      )

      expect(() => validateLintRules(lintRules, catalog)).toThrowError(
        new Error('agents-inc.lint.mts: fileOverrides[0].rules: unknown rule ID "not/a-rule"'),
      )
    })

    it('is accepted when its rulesets, in either set, and its rules are known', () => {
      const lintRules = buildTwoSetLintRules(
        {},
        {
          fileOverrides: [
            buildTwoSetFileOverride(['apps/web/**'], {
              agentRulesets: { libs: { ui: ['react'] } },
              editorRulesets: { libs: { ui: ['react'] } },
              rules: { 'no-debugger': 'warn' },
            }),
          ],
        },
      )

      expect(() => validateLintRules(lintRules, catalog)).not.toThrow()
    })
  })
})
