import type { Linter } from 'eslint'
import type { OxlintConfig } from 'oxlint'
import type { LintRules } from '../../index.ts'
import {
  NO_TEAM_OXLINT_CONFIG,
  TEAM_OXLINT_CONFIG_SETTING_NO_RULE,
  type TeamEslintConfigPath,
  type TeamOxlintConfigPath,
  teamOxlintConfigSettingNoRuleFiles,
} from '../team-configs-of-the-other-engine.ts'
import type { ProjectFiles } from '../temp-projects.ts'
import { jsonFileText } from './team-config-file-factories.ts'

// The files a consumer writes to use the built package, as `init` lays them out: agents-inc.lint.mts
// exporting both parts, and an engine config merging one of them into a team's own config.

/** Rule entries by ESLint rule ID, as a team's config states them. */
export type TeamEslintRules = Readonly<Record<string, string>>

/** A function among a team's ignores, by its source: a team's eslint.config.mjs may hold one where no glob says what it leaves out. */
export type TeamIgnoresFunction = { readonly functionSource: string }

/** A team's block of global ignores: its globs and functions, in order, read from its basePath where it gives one. */
export type TeamGlobalIgnoresBlock = { readonly basePath?: string; readonly ignores: readonly (string | TeamIgnoresFunction)[] }

const BUILT_PACKAGE = '@agents-inc/lint-rules'
const TYPESCRIPT_ESLINT_IMPORT = "import tseslint from 'typescript-eslint'"
// A team block reading every JS, TS and TSX file with typescript-eslint's parser, as its source.
const TEAM_JS_AND_TS_PARSER_BLOCK = "{ name: 'team/js-and-ts', files: ['**/*.{js,ts,tsx}'], languageOptions: { parser: tseslint.parser } }"

/** agents-inc.lint.mts holding the settings given, exporting the editor set's two parts. */
export function agentsIncLintModuleText(lintRules: LintRules): string {
  return `import { defineLintRules } from '${BUILT_PACKAGE}'

export const { eslint, oxlint } = defineLintRules(${JSON.stringify(lintRules, null, 2)}).editorRulesets
`
}

/**
 * agents-inc.lint.mts as `init` writes it, rooted at its own folder (`tsconfigRootDir:
 * import.meta.dirname`), holding the other settings given and exporting the editor set's two parts:
 * for a project whose folder is not known when its files are written.
 */
export function agentsIncLintModuleTextRootedAtItsFolder(settings: Omit<LintRules, 'tsconfigRootDir'>): string {
  return `import { defineLintRules } from '${BUILT_PACKAGE}'

export const { eslint, oxlint } = defineLintRules({ tsconfigRootDir: import.meta.dirname, ...${JSON.stringify(settings, null, 2)} }).editorRulesets
`
}

/** The extensions of the JS and TS files a team's ESLint config reads with typescript-eslint's parser, unless it names others. */
export const TEAM_JS_AND_TS_EXTENSIONS: readonly string[] = ['js', 'ts']

/**
 * A team's ESLint config module, exporting `teamConfig`: the block of global ignores given, where
 * one is; its JS and TS files, of the extensions given, read by typescript-eslint's parser; its
 * .vue, .svelte and .astro files by a stand-in for a framework's parser, which parses the script
 * block's or frontmatter's lines and blanks the fence lines; and the rules given on in all of them,
 * typescript-eslint registered for its twins.
 */
export function teamEslintModuleText(
  rules: TeamEslintRules,
  jsAndTsExtensions: readonly string[] = TEAM_JS_AND_TS_EXTENSIONS,
  globalIgnores?: TeamGlobalIgnoresBlock,
): string {
  const jsAndTs = jsAndTsExtensions.join(',')
  const globalIgnoresBlock = globalIgnores === undefined ? '' : `\n  ${globalIgnoresBlockText(globalIgnores)},`
  return `import tseslint from 'typescript-eslint'

const FENCE_LINE = /^(?:<\\/?script[^>]*>|---)$/u

const scriptBlockParser = {
  meta: { name: 'script-block-stand-in' },
  parseForESLint: (text, options) =>
    tseslint.parser.parseForESLint(text.split('\\n').map((line) => (FENCE_LINE.test(line) ? '' : line)).join('\\n'), options),
}

export const teamConfig = [${globalIgnoresBlock}
  { name: 'team/js-and-ts', files: ['**/*.{${jsAndTs}}'], languageOptions: { parser: tseslint.parser } },
  { name: 'team/components', files: ['**/*.{vue,svelte,astro}'], languageOptions: { parser: scriptBlockParser } },
  {
    name: 'team/rules',
    files: ['**/*.{${jsAndTs},vue,svelte,astro}'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: ${JSON.stringify(rules)},
  },
]
`
}

/** The block as a team's config module writes it: named, its basePath first where it gives one, then its ignores, each function as its source. */
function globalIgnoresBlockText({ basePath, ignores }: TeamGlobalIgnoresBlock): string {
  const basePathText = basePath === undefined ? '' : ` basePath: ${JSON.stringify(basePath)},`
  return `{ name: 'team/global-ignores',${basePathText} ignores: [${ignores.map(ignoresEntryText).join(',')}] }`
}

function ignoresEntryText(entry: string | TeamIgnoresFunction): string {
  return typeof entry === 'string' ? JSON.stringify(entry) : entry.functionSource
}

/** A team ESLint config module exporting a `teamConfig` of the blocks given, each plain data: no plugin object, no parser. */
export function teamEslintModuleOfBlocksText(blocks: readonly Linter.Config[]): string {
  return `export const teamConfig = ${JSON.stringify(blocks, null, 2)}
`
}

/**
 * A team ESLint config module holding the imports given, and exporting a `teamConfig` of the blocks
 * given by their source: for a team config whose blocks hold what no JSON holds, a plugin it
 * registers itself or a resolver.
 */
export function teamEslintModuleOfBlockSourcesText(imports: readonly string[], blockSources: readonly string[]): string {
  return `${imports.join('\n')}

export const teamConfig = [
${blockSources.map((source) => `  ${source},`).join('\n')}
]
`
}

/** A block of plain data as a team's config module writes it. */
export function teamBlockSourceOf(block: Linter.Config): string {
  return JSON.stringify(block)
}

/** A team ESLint config module exporting a `teamConfig` with no block. */
export function emptyTeamEslintModuleText(): string {
  return 'export const teamConfig = []\n'
}

/**
 * An ESLint config file merging our ESLint part into the `teamConfig` the module given exports,
 * naming the team's oxlint config as the merge's third argument.
 */
export function mergedEslintConfigText(lintRulesModule: string, teamModule: string, teamOxlintConfig: TeamOxlintConfigPath): string {
  return `import { mergeEslintConfig } from '${BUILT_PACKAGE}/eslint'
import { eslint } from './${lintRulesModule}'
import { teamConfig } from './${teamModule}'

export default mergeEslintConfig(teamConfig, eslint, ${JSON.stringify(teamOxlintConfig)})
`
}

/**
 * An ESLint config file merging our ESLint part into the `teamConfig` the module given exports, as
 * mergedEslintConfigText does, and then adding the block given, by its source, which the merge is
 * never handed.
 */
export function eslintConfigAddingABlockAfterTheMergeText(
  lintRulesModule: string,
  teamModule: string,
  teamOxlintConfig: TeamOxlintConfigPath,
  blockSource: string,
): string {
  return `import { mergeEslintConfig } from '${BUILT_PACKAGE}/eslint'
import { eslint } from './${lintRulesModule}'
import { teamConfig } from './${teamModule}'

export default [...mergeEslintConfig(teamConfig, eslint, ${JSON.stringify(teamOxlintConfig)}), ${blockSource}]
`
}

/**
 * An ESLint config file merging our ESLint part into the `teamConfig` the module given exports
 * twice, as mergedEslintConfigText does, the second time with the block given, by its source, added:
 * a file that leaves no one config to read as the team's.
 */
export function eslintConfigCallingTheMergeTwiceText(
  lintRulesModule: string,
  teamModule: string,
  teamOxlintConfig: TeamOxlintConfigPath,
  blockSource: string,
): string {
  const thirdArgument = JSON.stringify(teamOxlintConfig)
  return `import { mergeEslintConfig } from '${BUILT_PACKAGE}/eslint'
import { eslint } from './${lintRulesModule}'
import { teamConfig } from './${teamModule}'

export default [
  ...mergeEslintConfig(teamConfig, eslint, ${thirdArgument}),
  ...mergeEslintConfig([...teamConfig, ${blockSource}], eslint, ${thirdArgument}),
]
`
}

/** An ESLint config file holding the `teamConfig` the module given exports, alone. */
export function teamAloneEslintConfigText(teamModule: string): string {
  return `import { teamConfig } from './${teamModule}'

export default teamConfig
`
}

/** An oxlint config file merging our oxlint part into the team config given, naming the team's ESLint config as the merge's third argument. */
export function mergedOxlintConfigText(lintRulesModule: string, teamConfig: OxlintConfig, teamEslintConfig: TeamEslintConfigPath): string {
  return `import { mergeOxlintConfig } from '${BUILT_PACKAGE}/oxlint'
import { oxlint } from './${lintRulesModule}'

export default mergeOxlintConfig(${JSON.stringify(teamConfig, null, 2)}, oxlint, ${JSON.stringify(teamEslintConfig)})
`
}

/** The file names of a project whose two engine configs each merge our part and name the other. */
export const CONSUMER_CONFIG_FILES = {
  lintRules: 'agents-inc.lint.mts',
  teamEslintModule: 'team.eslint.mjs',
  eslint: 'eslint.config.mjs',
  oxlint: 'oxlint.config.mts',
  teamAloneEslint: 'eslint.team-alone.mjs',
  teamAloneOxlint: 'oxlint.team-alone.json',
} as const

/**
 * A team's two configs: the ESLint blocks it adds, by their source, after a block reading its JS and
 * TS files with typescript-eslint's parser, and the imports those sources need beside
 * typescript-eslint's, where they need others; and its oxlint config, or null where the project has none.
 */
export type TeamConfigSources = {
  readonly eslintBlockSources: readonly string[]
  readonly eslintImports?: readonly string[]
  readonly oxlint: OxlintConfig | null
}

/**
 * A consumer's project, as plan.md lays it out: agents-inc.lint.mts holding the settings given,
 * rooted at its folder; an eslint.config.mjs and, where the team has one, an oxlint.config.mts, each
 * merging our part into the team's config and naming the other as the merge's third argument; and
 * the team's two configs alone, to lint with in their place.
 */
export function projectNamingEachConfigText(settings: Omit<LintRules, 'tsconfigRootDir'>, team: TeamConfigSources): Readonly<Record<string, string>> {
  const { lintRules, teamEslintModule, eslint, oxlint, teamAloneEslint, teamAloneOxlint } = CONSUMER_CONFIG_FILES
  const { eslintImports = [] } = team
  const eslintFiles = {
    [lintRules]: agentsIncLintModuleTextRootedAtItsFolder(settings),
    [teamEslintModule]: teamEslintModuleOfBlockSourcesText(
      [TYPESCRIPT_ESLINT_IMPORT, ...eslintImports],
      [TEAM_JS_AND_TS_PARSER_BLOCK, ...team.eslintBlockSources],
    ),
    [eslint]: mergedEslintConfigText(lintRules, teamEslintModule, { oxlintConfig: team.oxlint === null ? null : oxlint }),
    [teamAloneEslint]: teamAloneEslintConfigText(teamEslintModule),
  }
  if (team.oxlint === null) return eslintFiles
  return {
    ...eslintFiles,
    [oxlint]: mergedOxlintConfigText(lintRules, team.oxlint, { eslintConfig: eslint }),
    [teamAloneOxlint]: jsonFileText(team.oxlint),
  }
}

/** A team's ESLint config module: its file, and its text. */
export type TeamEslintModuleFile = { readonly file: string; readonly text: string }

/** A team ESLint config module exporting no block, under a name of its own. */
export const EMPTY_TEAM_ESLINT_MODULE_FILE: TeamEslintModuleFile = { file: 'empty-team.eslint.mjs', text: emptyTeamEslintModuleText() }

/** A project whose eslint.config.mjs merges our ESLint part: our settings, the team's module, and the team's oxlint config the merge names. */
export type OurEslintPartMerged = {
  readonly settings: Omit<LintRules, 'tsconfigRootDir'>
  readonly team: TeamEslintModuleFile
  /** One setting no rule, written into the project; or none, the project having no oxlint config. */
  readonly teamOxlint: 'setting no rule' | 'none'
}

/**
 * agents-inc.lint.mts holding the settings given, rooted at its folder; the team's ESLint module; an
 * eslint.config.mjs merging our ESLint part into it and naming the team's oxlint config; and that
 * config, where the project has one.
 */
export function projectMergingOurEslintPartText({ settings, team, teamOxlint }: OurEslintPartMerged): ProjectFiles {
  const { lintRules, eslint } = CONSUMER_CONFIG_FILES
  const teamOxlintConfig = teamOxlint === 'none' ? NO_TEAM_OXLINT_CONFIG : TEAM_OXLINT_CONFIG_SETTING_NO_RULE
  const teamOxlintFiles = teamOxlint === 'none' ? {} : teamOxlintConfigSettingNoRuleFiles
  return {
    [lintRules]: agentsIncLintModuleTextRootedAtItsFolder(settings),
    [eslint]: mergedEslintConfigText(lintRules, team.file, teamOxlintConfig),
    ...teamOxlintFiles,
    [team.file]: team.text,
  }
}
