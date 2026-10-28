import { catalog } from '@workspace/rule-data'
import type { ESLint, Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import { ARRAY_TYPE } from '../__tests__/cases/other-engine-configs.ts'
import { setUpEslintConfigOracle } from '../__tests__/eslint-config-oracle.ts'
import { buildFakePlugin } from '../__tests__/factories/catalog-factories.ts'
import { buildPluginNamedAtTopLevel, type PluginIdentity } from '../__tests__/factories/eslint-merge-factories.ts'
import { buildConsumerLintRules, emptyTsconfigRootDir } from '../__tests__/factories/lint-rules-factories.ts'
import { buildTeamEslintBlock } from '../__tests__/factories/team-config-factories.ts'
import { NO_RULE_SET_BY_THE_TEAMS_OXLINT_CONFIG } from '../__tests__/team-configs-of-the-other-engine.ts'
import { eslintPluginRegistry } from '../eslint-plugin-registry.ts'
import { defineLintRules } from '../index.ts'
import { ruleIdsTheTeamsEslintConfigSets } from './eslint-config-reading.ts'
import { mergeEslintPart } from './merge-eslint-config.ts'

// ESLint reads a plugin's name and version from its top level before its meta, so a plugin giving both is read by its
// top level: as one of ours or not, and in the cache key our copy of it carries.

const { serializedPluginsFor } = setUpEslintConfigOracle()

const OUR_TYPESCRIPT_ESLINT_NAME = '@typescript-eslint/eslint-plugin'
const ANOTHER_PLUGINS_NAME = 'eslint-plugin-team-ts'
const TEAM_PREFIX = 'ts'
const OUR_PREFIX = '@typescript-eslint'
const ARRAY_TYPE_NAME = 'array-type'
const TEAM_RULE_NAME = 'team-only'
const PLUGIN_VERSION = '1.0.0'
const OUR_VERSION = '1.0.0'
const NAMED_AT_TOP_LEVEL = { name: 'team-typescript-eslint', version: '2.0.0' }
const NAMED_IN_ITS_META = { name: 'team-typescript-eslint-in-meta', version: '3.0.0' }
const SOURCE_FILE = 'src/a.ts'

/** A plugin of the rules given, named at its top level and, otherwise, in its meta. */
function pluginNamedTwice(ruleNames: readonly string[], atTopLevel: PluginIdentity, inItsMeta: PluginIdentity): ESLint.Plugin {
  return { ...buildPluginNamedAtTopLevel(ruleNames, atTopLevel), meta: inItsMeta }
}

/** Our rules the team sets, beside a team block registering the plugin under its own prefix and turning array-type under it off. */
function oursSetBesideTeamPrefixFor(plugin: Readonly<ESLint.Plugin>): string[] {
  const block = buildTeamEslintBlock('team', { plugins: { [TEAM_PREFIX]: plugin }, rules: { [`${TEAM_PREFIX}/${ARRAY_TYPE_NAME}`]: 'off' } })
  return ruleIdsTheTeamsEslintConfigSets([block], eslintPluginRegistry, catalog)
}

/** Our part, running array-type, merged beside a team block registering the plugin under our typescript-eslint prefix. */
function mergedBesideTeamPluginUnderOurPrefix(plugin: Readonly<ESLint.Plugin>): Linter.Config[] {
  const { eslint } = defineLintRules(buildConsumerLintRules(emptyTsconfigRootDir(), {}, { rules: { [ARRAY_TYPE]: 'error' } })).editorRulesets
  const teamBlock = buildTeamEslintBlock('team', { plugins: { [OUR_PREFIX]: plugin } })
  return mergeEslintPart([teamBlock], eslint, catalog, eslintPluginRegistry, OUR_VERSION, NO_RULE_SET_BY_THE_TEAMS_OXLINT_CONFIG)
}

describe('a team plugin named at its top level and in its meta, registered under a prefix of the team\'s own', () => {
  it('is our typescript-eslint where its top-level name is ours, though its meta names another plugin; and is not where only its meta name is ours', () => {
    expect({
      topLevelOurs: oursSetBesideTeamPrefixFor(
        pluginNamedTwice([ARRAY_TYPE_NAME], { name: OUR_TYPESCRIPT_ESLINT_NAME, version: PLUGIN_VERSION }, { name: ANOTHER_PLUGINS_NAME, version: PLUGIN_VERSION }),
      ),
      metaOurs: oursSetBesideTeamPrefixFor(
        pluginNamedTwice([ARRAY_TYPE_NAME], { name: ANOTHER_PLUGINS_NAME, version: PLUGIN_VERSION }, { name: OUR_TYPESCRIPT_ESLINT_NAME, version: PLUGIN_VERSION }),
      ),
    }).toStrictEqual({ topLevelOurs: [ARRAY_TYPE], metaOurs: [] })
  })
})

describe('our copy of a team plugin registered under our typescript-eslint prefix, as ESLint names it in its cache key', () => {
  it('carries the top-level name and version where the plugin gives both and its meta names another, and the meta\'s where only the meta names it', async () => {
    const namedTwice = await serializedPluginsFor(
      mergedBesideTeamPluginUnderOurPrefix(pluginNamedTwice([TEAM_RULE_NAME], NAMED_AT_TOP_LEVEL, NAMED_IN_ITS_META)),
      SOURCE_FILE,
    )
    const namedInItsMeta = await serializedPluginsFor(
      mergedBesideTeamPluginUnderOurPrefix(buildFakePlugin([TEAM_RULE_NAME], { meta: NAMED_IN_ITS_META })),
      SOURCE_FILE,
    )

    expect({ namedTwice: namedTwice[OUR_PREFIX], namedInItsMeta: namedInItsMeta[OUR_PREFIX] }).toStrictEqual({
      namedTwice: '@typescript-eslint:team-typescript-eslint@2.0.0+agents-inc-lint-rules.1.0.0',
      namedInItsMeta: '@typescript-eslint:team-typescript-eslint-in-meta@3.0.0+agents-inc-lint-rules.1.0.0',
    })
  })
})
