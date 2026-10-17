import type { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'
import { setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import { buildFakePlugin } from './__tests__/factories/catalog-factories.ts'
import { installedEslintPlugin } from './__tests__/factories/eslint-merge-factories.ts'
import { buildConsumerLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJson, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { buildTeamEslintBlock } from './__tests__/factories/team-config-factories.ts'
import { NO_TEAM_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'
import { mergeEslintConfig } from './eslint.ts'
import { defineLintRules } from './index.ts'

// A plugin a team registers under its own prefix is ours if it is the very object or carries our
// plugin's name; a key under that prefix then names our rule, which is the team's. A team plugin with
// another name, or none, is not ours, and our rule of the same name stays ours.

const tempProjects = setUpTempProjects()
const { ruleSeverityInProjectFor } = setUpEslintConfigOracle()

const SOURCE_FILE = 'src/a.ts'
const OUR_PROMISE_RULE = 'promise/param-names'
const OUR_ARRAY_TYPE = '@typescript-eslint/array-type'
// oxlint runs it for us; in this project, whose package.json lists no oxlint, ESLint does.
const OUR_ALT_TEXT = 'jsx-a11y/alt-text'
// We install the fork in place of the original; its docs register it under jsx-a11y-x.
const JSX_A11Y_FORK_NAME = 'eslint-plugin-jsx-a11y-x'
const JSX_A11Y_FORK_PREFIX = 'jsx-a11y-x'
const JSX_A11Y_ORIGINAL_NAME = 'eslint-plugin-jsx-a11y'
const TEAM_JSX_A11Y_PREFIX = 'a11y'
const TEAM_PLUGIN_VERSION = '1.0.0'

const projectDir = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJson()) } })
const { eslint } = defineLintRules(
  buildConsumerLintRules(projectDir, {}, { rules: { [OUR_PROMISE_RULE]: 'error', [OUR_ARRAY_TYPE]: 'error', [OUR_ALT_TEXT]: 'error' } }),
).editorRulesets

/** The severity of our rule given in a source file, beside a team block registering the plugin given under the prefix given and turning the rule under it off: undefined where no block sets ours. */
async function oursBeside(prefix: string, plugin: ESLint.Plugin, ruleName: string, ourRule: string): Promise<string | undefined> {
  const merged = mergeEslintConfig([buildTeamEslintBlock('team', { plugins: { [prefix]: plugin }, rules: { [`${prefix}/${ruleName}`]: 'off' } })], eslint, NO_TEAM_OXLINT_CONFIG)
  return ruleSeverityInProjectFor(projectDir, merged, SOURCE_FILE, ourRule)
}

describe('mergeEslintConfig, given a team block registering a plugin under a prefix of its own and turning a rule under it off', () => {
  it('drops our promise param-names where the plugin is our very eslint-plugin-promise, which carries no name', async () => {
    expect(await oursBeside('promise-x', installedEslintPlugin('promise'), 'param-names', OUR_PROMISE_RULE)).toBeUndefined()
  })

  it('keeps ours where the plugin is one of its own that carries no name either', async () => {
    expect(await oursBeside('local', buildFakePlugin(['param-names']), 'param-names', OUR_PROMISE_RULE)).toBe('error')
  })

  it('keeps our typescript-eslint array-type where the plugin is one of its own carrying a name of its own', async () => {
    const teamOwn = buildFakePlugin(['array-type'], { meta: { name: 'eslint-plugin-team-ts', version: '1.0.0' } })

    expect(await oursBeside('ts', teamOwn, 'array-type', OUR_ARRAY_TYPE)).toBe('error')
  })

  it('drops ours where the plugin is another object carrying our typescript-eslint plugin name', async () => {
    const carryingOurName = buildFakePlugin(['array-type'], { meta: { name: '@typescript-eslint/eslint-plugin', version: '1.0.0' } })

    expect(await oursBeside('ts', carryingOurName, 'array-type', OUR_ARRAY_TYPE)).toBeUndefined()
  })

  it('drops our jsx-a11y alt-text where the plugin is another object carrying the name of the jsx-a11y fork we install, under the prefix its docs give', async () => {
    const anotherInstallOfTheFork = buildFakePlugin(['alt-text'], { meta: { name: JSX_A11Y_FORK_NAME, version: TEAM_PLUGIN_VERSION } })

    expect(await oursBeside(JSX_A11Y_FORK_PREFIX, anotherInstallOfTheFork, 'alt-text', OUR_ALT_TEXT)).toBeUndefined()
  })

  // Beside it: the original the fork replaced is a plugin of the team's own, though its rules are named as ours.
  it('keeps our jsx-a11y alt-text where the plugin is one carrying the name of the original eslint-plugin-jsx-a11y, which we no longer install', async () => {
    const theOriginal = buildFakePlugin(['alt-text'], { meta: { name: JSX_A11Y_ORIGINAL_NAME, version: TEAM_PLUGIN_VERSION } })

    expect(await oursBeside(TEAM_JSX_A11Y_PREFIX, theOriginal, 'alt-text', OUR_ALT_TEXT)).toBe('error')
  })
})
