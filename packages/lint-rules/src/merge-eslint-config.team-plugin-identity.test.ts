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
// plugin's name, or the name of the original our fork replaced; a key under that prefix then names our
// rule, which is the team's. A team plugin with another name, or none, is not ours, and our rule of the
// same name stays ours.

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
const TEAM_SEVERITY = 'warn'

const projectDir = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJson()) } })

/** The severity of our rule given in a source file, beside a team block registering the plugin given under the prefix given and turning the rule under it off: undefined where no block sets ours. */
async function oursBeside(prefix: string, plugin: Readonly<ESLint.Plugin>, ruleName: string, ourRule: string): Promise<string | undefined> {
  const { eslint } = defineLintRules(
    buildConsumerLintRules(projectDir, {}, { rules: { [OUR_PROMISE_RULE]: 'error', [OUR_ARRAY_TYPE]: 'error', [OUR_ALT_TEXT]: 'error' } }),
  ).editorRulesets
  const merged = mergeEslintConfig([buildTeamEslintBlock('team', { plugins: { [prefix]: plugin }, rules: { [`${prefix}/${ruleName}`]: 'off' } })], eslint, NO_TEAM_OXLINT_CONFIG)
  return ruleSeverityInProjectFor(projectDir, merged, SOURCE_FILE, ourRule)
}

/** The severities of our rule and the team's key given in a source file, beside a team block registering the plugin given under the prefix given and turning the rule under it on at TEAM_SEVERITY. */
async function bothBesideTheTeamTurningItOn(prefix: string, plugin: Readonly<ESLint.Plugin>, ruleName: string, ourRule: string): Promise<Readonly<Record<string, string | undefined>>> {
  const { eslint } = defineLintRules(buildConsumerLintRules(projectDir, {}, { rules: { [ourRule]: 'error' } })).editorRulesets
  const teamKey = `${prefix}/${ruleName}`
  const merged = mergeEslintConfig([buildTeamEslintBlock('team', { plugins: { [prefix]: plugin }, rules: { [teamKey]: TEAM_SEVERITY } })], eslint, NO_TEAM_OXLINT_CONFIG)
  return {
    [ourRule]: await ruleSeverityInProjectFor(projectDir, merged, SOURCE_FILE, ourRule),
    [teamKey]: await ruleSeverityInProjectFor(projectDir, merged, SOURCE_FILE, teamKey),
  }
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

  // The original the fork replaced counts as ours, under whatever prefix the team gives it.
  it('drops our jsx-a11y alt-text where the plugin is one carrying the name of the original eslint-plugin-jsx-a11y, which our fork replaced', async () => {
    const theOriginal = buildFakePlugin(['alt-text'], { meta: { name: JSX_A11Y_ORIGINAL_NAME, version: TEAM_PLUGIN_VERSION } })

    expect(await oursBeside(TEAM_JSX_A11Y_PREFIX, theOriginal, 'alt-text', OUR_ALT_TEXT)).toBeUndefined()
  })
})

describe('mergeEslintConfig, given a team block registering a plugin under a prefix of its own and turning a rule under it on', () => {
  it("runs the team's alt-text alone, at the team's severity, where the plugin is one carrying the name of the original eslint-plugin-jsx-a11y", async () => {
    const theOriginal = buildFakePlugin(['alt-text'], { meta: { name: JSX_A11Y_ORIGINAL_NAME, version: TEAM_PLUGIN_VERSION } })

    expect(await bothBesideTheTeamTurningItOn(TEAM_JSX_A11Y_PREFIX, theOriginal, 'alt-text', OUR_ALT_TEXT)).toStrictEqual({
      [OUR_ALT_TEXT]: undefined,
      [`${TEAM_JSX_A11Y_PREFIX}/alt-text`]: TEAM_SEVERITY,
    })
  })

  it("runs ours beside the team's alt-text where the plugin is one of its own carrying a name of its own", async () => {
    const teamOwn = buildFakePlugin(['alt-text'], { meta: { name: 'eslint-plugin-team-a11y', version: TEAM_PLUGIN_VERSION } })

    expect(await bothBesideTheTeamTurningItOn(TEAM_JSX_A11Y_PREFIX, teamOwn, 'alt-text', OUR_ALT_TEXT)).toStrictEqual({
      [OUR_ALT_TEXT]: 'error',
      [`${TEAM_JSX_A11Y_PREFIX}/alt-text`]: TEAM_SEVERITY,
    })
  })
})
