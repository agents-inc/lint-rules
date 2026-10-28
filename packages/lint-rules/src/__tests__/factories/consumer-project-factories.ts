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

export type TeamEslintRules = Readonly<Record<string, string>>

/** A team's eslint.config.mjs may hold one where no glob says what it leaves out. */
export type TeamIgnoresFunction = { readonly functionSource: string }

/** Read from its basePath where it gives one. */
export type TeamGlobalIgnoresBlock = { readonly basePath?: string; readonly ignores: ReadonlyArray<string | TeamIgnoresFunction> }

const BUILT_PACKAGE = '@agents-inc/lint-rules'
const TYPESCRIPT_ESLINT_IMPORT = "import tseslint from 'typescript-eslint'"
// A team block reading every JS, TS and TSX file with typescript-eslint's parser, as its source.
const TEAM_JS_AND_TS_PARSER_BLOCK = "{ name: 'team/js-and-ts', files: ['**/*.{js,ts,tsx}'], languageOptions: { parser: tseslint.parser } }"

export function agentsIncLintModuleText(lintRules: LintRules): string {
  return `import { defineLintRules } from '${BUILT_PACKAGE}'

export const { eslint, oxlint } = defineLintRules(${JSON.stringify(lintRules, null, 2)}).editorRulesets
`
}

/**
* As `init` writes it, `tsconfigRootDir: import.meta.dirname`: for a project whose folder is not known when its
* files are written.
*/
export function agentsIncLintModuleTextRootedAtItsFolder(settings: Omit<LintRules, 'tsconfigRootDir'>): string {
  return `import { defineLintRules } from '${BUILT_PACKAGE}'

export const { eslint, oxlint } = defineLintRules({ tsconfigRootDir: import.meta.dirname, ...${JSON.stringify(settings, null, 2)} }).editorRulesets
`
}

/** Unless the team's config names others. */
const TEAM_JS_AND_TS_EXTENSIONS: readonly string[] = ['js', 'ts']

/**
* The team's .vue, .svelte and .astro files go through a stand-in parser that blanks the fence lines;
* typescript-eslint is registered for its twins.
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

function globalIgnoresBlockText({ basePath, ignores }: TeamGlobalIgnoresBlock): string {
  const basePathText = basePath === undefined ? '' : ` basePath: ${JSON.stringify(basePath)},`
  return `{ name: 'team/global-ignores',${basePathText} ignores: [${ignores.map(ignoresEntryText).join(',')}] }`
}

function ignoresEntryText(entry: string | TeamIgnoresFunction): string {
  return typeof entry === 'string' ? JSON.stringify(entry) : entry.functionSource
}

/** Each block plain data: no plugin object, no parser. */
export function teamEslintModuleOfBlocksText(blocks: readonly Linter.Config[]): string {
  return `export const teamConfig = ${JSON.stringify(blocks, null, 2)}
`
}

/** For blocks holding what no JSON holds: a plugin the team registers itself, or a resolver. */
export function teamEslintModuleOfBlockSourcesText(imports: readonly string[], blockSources: readonly string[]): string {
  return `${imports.join('\n')}

export const teamConfig = [
${blockSources.map((source) => `  ${source},`).join('\n')}
]
`
}

export function teamBlockSourceOf(block: Readonly<Linter.Config>): string {
  return JSON.stringify(block)
}

export function emptyTeamEslintModuleText(): string {
  return 'export const teamConfig = []\n'
}

/** Names the team's oxlint config as the merge's third argument. */
export function mergedEslintConfigText(lintRulesModule: string, teamModule: string, teamOxlintConfig: TeamOxlintConfigPath): string {
  return `import { mergeEslintConfig } from '${BUILT_PACKAGE}/eslint'
import { eslint } from './${lintRulesModule}'
import { teamConfig } from './${teamModule}'

export default mergeEslintConfig(teamConfig, eslint, ${JSON.stringify(teamOxlintConfig)})
`
}

/** Then adds a block the merge is never handed. */
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

/** Calls the merge twice, the second time with a block added: no one config reads as the team's. */
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

export function teamAloneEslintConfigText(teamModule: string): string {
  return `import { teamConfig } from './${teamModule}'

export default teamConfig
`
}

/** Names the team's ESLint config as the merge's third argument. */
export function mergedOxlintConfigText(lintRulesModule: string, teamConfig: Readonly<OxlintConfig>, teamEslintConfig: TeamEslintConfigPath): string {
  return `import { mergeOxlintConfig } from '${BUILT_PACKAGE}/oxlint'
import { oxlint } from './${lintRulesModule}'

export default mergeOxlintConfig(${JSON.stringify(teamConfig, null, 2)}, oxlint, ${JSON.stringify(teamEslintConfig)})
`
}

export const CONSUMER_CONFIG_FILES = {
  lintRules: 'agents-inc.lint.mts',
  teamEslintModule: 'team.eslint.mjs',
  eslint: 'eslint.config.mjs',
  oxlint: 'oxlint.config.mts',
  teamAloneEslint: 'eslint.team-alone.mjs',
  teamAloneOxlint: 'oxlint.team-alone.json',
} as const

/**
* The team's ESLint blocks, after one reading its JS and TS files with typescript-eslint's parser, and its
* oxlint config, null where it has none.
*/
export type TeamConfigSources = {
  readonly eslintBlockSources: readonly string[]
  readonly eslintImports?: readonly string[]
  readonly oxlint: OxlintConfig | null
}

/**
* As plan.md lays it out: each engine config merges our part into the team's and names the other; and the
* team's two configs alone, to lint with in their place.
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

export type TeamEslintModuleFile = { readonly file: string; readonly text: string }

export const EMPTY_TEAM_ESLINT_MODULE_FILE: TeamEslintModuleFile = { file: 'empty-team.eslint.mjs', text: emptyTeamEslintModuleText() }

export type OurEslintPartMerged = {
  readonly settings: Omit<LintRules, 'tsconfigRootDir'>
  readonly team: TeamEslintModuleFile
  /** One setting no rule, written into the project; or none, the project having no oxlint config. */
  readonly teamOxlint: 'setting no rule' | 'none'
}

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
