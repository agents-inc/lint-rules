import { describe, expect, it } from 'vitest'
import { filesOf } from './__tests__/cases/other-engine-configs.ts'
import {
  CONFIG_LISTING_A_SCOPED_JS_PLUGIN,
  CONFIG_LISTING_NO_PLUGIN_OF_OXLINTS,
  CONFIG_LISTING_PLUGINS_OF_OXLINTS,
  CONFIG_STATING_THE_ESLINT_REACT_RULE_ALONE,
  CONFIGS_LISTING_NO_SONARJS_JS_PLUGIN,
  CONFIGS_LISTING_THE_SONARJS_JS_PLUGIN,
  ESLINT_REACT_RULE,
  NO_PLUGIN_OF_OXLINTS,
  SONARJS_RULE,
} from './__tests__/cases/oxlint-js-plugins.ts'
import { setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import { buildConsumerLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { buildTsconfig } from './__tests__/factories/tsconfig-factories.ts'
import { INSTALLED_OXLINT, setUpTempProjects } from './__tests__/temp-projects.ts'
import { mergeEslintConfig } from './eslint.ts'
import { defineLintRules } from './index.ts'

// A key under the prefix of a JS plugin a team's oxlint config loads sets our rule of that ESLint name.
// The prefix is the name the config gives the plugin, or its package name as oxlint cuts it; a plugin
// loaded from a path names itself, which no reading of the config gives. A plugin oxlint lacks is refused.

const tempProjects = setUpTempProjects()
const { ruleSeverityInProjectFor } = setUpEslintConfigOracle()

const SOURCE_FILE = 'src/a.ts'
const SOURCE = 'export const total = 1\n'

const projectDir = tempProjects.create({
  files: {
    'package.json': packageJsonText(buildPackageJsonListingOxlint()),
    // A typed rule of ours runs only where a tsconfig takes the file in.
    'tsconfig.json': JSON.stringify(buildTsconfig({ include: ['src'] })),
    [SOURCE_FILE]: SOURCE,
    ...filesOf([
      ...CONFIGS_LISTING_THE_SONARJS_JS_PLUGIN,
      ...CONFIGS_LISTING_NO_SONARJS_JS_PLUGIN,
      CONFIG_LISTING_A_SCOPED_JS_PLUGIN,
      CONFIG_STATING_THE_ESLINT_REACT_RULE_ALONE,
      CONFIG_LISTING_NO_PLUGIN_OF_OXLINTS,
      CONFIG_LISTING_PLUGINS_OF_OXLINTS,
    ]),
  },
  linkedPackages: [INSTALLED_OXLINT],
})
const { eslint } = defineLintRules(buildConsumerLintRules(projectDir, {}, { rules: { [SONARJS_RULE]: 'error', [ESLINT_REACT_RULE]: 'error' } })).editorRulesets

describe("mergeEslintConfig, given a team oxlint config turning sonarjs's anchor-precedence off under sonarjs/", () => {
  it.each(CONFIGS_LISTING_THE_SONARJS_JS_PLUGIN)('drops ours of it where the config loads $listing, whose rules take that prefix', async ({ file }) => {
    expect(await ruleSeverityInProjectFor(projectDir, mergeEslintConfig([], eslint, { oxlintConfig: file }), SOURCE_FILE, SONARJS_RULE)).toBeUndefined()
  })

  it.each(CONFIGS_LISTING_NO_SONARJS_JS_PLUGIN)('keeps ours where the config loads $listing, so the key names no rule it loads', async ({ file }) => {
    expect(await ruleSeverityInProjectFor(projectDir, mergeEslintConfig([], eslint, { oxlintConfig: file }), SOURCE_FILE, SONARJS_RULE)).toBe('error')
  })
})

// A scoped package's JS plugin takes its scope as its prefix: @eslint-react/eslint-plugin names @eslint-react.
describe("mergeEslintConfig, given a team oxlint config turning eslint-react's dom-no-dangerously-set-innerhtml off under @eslint-react/", () => {
  it("drops ours of it where the config loads the JS plugin by its scoped package's name", async () => {
    expect(await ruleSeverityInProjectFor(projectDir, mergeEslintConfig([], eslint, { oxlintConfig: CONFIG_LISTING_A_SCOPED_JS_PLUGIN.file }), SOURCE_FILE, ESLINT_REACT_RULE)).toBeUndefined()
  })

  it('keeps ours where the config states the key but loads no JS plugin', async () => {
    expect(await ruleSeverityInProjectFor(projectDir, mergeEslintConfig([], eslint, { oxlintConfig: CONFIG_STATING_THE_ESLINT_REACT_RULE_ALONE.file }), SOURCE_FILE, ESLINT_REACT_RULE)).toBe('error')
  })
})

describe("mergeEslintConfig, given a team oxlint config's plugins", () => {
  it('refuses a config listing a plugin oxlint has no plugin of, naming it', () => {
    expect(() => mergeEslintConfig([], eslint, { oxlintConfig: CONFIG_LISTING_NO_PLUGIN_OF_OXLINTS.file })).toThrowError(
      new Error(`"${NO_PLUGIN_OF_OXLINTS}" names no plugin of oxlint's`),
    )
  })

  it('reads a config listing plugins oxlint has, one by another name oxlint takes for it', () => {
    expect(() => mergeEslintConfig([], eslint, { oxlintConfig: CONFIG_LISTING_PLUGINS_OF_OXLINTS.file })).not.toThrow()
  })
})
