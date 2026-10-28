import { catalog } from '@workspace/rule-data'
import { describe, expect, it } from 'vitest'
import { oxlintRuleWithId } from './oxlint-codes.ts'
import { OXLINT_PLUGINS_IN_RULE_ORDER, oxlintPluginListedAs, oxlintRuleKeyedBy } from './oxlint-rule-keys.ts'
import { pluginsInTheInstalledOxlintsRuleOrder } from './oxlint-rule-list.ts'
import { PARALLEL_LOAD_TIMEOUT_MS } from './parallel-load.ts'

// The keys are those the oxlint merge's shapes write, each measured with oxlint 1.87 in
// merge-oxlint-config.differential.integration.test.ts.

describe('oxlintRuleKeyedBy', () => {
  it.each([
    { key: 'react/jsx-key', ruleId: 'react/jsx-key', kind: "the plugin's own name" },
    { key: 'react-hooks/jsx-key', ruleId: 'react/jsx-key', kind: 'another name of the plugin' },
    { key: 'react_hooks/jsx-no-duplicate-props', ruleId: 'react/jsx-no-duplicate-props', kind: 'another name of the plugin' },
    { key: 'eslint-plugin-react/no-unknown-property', ruleId: 'react/no-unknown-property', kind: "the plugin's package name" },
    { key: 'oxlint-plugin-react/jsx-no-duplicate-props', ruleId: 'react/jsx-no-duplicate-props', kind: 'an oxlint-plugin package name' },
    {
      key: '@typescript-eslint/eslint-plugin/no-non-null-assertion',
      ruleId: '@typescript-eslint/no-non-null-assertion',
      kind: 'a scoped package name',
    },
    {
      key: '@typescript-eslint/oxlint-plugin/no-duplicate-enum-values',
      ruleId: '@typescript-eslint/no-duplicate-enum-values',
      kind: 'a scoped oxlint-plugin package name',
    },
    { key: 'typescript_eslint/array-type', ruleId: '@typescript-eslint/array-type', kind: 'another name of the plugin' },
    { key: 'typescript/no-unused-vars', ruleId: 'no-unused-vars', kind: 'a core rule oxlint adapts to TypeScript' },
    { key: 'eslint/no-debugger', ruleId: 'no-debugger', kind: 'a core rule under eslint' },
    { key: 'deepscan/approx-constant', ruleId: 'oxc/approx-constant', kind: "oxc's old name" },
    { key: 'import-x/no-nodejs-modules', ruleId: 'import-x/no-nodejs-modules', kind: "import's other name" },
    { key: 'jsx-a11y-x/alt-text', ruleId: 'jsx-a11y/alt-text', kind: "jsx-a11y's fork" },
    { key: 'jsx_a11y-x/alt-text', ruleId: 'jsx-a11y/alt-text', kind: "jsx-a11y's fork, underscored" },
    { key: 'react_perf/jsx-no-new-object-as-prop', ruleId: 'react-perf/jsx-no-new-object-as-prop', kind: 'another name of the plugin' },
    { key: '@next/no-img-element', ruleId: '@next/next/no-img-element', kind: "nextjs's scope" },
    { key: '@next/next/no-html-link-for-pages', ruleId: '@next/next/no-html-link-for-pages', kind: "nextjs's scope and name" },
    { key: '@next/eslint-plugin-next/no-sync-scripts', ruleId: '@next/next/no-sync-scripts', kind: "nextjs's package name" },
    { key: 'no-debugger', ruleId: 'no-debugger', kind: 'a core rule with no prefix' },
    { key: 'no-namespace', ruleId: 'import-x/no-namespace', kind: "no prefix, import's before react's and typescript's" },
    { key: 'prefer-includes', ruleId: '@typescript-eslint/prefer-includes', kind: "no prefix, typescript's before unicorn's" },
    { key: 'no-focused-tests', ruleId: 'jest/no-focused-tests', kind: "no prefix, jest's before vitest's" },
  ])('reads $key as $ruleId: $kind', ({ key, ruleId }) => {
    expect(oxlintRuleKeyedBy(key, catalog)).toBe(oxlintRuleWithId(ruleId, catalog))
  })

  it.each([
    { key: 'local/jsx-no-duplicate-props', kind: "a JS plugin's rule named as an oxlint rule is" },
    { key: '@next/eslint-plugin-local/no-img-element', kind: "a JS plugin's rule under its package name, @next/local" },
    { key: 'react/no-such-rule', kind: 'a name no rule of the plugin has' },
    { key: 'no-such-rule', kind: 'a name no rule has' },
  ])('reads $key as no rule of oxlint: $kind', ({ key }) => {
    expect(oxlintRuleKeyedBy(key, catalog)).toBeUndefined()
  })

  it('reads every rule the catalog records oxlint having from its oxlint name', () => {
    expect(catalog.oxlintRules.filter((rule) => oxlintRuleKeyedBy(rule.oxlintName, catalog) !== rule).map(({ id }) => id)).toStrictEqual([])
  })
})

describe('oxlintPluginListedAs', () => {
  it.each([
    { name: 'react', plugin: 'react' },
    { name: 'react-hooks', plugin: 'react' },
    { name: 'eslint-plugin-jsx-a11y', plugin: 'jsx-a11y' },
    { name: 'jsx_a11y', plugin: 'jsx-a11y' },
    { name: 'eslint', plugin: 'eslint' },
  ])('reads $name as $plugin', ({ name, plugin }) => {
    expect(oxlintPluginListedAs(name)).toBe(plugin)
  })

  it('refuses a name that names no plugin of oxlint', () => {
    expect(() => oxlintPluginListedAs('local')).toThrow('"local" names no plugin of oxlint\'s')
  })
})

describe('OXLINT_PLUGINS_IN_RULE_ORDER', () => {
  it('is the order the installed oxlint keeps its rules in, each plugin once', { timeout: PARALLEL_LOAD_TIMEOUT_MS }, () => {
    expect(pluginsInTheInstalledOxlintsRuleOrder()).toStrictEqual(OXLINT_PLUGINS_IN_RULE_ORDER)
  })
})
