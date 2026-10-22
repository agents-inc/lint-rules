import { isDeepStrictEqual } from 'node:util'
import { catalog, type RuleRoute } from '@workspace/rule-data'
import type { DummyRuleMap, OxlintConfig, OxlintOverride } from 'oxlint'
import { describe, expect, it } from 'vitest'
import { oxlintPartOf } from './__tests__/agent-configs.ts'
import { buildConsumerLintRules, buildEveryRulesetLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOthers, buildPackageJsonListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { buildTeamOxlintConfig } from './__tests__/factories/team-config-factories.ts'
import { isIgnoredByOxlintConfig, oxlintConfigForFile, oxlintEntryOfRuleFor, oxlintSeverityFor, severityOfOxlintEntry } from './__tests__/oxlint-config-oracle.ts'
import { oxlintPartAlone } from './__tests__/oxlint-part-alone.ts'
import { oxlintRuleKeyedBy } from './__tests__/oxlint-rule-keys.ts'
import { rulesOnInOxlint } from './__tests__/rules-on-engines.ts'
import { NO_TEAM_ESLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { INSTALLED_OXLINT, setUpTempProjects } from './__tests__/temp-projects.ts'
import type { EditorParts, OxlintPart } from './core/editor-parts.ts'
import { ruleIdsOnIn } from './core/resolve-rule-layers.ts'
import { defineLintRules, type LintRules } from './index.ts'
import { mergeOxlintConfig } from './oxlint.ts'

// In line: the compensations for listing every plugin at the root, then ours, on-statements only, then
// the team's extended overrides and its own; where the team extends objects, the first two go in a
// first extended config. This spec reads the merged object; the integration and differential tests
// measure what the engine does with it.

type SharedFields = Partial<Omit<LintRules, 'tsconfigRootDir' | 'agentRulesets' | 'editorRulesets'>>

/** The rulesets our editor part lists: none unless given. */
type OurRulesets = Parameters<typeof buildConsumerLintRules>[1]

/** A rule key and its entry, as an override of the merged config states it. */
type Statement = readonly [key: string, entry: DummyRuleMap[string]]

/** What a part of the merged overrides is, by the place the precedence contract gives it. */
type PartOfTheMerge = 'ours' | "the team's" | 'none of these'

const OXLINT_DEFAULT_PLUGINS = ['oxc', 'typescript', 'unicorn']
const ARRAY_TYPE = '@typescript-eslint/array-type'
const JSX_KEY = 'react/jsx-key'
const NO_DEBUGGER = 'no-debugger'
// ESLint runs it for us, in .tsx and .jsx files but tests, and oxlint has it too.
const MAX_LINES = 'max-lines'
// A core rule oxlint runs for us, in a category no team config here turns on.
const NO_WARNING_COMMENTS = 'no-warning-comments'
// It ships ignoring test files.
const NO_NON_NULL_ASSERTION = '@typescript-eslint/no-non-null-assertion'
// A bare name oxlint reads as typescript's rule, before unicorn's of the same name (parse_rule_key,
// oxlint 1.87): a type-aware rule, which runs only with type information.
const BARE_NAME_OF_A_TYPE_AWARE_RULE = 'prefer-string-starts-ends-with'
const TYPESCRIPTS_RULE_OF_THAT_NAME = 'typescript/prefer-string-starts-ends-with'
const TEST_TSX_FILES = ['**/*.test.tsx']
// A team root listing the plugin of every rule our parts in these specs state, oxlint's or ESLint's,
// so the merge lists no plugin the team's root does not, and writes no compensation.
const ROOT_LISTING_EVERY_PLUGIN_OF_OURS: OxlintConfig['plugins'] = ['oxc', 'promise', 'react', 'typescript', 'unicorn']
// Files the specs read the merged config in: in and out of our entry for lib/**, our ignores of
// dist/**, and the test files no-non-null-assertion ships ignoring.
const FILES_READ = ['src/a.ts', 'src/f.tsx', 'src/f.test.tsx', 'lib/b.ts', 'lib/m.tsx', 'dist/c.ts', 'dist/d.tsx']
const RUNNING_SEVERITIES: ReadonlySet<string | undefined> = new Set(['warn', 'error'])
const REACT_VERSION = '18.3.0'
const TEAMS_REACT_VERSION = '16.2.0'
const TEAM_LINK_COMPONENT = 'Link'
const TEAM_NEXT_ROOT_DIRS = ['apps/web']
// Each is no object where oxlint takes one, and oxlint alone refuses it (measured, oxlint 1.87).
const SETTINGS_OXLINT_REFUSES = [
  { what: 'they are null', settings: null },
  { what: 'they are a string', settings: TEAMS_REACT_VERSION },
  { what: 'the react settings are null', settings: { react: null } },
  { what: 'the react settings are the version alone', settings: { react: TEAMS_REACT_VERSION } },
  { what: 'the react settings are an array', settings: { react: [TEAMS_REACT_VERSION] } },
]

const TEAM_CONFIG = buildTeamOxlintConfig({
  plugins: ['import'],
  categories: { correctness: 'error', suspicious: 'warn' },
  rules: { 'eslint/no-debugger': 'error', 'local/no-direct-fetch': 'error' },
  env: { browser: false, vitest: true },
  globals: { __APP__: 'readonly' },
  settings: { react: { version: '19.0.0' } },
  jsPlugins: ['./lint/local-plugin.js'],
  extends: [{ rules: { 'eslint/no-console': 'warn' } }],
  ignorePatterns: ['generated/**'],
  overrides: [{ files: ['**/*.test.ts'], rules: { 'eslint/no-debugger': 'off' } }],
  options: { typeAware: false },
})

const tempProjects = setUpTempProjects()
const PROJECT_WITH_OXLINT = tempProjects.create({
  files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()) },
  linkedPackages: [INSTALLED_OXLINT],
})
const PROJECT_WITHOUT_OXLINT = tempProjects.create({
  files: { 'package.json': packageJsonText(buildPackageJsonListingOthers()) },
  linkedPackages: [INSTALLED_OXLINT],
})

/** Our editor parts for a config listing the rulesets given, none unless given, with these shared settings. */
function ourEditorParts(fields: SharedFields, rulesets: OurRulesets = {}): EditorParts {
  return defineLintRules(buildConsumerLintRules(PROJECT_WITH_OXLINT, rulesets, fields)).editorRulesets
}

/** Our editor oxlint part for a config listing no ruleset, with these shared settings, merged into the team's config. */
function mergedEditorOxlintConfig(projectDir: string, fields: SharedFields, teamConfig: OxlintConfig): OxlintConfig {
  const { oxlint } = defineLintRules(buildConsumerLintRules(projectDir, {}, fields)).editorRulesets
  return mergeOxlintConfig(teamConfig, oxlint, NO_TEAM_ESLINT_CONFIG)
}

function overridesOf({ overrides }: OxlintConfig): NonNullable<OxlintConfig['overrides']> {
  if (overrides === undefined) throw new Error('the merged config has no overrides')
  return overrides
}

function pluginsOf({ plugins }: OxlintConfig): NonNullable<OxlintConfig['plugins']> {
  if (plugins === undefined) throw new Error('the merged config lists no plugins')
  return plugins
}

function ignorePatternsOf({ ignorePatterns }: OxlintConfig): string[] {
  if (ignorePatterns === undefined) throw new Error('the merged config has no ignorePatterns')
  return ignorePatterns
}

/** The objects the merged config extends: a JSON config's paths are not the merge's to write. */
function extendedObjectsOf({ extends: extended }: OxlintConfig): OxlintConfig[] {
  if (extended === undefined) throw new Error('the merged config extends no config')
  return extended.filter((each): each is OxlintConfig => typeof each !== 'string')
}

/** The first object the merged config extends, which oxlint applies before any other. */
function firstExtendedObjectOf(config: OxlintConfig): OxlintConfig {
  const [first] = extendedObjectsOf(config)
  if (first === undefined) throw new Error('the merged config extends no object')
  return first
}

/** The config's entry of each key the rule has in oxlint, in the file: oxlint reads any of them as the rule. */
function entriesOfTheRuleIn(config: OxlintConfig, file: string, ruleId: string): Readonly<Record<string, unknown>> {
  const { rules } = oxlintConfigForFile(config, file)
  return Object.fromEntries(Object.entries(rules).filter(([key]) => routeOf(ruleId).oxlintSpellings.includes(key)))
}

/** The entry oxlint applies to the rule in the file, whichever of its keys states it last. */
function entryOfTheRuleIn(config: OxlintConfig, file: string, ruleId: string): unknown {
  return oxlintEntryOfRuleFor(config, file, routeOf(ruleId).oxlintSpellings)
}

/** Every override of the config, as oxlint lines them up: those of the configs it extends as objects first. */
function overridesInLine(config: OxlintConfig): OxlintOverride[] {
  const { extends: extended = [], overrides = [] } = config
  return [...extended.filter((each): each is OxlintConfig => typeof each !== 'string').flatMap(overridesInLine), ...overrides]
}

function statementsOf(overrides: readonly OxlintOverride[]): Statement[] {
  return overrides.flatMap(({ rules = {} }) => Object.entries(rules))
}

/** The RuleId oxlint reads a key the merge wrote as: every key the merge writes names a rule of oxlint's. */
function ruleIdKeyedBy(key: string): string {
  const rule = oxlintRuleKeyedBy(key, catalog)
  if (rule === undefined) throw new Error(`${key} names no rule of oxlint's`)
  return rule.id
}

/** The RuleIds the overrides state off, once each and sorted. */
function ruleIdsStatedOffIn(overrides: readonly OxlintOverride[]): string[] {
  const statedOff = statementsOf(overrides).filter(([, entry]) => severityOfOxlintEntry(entry) === 'off')
  return [...new Set(statedOff.map(([key]) => ruleIdKeyedBy(key)))].toSorted()
}

/** The part of the merge an override is, read from what it states. */
function partOfTheMergeIn(override: OxlintOverride, teamOverrides: readonly OxlintOverride[], parts: EditorParts): PartOfTheMerge {
  if (teamOverrides.some((teams) => isDeepStrictEqual(teams, override))) return "the team's"
  const ourRuleIds = ruleIdsOnIn(oxlintPartOf(parts).layers)
  const isOurs = ([key, entry]: Statement): boolean => severityOfOxlintEntry(entry) !== 'off' && ourRuleIds.includes(ruleIdKeyedBy(key))
  // An override of the merge's stating no rule carries our env.
  return statementsOf([override]).every(isOurs) ? 'ours' : 'none of these'
}

/** The parts of the merge the overrides are, in order, each run of one part once. */
function partsOfTheMergeIn(overrides: readonly OxlintOverride[], teamOverrides: readonly OxlintOverride[], parts: EditorParts): PartOfTheMerge[] {
  const each = overrides.map((override) => partOfTheMergeIn(override, teamOverrides, parts))
  return each.filter((part, index) => each[index - 1] !== part)
}

/**
 * Each rule our oxlint part runs, in each file read, at the entry our part alone gives it there, and
 * undefined where it does not run it: off, outside its files, or under our ignores.
 */
function entriesOursAloneRuns(part: OxlintPart): Readonly<Record<string, unknown>> {
  const alone = oxlintPartAlone(part, catalog)
  const runsIn = (file: string, oxlintName: string): boolean =>
    !isIgnoredByOxlintConfig(alone, file) && RUNNING_SEVERITIES.has(oxlintSeverityFor(alone, file, oxlintName))
  return Object.fromEntries(
    FILES_READ.flatMap((file) =>
      oxlintNamesOfRulesOurPartRuns(part).map((oxlintName): [string, unknown] => [
        `${file} ${oxlintName}`,
        runsIn(file, oxlintName) ? oxlintConfigForFile(alone, file).rules[oxlintName] : undefined,
      ]),
    ),
  )
}

/** The merged config's entry of each rule our oxlint part runs, in each file read, under the key our part gives it. */
function entriesOfOurRulesIn(merged: OxlintConfig, part: OxlintPart): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    FILES_READ.flatMap((file) =>
      oxlintNamesOfRulesOurPartRuns(part).map((oxlintName): [string, unknown] => [`${file} ${oxlintName}`, oxlintConfigForFile(merged, file).rules[oxlintName]]),
    ),
  )
}

function oxlintNamesOfRulesOurPartRuns({ layers }: OxlintPart): string[] {
  return ruleIdsOnIn(layers).map((id) => oxlintNameOf(id))
}

describe('mergeOxlintConfig, given a team config setting every key', () => {
  const fields = {
    ignores: ['dist/**'],
    rules: { 'no-debugger': 'error', [NO_WARNING_COMMENTS]: 'error', [ARRAY_TYPE]: 'error' },
    fileOverrides: [{ files: ['legacy/**'], rules: { 'no-debugger': 'off' } }],
  } satisfies SharedFields
  const merged = (): OxlintConfig => mergedEditorOxlintConfig(PROJECT_WITH_OXLINT, fields, TEAM_CONFIG)

  it('keeps the categories, rules, env, globals, settings and jsPlugins of the team, untouched, and extends its objects after a first one of ours', () => {
    const config = merged()
    const { categories, rules, env, globals, settings, jsPlugins } = config
    const oursFirst = firstExtendedObjectOf(config)

    expect({
      categories,
      rules,
      env,
      globals,
      settings,
      jsPlugins,
      extends: {
        oursFirst: oxlintSeverityFor({ extends: [oursFirst] }, 'src/a.ts', oxlintNameOf(NO_WARNING_COMMENTS)),
        theTeams: extendedObjectsOf(config).slice(1),
      },
    }).toStrictEqual({
      categories: TEAM_CONFIG.categories,
      rules: TEAM_CONFIG.rules,
      env: TEAM_CONFIG.env,
      globals: TEAM_CONFIG.globals,
      settings: TEAM_CONFIG.settings,
      jsPlugins: TEAM_CONFIG.jsPlugins,
      extends: { oursFirst: 'error', theTeams: TEAM_CONFIG.extends },
    })
  })

  it("lists the team's plugins and the plugin of every rule the merged config turns on", () => {
    const config = merged()
    const listed: readonly string[] = pluginsOf(config)
    const pluginsOfRulesOn = rulesOnInOxlint(config).map(({ id }) => oxlintPluginOf(id))

    expect([...new Set(['import', ...pluginsOfRulesOn])].filter((plugin) => !listed.includes(plugin))).toStrictEqual([])
  })

  // Our ignores remove only our rules from their files: they go on our overrides.
  it("keeps the team's ignore patterns exactly, adding none of ours", () => {
    expect(ignorePatternsOf(merged())).toStrictEqual(TEAM_CONFIG.ignorePatterns)
  })

  // Our part runs react-hooks/rule-suppression and unicorn/no-abusive-eslint-disable, as the editor parts
  // allow suppressions, and the team's root lists neither plugin: the compensations for listing them come first.
  it("puts ours first in line, in a first extended config, then the team's overrides, and nothing after them", () => {
    const config = merged()
    const parts = ourEditorParts(fields)
    const { overrides: firstInLine = [] } = firstExtendedObjectOf(config)

    expect({
      firstInLine: partsOfTheMergeIn(firstInLine, [], parts),
      own: partsOfTheMergeIn(overridesOf(config), overridesOf(TEAM_CONFIG), parts),
    }).toStrictEqual({ firstInLine: ['none of these', 'ours'], own: ["the team's"] })
  })

  // oxlint refuses options in any config below the one it starts from, so an option of ours there would stop it linting.
  it("keeps the team's options as written, adding none", () => {
    expect(merged().options).toStrictEqual({ typeAware: false })
  })

  // The team's root states eslint/no-debugger, which oxlint reads as our no-debugger.
  it("leaves our rule to the team's entry where the team's root states it under another spelling, stating none of ours", () => {
    const config = merged()

    expect({
      everywhere: entriesOfTheRuleIn(config, 'src/deep/a.ts', NO_DEBUGGER),
      inTheTeamsOverride: entriesOfTheRuleIn(config, 'src/a.test.ts', NO_DEBUGGER),
    }).toStrictEqual({ everywhere: { 'eslint/no-debugger': 'error' }, inTheTeamsOverride: { 'eslint/no-debugger': 'off' } })
  })

  it('puts a rule of ours the team does not set, with its options, where it applies to any file', () => {
    const config = mergedEditorOxlintConfig(PROJECT_WITH_OXLINT, { rules: { [NO_WARNING_COMMENTS]: ['error', { terms: ['hack'] }] } }, TEAM_CONFIG)

    expect(entriesOfTheRuleIn(config, 'src/deep/a.ts', NO_WARNING_COMMENTS)).toStrictEqual({ [NO_WARNING_COMMENTS]: ['error', { terms: ['hack'] }] })
  })

  // ESLint runs it for us, and the team does not set it: no copy of it is turned off across engines.
  it('states, in no oxlint spelling, an ESLint-run rule of ours that oxlint has', () => {
    const applied = oxlintConfigForFile(merged(), 'src/a.ts').rules

    expect(routeOf(ARRAY_TYPE).oxlintSpellings.filter((spelling) => spelling in applied)).toStrictEqual([])
  })

  // Our top-level rules turning a rule off remove only ours.
  it("leaves the team's setting of a rule our top-level rules turn off", () => {
    const config = mergedEditorOxlintConfig(
      PROJECT_WITH_OXLINT,
      { rules: { 'no-debugger': 'off' } },
      buildTeamOxlintConfig({ rules: { 'no-debugger': 'error' } }),
    )

    expect(oxlintConfigForFile(config, 'src/a.ts').rules['no-debugger']).toBe('error')
  })
})

// No oxlint run shows a type-aware rule's statement counting without type information, so this
// spec reads the config resolved for a file.
describe("mergeOxlintConfig, given a bare name at the team's root that oxlint reads as typescript's type-aware rule", () => {
  // Our part runs a rule of typescript's, so the merged root lists typescript.
  it("turns typescript's rule off in every file where the team's root lists no typescript, as oxlint ignores the statement for the team", () => {
    const config = mergedEditorOxlintConfig(
      PROJECT_WITH_OXLINT,
      { rules: { [NO_NON_NULL_ASSERTION]: 'error' } },
      buildTeamOxlintConfig({ plugins: ['oxc', 'unicorn'], rules: { [BARE_NAME_OF_A_TYPE_AWARE_RULE]: 'error' } }),
    )

    expect(oxlintConfigForFile(config, 'src/a.ts').rules[TYPESCRIPTS_RULE_OF_THAT_NAME]).toBe('off')
  })

  it("leaves typescript's rule to the team's statement where the team's root lists typescript", () => {
    const config = mergedEditorOxlintConfig(
      PROJECT_WITH_OXLINT,
      { rules: { [NO_NON_NULL_ASSERTION]: 'error' } },
      buildTeamOxlintConfig({ plugins: ['oxc', 'typescript', 'unicorn'], rules: { [BARE_NAME_OF_A_TYPE_AWARE_RULE]: 'error' } }),
    )

    expect(oxlintConfigForFile(config, 'src/a.ts').rules[TYPESCRIPTS_RULE_OF_THAT_NAME]).toBeUndefined()
  })
})

describe('mergeOxlintConfig, given a team config leaving out plugins', () => {
  it("lists oxlint's default plugins, which the team's config runs, beside ours", () => {
    const listed: readonly string[] = pluginsOf(
      mergedEditorOxlintConfig(PROJECT_WITH_OXLINT, { rules: { 'no-debugger': 'error' } }, buildTeamOxlintConfig()),
    )

    expect(OXLINT_DEFAULT_PLUGINS.filter((plugin) => !listed.includes(plugin))).toStrictEqual([])
  })

  it('sets no categories, so oxlint keeps its default ones on for the team', () => {
    expect(mergedEditorOxlintConfig(PROJECT_WITH_OXLINT, {}, buildTeamOxlintConfig()).categories).toBeUndefined()
  })
})

// The team's setting of a rule our part states, wherever oxlint counts it, makes the rule the team's in
// every file; a statement oxlint ignores for the team changes nothing.
describe('mergeOxlintConfig, given a team config stating a rule our part runs', () => {
  const ours = { rules: { [JSX_KEY]: 'error' } } satisfies SharedFields

  it.each([
    {
      where: "at its root, under another spelling, with options of the team's",
      team: buildTeamOxlintConfig({ plugins: ['react'], rules: { 'react-hooks/jsx-key': ['warn', { checkFragmentShorthand: true }] } }),
    },
    {
      where: 'at the root of a config it extends',
      team: buildTeamOxlintConfig({ plugins: ['react'], extends: [{ plugins: [], rules: { [JSX_KEY]: 'warn' } }] }),
    },
  ])('states no statement of ours of it in any override, where the team states it $where', ({ team }) => {
    const config = mergedEditorOxlintConfig(PROJECT_WITH_OXLINT, ours, team)

    expect(statementsOf(overridesInLine(config)).filter(([key]) => ruleIdKeyedBy(key) === JSX_KEY)).toStrictEqual([])
  })

  it("runs ours of it where the team's root states it of a plugin the root does not list, which oxlint ignores", () => {
    const config = mergedEditorOxlintConfig(PROJECT_WITH_OXLINT, ours, buildTeamOxlintConfig({ plugins: ['oxc'], rules: { [JSX_KEY]: 'warn' } }))

    expect(oxlintConfigForFile(config, 'src/f.tsx').rules[JSX_KEY]).toStrictEqual(['error'])
  })

  // Elsewhere, no entry of ours. Where the team lists react in the override alone, the merge lists it at
  // the root, which runs react's correctness rules in every file, so jsx-key is turned off again where
  // the team's config alone does not run it (measured, oxlint 1.87).
  it.each([
    {
      where: 'in an override of its own, of a plugin its root lists',
      team: buildTeamOxlintConfig({ plugins: ['react'], overrides: [{ files: TEST_TSX_FILES, rules: { [JSX_KEY]: 'off' } }] }),
      theTeams: 'off',
      elsewhere: undefined,
    },
    {
      where: 'in an override listing the plugin',
      team: buildTeamOxlintConfig({ plugins: [], overrides: [{ files: TEST_TSX_FILES, plugins: ['react'], rules: { [JSX_KEY]: ['warn'] } }] }),
      theTeams: ['warn'],
      elsewhere: 'off',
    },
    {
      where: 'in an override of a config it extends',
      team: buildTeamOxlintConfig({ plugins: ['react'], extends: [{ plugins: [], overrides: [{ files: TEST_TSX_FILES, rules: { [JSX_KEY]: 'off' } }] }] }),
      theTeams: 'off',
      elsewhere: undefined,
    },
  ])("gives it the team's entry in the override's files, and no entry of ours elsewhere, where the team states it $where", ({ team, theTeams, elsewhere }) => {
    const config = mergedEditorOxlintConfig(PROJECT_WITH_OXLINT, ours, team)

    expect({
      inTheTeamsFiles: oxlintConfigForFile(config, 'src/f.test.tsx').rules[JSX_KEY],
      elsewhere: oxlintConfigForFile(config, 'src/f.tsx').rules[JSX_KEY],
    }).toStrictEqual({ inTheTeamsFiles: theTeams, elsewhere })
  })

  it('gives it our entry where an override of the team states it of a plugin neither the root nor the override lists, which oxlint ignores', () => {
    const config = mergedEditorOxlintConfig(
      PROJECT_WITH_OXLINT,
      ours,
      buildTeamOxlintConfig({ plugins: [], overrides: [{ files: TEST_TSX_FILES, rules: { [JSX_KEY]: 'off' } }] }),
    )

    expect(oxlintConfigForFile(config, 'src/f.test.tsx').rules[JSX_KEY]).toStrictEqual(['error'])
  })

  it('gives it our entry where an override of a config the team extends states it of a plugin no root nor the override lists, which oxlint ignores', () => {
    const config = mergedEditorOxlintConfig(
      PROJECT_WITH_OXLINT,
      ours,
      buildTeamOxlintConfig({ plugins: [], extends: [{ plugins: [], overrides: [{ files: TEST_TSX_FILES, rules: { [JSX_KEY]: 'off' } }] }] }),
    )

    expect(oxlintConfigForFile(config, 'src/f.test.tsx').rules[JSX_KEY]).toStrictEqual(['error'])
  })
})

// Each rule of ours is on exactly where our part alone runs it, with its options there, through
// `files` and `excludeFiles`: no `off` of ours is written. The team's root lists every plugin of ours
// and turns every category off, so no compensation is written either.
describe('the overrides mergeOxlintConfig writes, beside a team config that needs no compensation', () => {
  const fields = {
    ignores: ['dist/**'],
    rules: { [JSX_KEY]: 'error', [NO_NON_NULL_ASSERTION]: 'error', [ARRAY_TYPE]: 'error', [NO_DEBUGGER]: 'off', 'react/jsx-no-duplicate-props': 'off' },
    fileOverrides: [{ files: ['lib/**'], rules: { [JSX_KEY]: 'off', 'no-compare-neg-zero': 'error' } }],
  } satisfies SharedFields
  const team = buildTeamOxlintConfig({ plugins: ROOT_LISTING_EVERY_PLUGIN_OF_OURS, categories: { correctness: 'off' } })
  const merged = (): OxlintConfig => mergedEditorOxlintConfig(PROJECT_WITH_OXLINT, fields, team)

  it('state no rule off, though our ESLint part runs a rule oxlint has', () => {
    expect(ruleIdsStatedOffIn(overridesInLine(merged()))).toStrictEqual([])
  })

  it('run each rule our oxlint part runs exactly where our part alone runs it, with its options, and state it nowhere else', () => {
    const part = oxlintPartOf(ourEditorParts(fields))

    expect(entriesOfOurRulesIn(merged(), part)).toStrictEqual(entriesOursAloneRuns(part))
  })

  // The team sets the rule, so it is the team's in every file, whatever our part says of it.
  it("leave to the team an ESLint-routed rule it sets, where our part only turns it off and where our part runs it", () => {
    const config = mergedEditorOxlintConfig(
      PROJECT_WITH_OXLINT,
      { rules: { [ARRAY_TYPE]: 'off' } },
      buildTeamOxlintConfig({ plugins: ['typescript'], rules: { 'typescript/array-type': 'error' } }),
    )
    const besideOneItRuns = mergedEditorOxlintConfig(
      PROJECT_WITH_OXLINT,
      { rules: { [ARRAY_TYPE]: 'error' } },
      buildTeamOxlintConfig({ plugins: ['typescript'], overrides: [{ files: ['**/*.test.ts'], rules: { 'typescript/array-type': 'error' } }] }),
    )

    expect({
      turnedOffOnly: entriesOfTheRuleIn(config, 'src/a.ts', ARRAY_TYPE),
      run: oxlintSeverityFor(besideOneItRuns, 'src/a.test.ts', 'typescript/array-type'),
    }).toStrictEqual({ turnedOffOnly: { 'typescript/array-type': 'error' }, run: 'error' })
  })
})

// The team sets the rule, so it is the team's in every file and nothing turns it off across engines.
describe('mergeOxlintConfig, given a rule our ESLint part runs that oxlint has, which the team turns on at its root', () => {
  const team = buildTeamOxlintConfig({ plugins: ['typescript'], rules: { 'typescript/array-type': 'error', 'max-lines': ['error', { max: 1 }] } })

  it("leaves the team's entry where our ESLint part would run it, in our ignores and where an entry of ours turns it off", () => {
    const config = mergedEditorOxlintConfig(
      PROJECT_WITH_OXLINT,
      { rules: { [ARRAY_TYPE]: 'error' }, ignores: ['dist/**'], fileOverrides: [{ files: ['legacy/**'], rules: { [ARRAY_TYPE]: 'off' } }] },
      team,
    )

    expect({
      runByOurEslintPart: entryOfTheRuleIn(config, 'src/a.ts', ARRAY_TYPE),
      inOurIgnores: entryOfTheRuleIn(config, 'dist/c.ts', ARRAY_TYPE),
      offInAnEntryOfOurs: entryOfTheRuleIn(config, 'legacy/b.ts', ARRAY_TYPE),
    }).toStrictEqual({ runByOurEslintPart: 'error', inOurIgnores: 'error', offInAnEntryOfOurs: 'error' })
  })

  it("leaves the team's entry where an entry of ours turns it on, and elsewhere", () => {
    const config = mergedEditorOxlintConfig(PROJECT_WITH_OXLINT, { fileOverrides: [{ files: ['lib/**'], rules: { [ARRAY_TYPE]: 'error' } }] }, team)

    expect({ inTheEntry: entryOfTheRuleIn(config, 'lib/b.ts', ARRAY_TYPE), elsewhere: entryOfTheRuleIn(config, 'src/a.ts', ARRAY_TYPE) }).toStrictEqual({
      inTheEntry: 'error',
      elsewhere: 'error',
    })
  })

  it("leaves the team's entry in the rule's own files, outside them, and in its own ignores", () => {
    const config = mergedEditorOxlintConfig(PROJECT_WITH_OXLINT, { rules: { [MAX_LINES]: 'error' } }, team)

    expect({
      inItsFiles: entryOfTheRuleIn(config, 'src/f.tsx', MAX_LINES),
      outsideItsFiles: entryOfTheRuleIn(config, 'src/a.ts', MAX_LINES),
      inItsIgnores: entryOfTheRuleIn(config, 'src/f.test.tsx', MAX_LINES),
    }).toStrictEqual({ inItsFiles: ['error', { max: 1 }], outsideItsFiles: ['error', { max: 1 }], inItsIgnores: ['error', { max: 1 }] })
  })
})

// The react ruleset expects React 18.3 or later, so our version goes beside the team's other react settings,
// and the team's own version stands.
describe("mergeOxlintConfig, given the team's settings", () => {
  it('gives React 18.3.0 where the team gives no settings', () => {
    expect(mergedEditorOxlintConfig(PROJECT_WITH_OXLINT, {}, buildTeamOxlintConfig()).settings).toStrictEqual({ react: { version: REACT_VERSION } })
  })

  it("gives React 18.3.0 beside the team's other react settings, keeping its other plugins' settings", () => {
    const teamConfig = buildTeamOxlintConfig({ settings: { react: { linkComponents: [TEAM_LINK_COMPONENT] }, next: { rootDir: TEAM_NEXT_ROOT_DIRS } } })

    expect(mergedEditorOxlintConfig(PROJECT_WITH_OXLINT, {}, teamConfig).settings).toStrictEqual({
      react: { linkComponents: [TEAM_LINK_COMPONENT], version: REACT_VERSION },
      next: { rootDir: TEAM_NEXT_ROOT_DIRS },
    })
  })

  it("keeps the team's React version where it gives one", () => {
    const teamConfig = buildTeamOxlintConfig({ settings: { react: { version: TEAMS_REACT_VERSION, linkComponents: [TEAM_LINK_COMPONENT] } } })

    expect(mergedEditorOxlintConfig(PROJECT_WITH_OXLINT, {}, teamConfig).settings).toStrictEqual({
      react: { version: TEAMS_REACT_VERSION, linkComponents: [TEAM_LINK_COMPONENT] },
    })
  })

  it.each(SETTINGS_OXLINT_REFUSES)('leaves the settings as the team wrote them, for oxlint to refuse, where $what', ({ settings }) => {
    // @ts-expect-error a config imported from .oxlintrc.json is untyped, so it can hold settings oxlint's type refuses
    const teamConfig = buildTeamOxlintConfig({ settings })

    expect(mergedEditorOxlintConfig(PROJECT_WITH_OXLINT, {}, teamConfig).settings).toStrictEqual(settings)
  })
})

// The team's options stand as written, and its env where it sets it; ours fill the rest of the env.
describe('mergeOxlintConfig, given the options and env of the team', () => {
  it('keeps unused disable directives as the team reports them, where it sets that', () => {
    const config = mergedEditorOxlintConfig(PROJECT_WITH_OXLINT, {}, buildTeamOxlintConfig({ options: { reportUnusedDisableDirectives: 'warn' } }))

    expect(config.options).toStrictEqual({ reportUnusedDisableDirectives: 'warn' })
  })

  it('gives no options where the team gives none', () => {
    expect(mergedEditorOxlintConfig(PROJECT_WITH_OXLINT, {}, buildTeamOxlintConfig()).options).toBeUndefined()
  })

  it("keeps the env key the team's root sets, and our runtime's beside it, in every file", () => {
    const { oxlint } = ourEditorParts({}, { editorRulesets: { runtimes: ['browser'] } })
    const { env } = oxlintConfigForFile(mergeOxlintConfig(buildTeamOxlintConfig({ env: { browser: false } }), oxlint, NO_TEAM_ESLINT_CONFIG), 'src/a.ts')

    expect({ browser: env['browser'], es2024: env['es2024'] }).toStrictEqual({ browser: false, es2024: true })
  })

  // No override of ours turns a rule on here, so our env stands in an override of its own. es2024 is
  // probed as no runtime's: a runtime's env is ours only where our own no-undef runs. The root lists each
  // rule's plugin, as oxlint counts a root's statement only for a listed plugin.
  it("keeps our env in every file, where the team's root states every rule our part runs", () => {
    const oxlint = oxlintPartOf(ourEditorParts({}, { editorRulesets: { runtimes: ['browser'] } }))
    const teamRootStatingEveryRuleOfOurs = Object.fromEntries(oxlintNamesOfRulesOurPartRuns(oxlint).map((oxlintName): [string, 'error'] => [oxlintName, 'error']))
    const config = mergeOxlintConfig(
      buildTeamOxlintConfig({ plugins: ROOT_LISTING_EVERY_PLUGIN_OF_OURS, rules: teamRootStatingEveryRuleOfOurs }),
      oxlint,
      NO_TEAM_ESLINT_CONFIG,
    )

    expect({
      es2024: oxlintConfigForFile(config, 'src/a.ts').env['es2024'],
      rulesTheOverridesTurnOn: rulesOnInOxlint({ overrides: overridesOf(config) }),
    }).toStrictEqual({ es2024: true, rulesTheOverridesTurnOn: [] })
  })

  // Our runtime's env is ours where our own no-undef runs: the correctness ruleset ships it for JS
  // files, so the files read are JS files.
  it("keeps the env an override of the team's sets in its files, and ours elsewhere", () => {
    const { oxlint } = ourEditorParts({}, { editorRulesets: { quality: ['correctness'], runtimes: ['browser'] } })
    const config = mergeOxlintConfig(buildTeamOxlintConfig({ overrides: [{ files: ['**/*.test.js'], env: { browser: false } }] }), oxlint, NO_TEAM_ESLINT_CONFIG)

    expect({
      inTheTeamsFiles: oxlintConfigForFile(config, 'src/a.test.js').env['browser'],
      elsewhere: oxlintConfigForFile(config, 'src/a.js').env['browser'],
    }).toStrictEqual({ inTheTeamsFiles: false, elsewhere: true })
  })
})

// Our env, each key in the overrides of ours that give it: oxlint's builtins with our rules, our
// runtime's where our no-undef runs, and each framework's and test runner's in their files.
describe('the env of ours mergeOxlintConfig writes, beside a team config setting none', () => {
  it("gives each key once, our runtime's apart from the rest, in no override giving an empty env", () => {
    const { oxlint } = ourEditorParts({}, { editorRulesets: { quality: ['correctness'], runtimes: ['browser'] } })
    const config = mergeOxlintConfig(buildTeamOxlintConfig(), oxlint, NO_TEAM_ESLINT_CONFIG)

    expect(overridesOf(config).flatMap(({ env }) => (env === undefined ? [] : [env]))).toStrictEqual([
      { builtin: true, es2024: true },
      { browser: true },
      { svelte: true },
      { vue: true },
      { astro: true },
      { vitest: true, jest: true },
    ])
  })
})

describe('mergeOxlintConfig, given the oxlint part of a project', () => {
  it('whose package.json lists no oxlint, which has no oxlint part, is refused, naming package.json', () => {
    const { oxlint } = defineLintRules(buildConsumerLintRules(PROJECT_WITHOUT_OXLINT, {})).editorRulesets

    expect(() => mergeOxlintConfig(buildTeamOxlintConfig(), oxlint, NO_TEAM_ESLINT_CONFIG)).toThrowError('package.json')
  })

  it('whose package.json lists oxlint, with the oxlint this repo installs, merges', () => {
    expect(() => mergedEditorOxlintConfig(PROJECT_WITH_OXLINT, {}, buildTeamOxlintConfig())).not.toThrow()
  })
})

// A team's config is the team's to reuse: the merge builds a new one beside it.
describe('the team config mergeOxlintConfig is given', () => {
  it('is left as it was, though it sets every key', () => {
    const { oxlint } = defineLintRules(buildEveryRulesetLintRules(PROJECT_WITH_OXLINT)).editorRulesets
    const teamConfig = structuredClone(TEAM_CONFIG)
    mergeOxlintConfig(teamConfig, oxlint, NO_TEAM_ESLINT_CONFIG)

    expect(teamConfig).toStrictEqual(TEAM_CONFIG)
  })
})

function routeOf(id: string): RuleRoute {
  const route = catalog.rules.get(id)
  if (route === undefined) throw new Error(`${id} is not in the catalog`)
  return route
}

function oxlintPluginOf(id: string): string {
  const { oxlintPlugin } = routeOf(id)
  if (oxlintPlugin === null) throw new Error(`${id} has no oxlint plugin`)
  return oxlintPlugin
}

function oxlintNameOf(id: string): string {
  const { oxlintName } = routeOf(id)
  if (oxlintName === null) throw new Error(`${id} has no oxlint name`)
  return oxlintName
}
