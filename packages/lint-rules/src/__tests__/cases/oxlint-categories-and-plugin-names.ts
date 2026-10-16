import type { OxlintConfig } from 'oxlint'
import { jsonFileText } from '../factories/team-config-file-factories.ts'
import type { ConfigFile } from './other-engine-configs.ts'

// The team JSON oxlint configs merge-eslint-config.oxlint-categories.test.ts names as
// mergeEslintConfig's third argument: categories written off by another word, on for plugins listed
// or not, type-aware rules on or left out, and plugins listed by the other names oxlint takes for them.

/** A typescript rule in oxlint's correctness category whose ESLint version ESLint runs for us. */
export const NO_THIS_ALIAS = '@typescript-eslint/no-this-alias'

/** A typed typescript rule oxlint runs only type-aware, in its correctness category, whose ESLint version ESLint runs for us. */
export const NO_FLOATING_PROMISES = '@typescript-eslint/no-floating-promises'

/** A team JSON oxlint config, by its file and what it writes. */
export type CategoryConfigFile = ConfigFile & { readonly writes: string }

function configFile(file: string, writes: string, config: OxlintConfig | Readonly<Record<string, unknown>>): CategoryConfigFile {
  return { file, writes, text: jsonFileText(config) }
}

/** Configs writing correctness on that set no-this-alias by it: none, as each runs no typescript rule by its categories. */
export const CONFIGS_SETTING_NO_TYPESCRIPT_RULE_BY_CATEGORY: readonly CategoryConfigFile[] = [
  configFile('allow.oxlintrc.json', "correctness as 'allow', which is off", { categories: { correctness: 'allow' } }),
  configFile('zero.oxlintrc.json', 'correctness as 0, which is off', { categories: { correctness: 0 } }),
  configFile('oxc-alone.oxlintrc.json', 'correctness on for oxc alone, typescript not listed', { plugins: ['oxc'], categories: { correctness: 'warn' } }),
]

/** A config writing correctness on for typescript, which sets no-this-alias. */
export const CONFIG_SETTING_TYPESCRIPT_RULES_BY_CATEGORY = configFile('typescript.oxlintrc.json', 'correctness on for typescript', {
  plugins: ['typescript'],
  categories: { correctness: 'warn' },
})

const CORRECTNESS_ERRORS_FOR_TYPESCRIPT: OxlintConfig = { plugins: ['typescript'], categories: { correctness: 'error' } }

/** Configs writing correctness on for typescript with type-aware rules left out: they set no-floating-promises in no way oxlint runs. */
export const CONFIGS_LEAVING_TYPE_AWARE_RULES_OUT: readonly CategoryConfigFile[] = [
  configFile('no-options.oxlintrc.json', 'no options', CORRECTNESS_ERRORS_FOR_TYPESCRIPT),
  configFile('type-aware-off.oxlintrc.json', 'typeAware false', { ...CORRECTNESS_ERRORS_FOR_TYPESCRIPT, options: { typeAware: false } }),
  configFile('other-option.oxlintrc.json', 'another option alone', { ...CORRECTNESS_ERRORS_FOR_TYPESCRIPT, options: { reportUnusedDisableDirectives: 'warn' } }),
]

/** The same config turning type-aware rules on. */
export const CONFIG_TURNING_TYPE_AWARE_RULES_ON = configFile('type-aware.oxlintrc.json', 'typeAware true', { ...CORRECTNESS_ERRORS_FOR_TYPESCRIPT, options: { typeAware: true } })

/** Each other name oxlint takes for a plugin of its own in `plugins` (measured, oxlint 1.87 --print-config), and the plugin. */
const PLUGIN_ALIASES: readonly (readonly [alias: string, plugin: string])[] = [
  ['react-hooks', 'react'],
  ['react_hooks', 'react'],
  ['typescript-eslint', 'typescript'],
  ['typescript_eslint', 'typescript'],
  ['@typescript-eslint', 'typescript'],
  ['deepscan', 'oxc'],
  ['import-x', 'import'],
  ['jsx_a11y', 'jsx-a11y'],
  ['jsx-a11y-x', 'jsx-a11y'],
  ['jsx_a11y-x', 'jsx-a11y'],
  ['react_perf', 'react-perf'],
]

/** A config listing a plugin by another name oxlint takes for it, and writing correctness on. */
export type AliasConfigFile = ConfigFile & { readonly alias: string; readonly plugin: string }

/** Configs listing each plugin by each other name, writing correctness on. */
export const CONFIGS_LISTING_A_PLUGIN_BY_ANOTHER_NAME: readonly AliasConfigFile[] = PLUGIN_ALIASES.map(([alias, plugin], index) => ({
  alias,
  plugin,
  file: `alias-${String(index)}.oxlintrc.json`,
  text: jsonFileText({ plugins: [alias], categories: { correctness: 'warn' } }),
}))
