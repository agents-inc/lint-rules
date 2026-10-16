import type { OxlintConfig } from 'oxlint'
import { buildTeamOxlintConfig } from '../factories/team-config-factories.ts'
import { jsonFileText } from '../factories/team-config-file-factories.ts'
import { EMPTY_TEAM_OXLINT_CONFIG } from '../team-configs-of-the-other-engine.ts'
import type { ConfigFile } from './other-engine-configs.ts'

// The team JSON oxlint configs merge-eslint-config.oxlint-js-plugins.test.ts names as mergeEslintConfig's
// third argument: each turns our sonarjs anchor-precedence off under the prefix `sonarjs`, beside a JS
// plugin named so, by its package, at a path, or none; and one lists a plugin oxlint has no plugin of.

/** A rule of ours ESLint runs and oxlint has no version of, which a team may run in oxlint through the plugin's JS version. */
export const SONARJS_RULE = 'sonarjs/anchor-precedence'

/** A name oxlint takes for none of its plugins, which it refuses in `plugins` ("Unknown plugin", measured, oxlint 1.87). */
export const NO_PLUGIN_OF_OXLINTS = 'foo'

/** A team JSON oxlint config, by its file and what it lists as a JS plugin. */
export type JsPluginConfigFile = ConfigFile & { readonly listing: string }

function turningSonarjsRuleOffBeside(fields: OxlintConfig): OxlintConfig {
  return buildTeamOxlintConfig({ ...EMPTY_TEAM_OXLINT_CONFIG, ...fields, rules: { [SONARJS_RULE]: 'off' } })
}

/** Configs whose JS plugin takes the prefix `sonarjs`: given as a name and a specifier, and by its package's name. */
export const CONFIGS_LISTING_THE_SONARJS_JS_PLUGIN: readonly JsPluginConfigFile[] = [
  {
    listing: 'a JS plugin given its name and specifier',
    file: 'named.oxlintrc.json',
    text: jsonFileText(turningSonarjsRuleOffBeside({ jsPlugins: [{ name: 'sonarjs', specifier: 'eslint-plugin-sonarjs' }] })),
  },
  { listing: "a JS plugin by its package's name", file: 'package.oxlintrc.json', text: jsonFileText(turningSonarjsRuleOffBeside({ jsPlugins: ['eslint-plugin-sonarjs'] })) },
]

/** Configs whose key under `sonarjs` names no JS plugin's rule: one loading a JS plugin from a path, which takes its prefix from the plugin itself, and one loading none. */
export const CONFIGS_LISTING_NO_SONARJS_JS_PLUGIN: readonly JsPluginConfigFile[] = [
  { listing: 'a JS plugin at a path', file: 'path.oxlintrc.json', text: jsonFileText(turningSonarjsRuleOffBeside({ jsPlugins: ['./lint/sonarjs.js'] })) },
  { listing: 'no JS plugin', file: 'none.oxlintrc.json', text: jsonFileText(turningSonarjsRuleOffBeside({})) },
]

/** A team JSON oxlint config listing, among its plugins, a name oxlint takes for none of its own. */
export const CONFIG_LISTING_NO_PLUGIN_OF_OXLINTS: ConfigFile = {
  file: 'unknown-plugin.oxlintrc.json',
  text: jsonFileText({ ...EMPTY_TEAM_OXLINT_CONFIG, plugins: ['typescript', NO_PLUGIN_OF_OXLINTS] }),
}

/** The same config listing only plugins oxlint has, one by another name it takes for it (react-hooks for react). */
export const CONFIG_LISTING_PLUGINS_OF_OXLINTS: ConfigFile = {
  file: 'known-plugins.oxlintrc.json',
  text: jsonFileText({ ...EMPTY_TEAM_OXLINT_CONFIG, plugins: ['typescript', 'react-hooks'] }),
}

/** A JSON oxlint config loading eslint-react as a JS plugin by its scoped package's name, turning a rule of ours under its prefix off. */
export const ESLINT_REACT_RULE = '@eslint-react/dom-no-dangerously-set-innerhtml'

export const CONFIG_LISTING_A_SCOPED_JS_PLUGIN: JsPluginConfigFile = {
  listing: "a JS plugin by its scoped package's name",
  file: 'scoped-package.oxlintrc.json',
  text: jsonFileText(buildTeamOxlintConfig({ ...EMPTY_TEAM_OXLINT_CONFIG, jsPlugins: ['@eslint-react/eslint-plugin'], rules: { [ESLINT_REACT_RULE]: 'off' } })),
}

/** The same statement in a config loading no JS plugin: oxlint reads the key as a JS plugin's it does not load. */
export const CONFIG_STATING_THE_ESLINT_REACT_RULE_ALONE: ConfigFile = {
  file: 'scoped-key-alone.oxlintrc.json',
  text: jsonFileText(buildTeamOxlintConfig({ ...EMPTY_TEAM_OXLINT_CONFIG, rules: { [ESLINT_REACT_RULE]: 'off' } })),
}
