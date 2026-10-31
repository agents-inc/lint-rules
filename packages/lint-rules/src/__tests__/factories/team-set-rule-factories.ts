import type { ESLint, Linter } from 'eslint'
import tseslint from 'typescript-eslint'
import { installedEslintPlugin } from './eslint-merge-factories.ts'
import { buildTeamEslintBlock } from './team-config-factories.ts'

const TS_AND_TSX_FILES = ['**/*.ts', '**/*.tsx']
const TEAM_BLOCK = 'team'

/** The team's own block turning rules on over TS and TSX files, registering under each prefix given the plugin installed there, or none. */
export function buildTeamBlockSettingRules(rules: Readonly<Linter.RulesRecord>, prefixesRegistered: readonly string[]): Linter.Config {
  return buildTeamEslintBlock(TEAM_BLOCK, { files: TS_AND_TSX_FILES, plugins: pluginsAsShippedUnder(prefixesRegistered), rules: { ...rules } })
}

/** The team's blocks with nothing of ours: typescript-eslint's parser, and each plugin given registered as it ships, as the team's config must register them itself. */
export function buildTeamConfigAlone(teamBlocks: readonly Linter.Config[], prefixesRegistered: readonly string[]): Linter.Config[] {
  return [
    {
      name: 'the team alone',
      files: TS_AND_TSX_FILES,
      languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
      plugins: pluginsAsShippedUnder(prefixesRegistered),
    },
    ...teamBlocks,
  ]
}

function pluginsAsShippedUnder(prefixes: readonly string[]): Record<string, ESLint.Plugin> {
  return Object.fromEntries(prefixes.map((prefix) => [prefix, installedEslintPlugin(prefix)]))
}
