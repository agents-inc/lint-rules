import { builtinRules } from 'eslint/use-at-your-own-risk'
import { describe, expect, it } from 'vitest'

import {
  buildCoreRulesBindingModules,
  buildPluginBindingModules,
  buildPluginHoldingNoRules,
} from '../__tests__/factories/eslint-plugin-factories.ts'
import { eslintPlugins } from '../eslint-plugins.ts'
import { readEslintRules } from './read-installed.ts'

// A plugin may bind one rule module to two names (@eslint-react's `x-no-missing-key` and
// `no-missing-key`): both are rule IDs, yet one rule. Factory modules carry no meta: neither deprecated
// nor typed.

const NO_CORE_RULES = buildCoreRulesBindingModules([])

describe('readEslintRules', () => {
  it('records, of each name a plugin binds to one module, the other names it binds to that module, under its prefix and sorted', () => {
    const plugins = { team: buildPluginBindingModules([['no-missing-key', 'old-no-missing-key', 'x-no-missing-key']]) }

    expect(readEslintRules(NO_CORE_RULES, plugins)).toStrictEqual([
      { id: 'team/no-missing-key', deprecated: false, typed: false, sameModuleAs: ['team/old-no-missing-key', 'team/x-no-missing-key'] },
      { id: 'team/old-no-missing-key', deprecated: false, typed: false, sameModuleAs: ['team/no-missing-key', 'team/x-no-missing-key'] },
      { id: 'team/x-no-missing-key', deprecated: false, typed: false, sameModuleAs: ['team/no-missing-key', 'team/old-no-missing-key'] },
    ])
  })

  it('records no other name for names bound to modules of their own, however alike the names', () => {
    const plugins = { team: buildPluginBindingModules([['no-duplicate-key'], ['no-missing-key'], ['x-no-missing-key']]) }

    expect(readEslintRules(NO_CORE_RULES, plugins)).toStrictEqual([
      { id: 'team/no-duplicate-key', deprecated: false, typed: false },
      { id: 'team/no-missing-key', deprecated: false, typed: false },
      { id: 'team/x-no-missing-key', deprecated: false, typed: false },
    ])
  })

  it('records the other name of each pair beside a rule of its own in one plugin, and leaves the single rule alone', () => {
    const plugins = { team: buildPluginBindingModules([['jsx-key-before-spread'], ['no-missing-key', 'x-no-missing-key']]) }

    expect(readEslintRules(NO_CORE_RULES, plugins)).toStrictEqual([
      { id: 'team/jsx-key-before-spread', deprecated: false, typed: false },
      { id: 'team/no-missing-key', deprecated: false, typed: false, sameModuleAs: ['team/x-no-missing-key'] },
      { id: 'team/x-no-missing-key', deprecated: false, typed: false, sameModuleAs: ['team/no-missing-key'] },
    ])
  })

  it('records two core rule names bound to one module, without a prefix', () => {
    const coreRules = buildCoreRulesBindingModules([['eqeqeq'], ['no-new-rule', 'no-old-rule']])

    expect(readEslintRules(coreRules, {})).toStrictEqual([
      { id: 'eqeqeq', deprecated: false, typed: false },
      { id: 'no-new-rule', deprecated: false, typed: false, sameModuleAs: ['no-old-rule'] },
      { id: 'no-old-rule', deprecated: false, typed: false, sameModuleAs: ['no-new-rule'] },
    ])
  })

  it('throws on a plugin holding no rules, naming the prefix it is registered under', () => {
    const plugins = { team: buildPluginHoldingNoRules() }

    expect(() => readEslintRules(NO_CORE_RULES, plugins)).toThrow(new Error('the plugin registered as team has no rules'))
  })

  it("records the installed @eslint-react's x-no-missing-key and no-missing-key as each other's other name", () => {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- ESLint 10.12 lists its core rules nowhere else: `Linter` has no `getRules`, its `./rules` export is types only, and no other export holds them
    const installed = readEslintRules(builtinRules, eslintPlugins)
    function installedRule(id: string): unknown {
      return installed.find((rule) => rule.id === id)
    }

    expect({
      prefixed: installedRule('@eslint-react/x-no-missing-key'),
      plain: installedRule('@eslint-react/no-missing-key'),
    }).toStrictEqual({
      prefixed: { id: '@eslint-react/x-no-missing-key', deprecated: false, typed: false, sameModuleAs: ['@eslint-react/no-missing-key'] },
      plain: { id: '@eslint-react/no-missing-key', deprecated: false, typed: false, sameModuleAs: ['@eslint-react/x-no-missing-key'] },
    })
  })
})
