import { buildReportingPlugin } from '../factories/catalog-factories.ts'
import { buildEslintMergeShapeValue, type EslintMergeShapeValue, installedEslintPlugin } from '../factories/eslint-merge-factories.ts'
import type { Dimension } from '../pairwise-shapes.ts'

// The shapes the ESLint merge is checked in against ESLint's own calculated config, each a dimension. The team's
// config is one block, so no shape runs two names of a rule by the team's own choice.

const ARRAY_TYPE = '@typescript-eslint/array-type'
const TYPESCRIPT_ESLINT = '@typescript-eslint'
const ESLINT_REACT = '@eslint-react'
// The prefix antfu's eslint-config registers typescript-eslint under.
const TEAMS_TYPESCRIPT_ESLINT_PREFIX = 'ts'
// typescript-eslint's array-type under `generic` reports what our shipped `array-simple` leaves.
const GENERIC_ARRAY_TYPE = [{ default: 'generic' }]
// Where our entries apply: inside the folder a team block names, so the two scopes cross.
const OUR_ENTRY_FILES = ['legacy/old/**']
const NO_TEAMS_PREFIXES: ReadonlyMap<string, readonly string[]> = new Map()

export const ESLINT_MERGE_FILES = [
  'src/a.ts',
  'src/a.js',
  'src/vendor/a.ts',
  'legacy/a.ts',
  'legacy/a.js',
  'legacy/keep/a.ts',
  'legacy/old/a.ts',
  'legacy/vendor/a.ts',
]

// The name a team states each rule by. With oxlint, import-x/first is oxlint's, so its alias is off across
// engines. The team registers the installed plugin, so its options and defaults are the ones the merge reads.
const TEAM_STATES_ITS_OWN_ID = buildEslintMergeShapeValue('the team states our rule by its own ID', {
  team: {
    stating: {
      ours: ARRAY_TYPE,
      teams: ARRAY_TYPE,
      plugins: { [TYPESCRIPT_ESLINT]: installedEslintPlugin(TYPESCRIPT_ESLINT) },
      options: GENERIC_ARRAY_TYPE,
      teamsPrefixes: NO_TEAMS_PREFIXES,
    },
  },
})
const TEAM_STATES_AN_ALIAS = buildEslintMergeShapeValue("the team states our rule's alias", {
  team: {
    stating: {
      ours: 'import-x/first',
      teams: 'import/first',
      plugins: { import: buildReportingPlugin(['first']) },
      options: ['disable-absolute-first'],
      teamsPrefixes: NO_TEAMS_PREFIXES,
    },
  },
})
const TEAM_STATES_AN_OLD_NAME = buildEslintMergeShapeValue("the team states our renamed rule's old name, which our plugin no longer defines", {
  team: {
    stating: {
      ours: 'unicorn/no-for-each',
      teams: 'unicorn/no-array-for-each',
      plugins: { unicorn: buildReportingPlugin(['no-array-for-each']) },
      options: [{ checkTeamOption: true }],
      teamsPrefixes: NO_TEAMS_PREFIXES,
    },
  },
})
const TEAM_STATES_A_SAME_MODULE_NAME = buildEslintMergeShapeValue('the team states the other name our plugin binds our rule to', {
  team: {
    stating: {
      ours: '@eslint-react/x-no-missing-key',
      teams: '@eslint-react/no-missing-key',
      plugins: { [ESLINT_REACT]: installedEslintPlugin(ESLINT_REACT) },
      // The rule takes no options.
      options: [],
      teamsPrefixes: NO_TEAMS_PREFIXES,
    },
  },
})
const TEAM_STATES_ITS_PREFIX_NAME = buildEslintMergeShapeValue("the team states our rule under the team's own prefix for our plugin", {
  team: {
    stating: {
      ours: ARRAY_TYPE,
      teams: `${TEAMS_TYPESCRIPT_ESLINT_PREFIX}/array-type`,
      plugins: { [TEAMS_TYPESCRIPT_ESLINT_PREFIX]: installedEslintPlugin(TYPESCRIPT_ESLINT) },
      options: GENERIC_ARRAY_TYPE,
      teamsPrefixes: new Map([[TYPESCRIPT_ESLINT, [TEAMS_TYPESCRIPT_ESLINT_PREFIX]]]),
    },
  },
})
const TEAM_STATES_A_TWIN = buildEslintMergeShapeValue("the team states typescript-eslint's twin of our rule", {
  team: {
    stating: {
      ours: 'prefer-promise-reject-errors',
      teams: '@typescript-eslint/prefer-promise-reject-errors',
      plugins: { [TYPESCRIPT_ESLINT]: installedEslintPlugin(TYPESCRIPT_ESLINT) },
      options: [{ allowEmptyReject: true }],
      teamsPrefixes: NO_TEAMS_PREFIXES,
    },
  },
})

const IN_EVERY_FILE = buildEslintMergeShapeValue('in every file', { team: { scope: {} } })
const IN_THE_FILES_IT_NAMES = buildEslintMergeShapeValue('in the files it names', { team: { scope: { files: ['legacy/**'] } } })
const OUTSIDE_ITS_IGNORES = buildEslintMergeShapeValue('outside its ignores, a negation taking a folder back', {
  team: { scope: { files: ['**/*.{ts,js}'], ignores: ['legacy/**', '!legacy/keep/**'] } },
})
const UNDER_ITS_BASE_PATH = buildEslintMergeShapeValue('in the files it names under its basePath', {
  team: { scope: { basePath: 'legacy', files: ['**/*.ts'] } },
})

const A_BARE_SEVERITY = buildEslintMergeShapeValue('a bare severity', { team: { entryOf: () => 'warn' } })
const A_FULL_ENTRY = buildEslintMergeShapeValue('a full entry', { team: { entryOf: (options) => ['error', ...options] } })
const OFF = buildEslintMergeShapeValue('off', { team: { entryOf: () => 'off' } })

const OUR_RULES_LEAVE_IT_OUT = buildEslintMergeShapeValue('our top-level rules leave it out', { ours: {} })
const OUR_RULES_TURN_IT_ON = buildEslintMergeShapeValue('our top-level rules turn it on', { ours: { topLevel: 'error' } })
const OUR_RULES_TURN_IT_OFF = buildEslintMergeShapeValue('our top-level rules turn it off', { ours: { topLevel: 'off' } })

const NO_ENTRY_OF_OURS = buildEslintMergeShapeValue('no entry of ours states it', { ours: {} })
const AN_ENTRY_OF_OURS_TURNS_IT_ON = buildEslintMergeShapeValue('an entry of ours turns it on', {
  ours: { entry: { files: OUR_ENTRY_FILES, severity: 'warn' } },
})
const AN_ENTRY_OF_OURS_TURNS_IT_OFF = buildEslintMergeShapeValue('an entry of ours turns it off', {
  ours: { entry: { files: OUR_ENTRY_FILES, severity: 'off' } },
})

const NO_IGNORES_OF_OURS = buildEslintMergeShapeValue('no ignores of ours', { ours: {} })
const OUR_IGNORES = buildEslintMergeShapeValue('our ignores name the vendor folders', { ours: { ignores: ['**/vendor/**'] } })
// Folder-style values, which the agent build's global ignores read as every file under the folder: one bare,
// which matches at any depth, and one with a trailing slash.
const OUR_IGNORES_A_FOLDER_BY_NAME = buildEslintMergeShapeValue('our ignores name the vendor folders bare, as vendor', {
  ours: { ignores: ['vendor'] },
})
const OUR_IGNORES_A_FOLDER_WITH_A_TRAILING_SLASH = buildEslintMergeShapeValue('our ignores name one vendor folder with a trailing slash, as legacy/vendor/', {
  ours: { ignores: ['legacy/vendor/'] },
})
// A name ending in its only slash: every folder of that name in both engines.
const OUR_IGNORES_A_FOLDER_ENDING_IN_ITS_ONLY_SLASH = buildEslintMergeShapeValue('our ignores name the vendor folders by vendor/, every folder of that name', {
  ours: { ignores: ['vendor/'] },
})

export const ESLINT_MERGE_DIMENSIONS: readonly Dimension<EslintMergeShapeValue>[] = [
  {
    name: 'the name the team states',
    values: [
      TEAM_STATES_ITS_OWN_ID,
      TEAM_STATES_AN_ALIAS,
      TEAM_STATES_AN_OLD_NAME,
      TEAM_STATES_A_SAME_MODULE_NAME,
      TEAM_STATES_ITS_PREFIX_NAME,
      TEAM_STATES_A_TWIN,
    ],
  },
  { name: "where the team's block applies", values: [IN_EVERY_FILE, IN_THE_FILES_IT_NAMES, OUTSIDE_ITS_IGNORES, UNDER_ITS_BASE_PATH] },
  { name: "the team's entry", values: [A_BARE_SEVERITY, A_FULL_ENTRY, OFF] },
  { name: 'our top-level rules', values: [OUR_RULES_LEAVE_IT_OUT, OUR_RULES_TURN_IT_ON, OUR_RULES_TURN_IT_OFF] },
  { name: 'an entry of ours', values: [NO_ENTRY_OF_OURS, AN_ENTRY_OF_OURS_TURNS_IT_ON, AN_ENTRY_OF_OURS_TURNS_IT_OFF] },
  {
    name: 'our ignores',
    values: [
      NO_IGNORES_OF_OURS,
      OUR_IGNORES,
      OUR_IGNORES_A_FOLDER_BY_NAME,
      OUR_IGNORES_A_FOLDER_WITH_A_TRAILING_SLASH,
      OUR_IGNORES_A_FOLDER_ENDING_IN_ITS_ONLY_SLASH,
    ],
  },
]

/**
* Shapes that would show a leak: a bare team severity after our entry keeps our options there (measured, ESLint
* 10.12); a twin the team states where ours runs; ours in a vendor folder only a bare folder ignore keeps it out
* of; and a team alias of a rule our oxlint part runs, beside vendor ignores each engine reads differently.
*/
export const ESLINT_MERGE_SEEDS: readonly (readonly EslintMergeShapeValue[])[] = [
  [TEAM_STATES_ITS_OWN_ID, IN_EVERY_FILE, A_BARE_SEVERITY, OUR_RULES_TURN_IT_ON],
  [TEAM_STATES_ITS_OWN_ID, IN_THE_FILES_IT_NAMES, A_BARE_SEVERITY, AN_ENTRY_OF_OURS_TURNS_IT_ON],
  [TEAM_STATES_ITS_PREFIX_NAME, IN_EVERY_FILE, A_BARE_SEVERITY, OUR_RULES_TURN_IT_ON],
  [TEAM_STATES_A_TWIN, IN_EVERY_FILE, A_FULL_ENTRY, OUR_RULES_TURN_IT_ON],
  [TEAM_STATES_ITS_OWN_ID, UNDER_ITS_BASE_PATH, A_FULL_ENTRY, OUR_RULES_TURN_IT_ON, OUR_IGNORES_A_FOLDER_BY_NAME],
  [TEAM_STATES_AN_ALIAS, IN_EVERY_FILE, A_FULL_ENTRY, OUR_RULES_TURN_IT_ON, OUR_IGNORES_A_FOLDER_ENDING_IN_ITS_ONLY_SLASH],
]
