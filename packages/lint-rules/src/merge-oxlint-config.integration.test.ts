import { catalog } from '@workspace/rule-data'
import type { OxlintConfig } from 'oxlint'
import { describe, expect, it } from 'vitest'
import { FOLDER_LAYOUT_FILES, folderLayoutSourceFiles } from './__tests__/cases/oxlint-folder-layout.ts'
import {
  BROWSER_LINTED_DIRS,
  browserSourceFiles,
  browserSourceFilesInTwoFolders,
  CROSS_ENGINE_LINTED_DIRS,
  crossEngineSourceFiles,
  LINTED_DIR,
  LOCAL_PLUGIN_FILE,
  localPlugin,
  MAX_LINES_LINTED_DIRS,
  maxLinesSourceFiles,
  NEGATED_IGNORES_LINTED_PATHS,
  negatedIgnoresSourceFiles,
  REACT_LINTED_DIRS,
  reactSourceFiles,
  sourceFiles,
  TRAILING_SLASH_LINTED_DIRS,
  trailingSlashSourceFiles,
} from './__tests__/cases/oxlint-team-project.ts'
import { describeFinding, oxlintFindingsIn, runOxlintCli, writeOxlintConfigFile } from './__tests__/engine-clis.ts'
import { buildConsumerLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { buildTeamOxlintConfig } from './__tests__/factories/team-config-factories.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { NO_TEAM_ESLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { INSTALLED_OXLINT, setUpTempProjects } from './__tests__/temp-projects.ts'
import { agentSettingsOf } from './agent-settings.ts'
import { buildOxlintConfig } from './core/build-oxlint-config.ts'
import { defineLintRules, type LintRules } from './index.ts'
import { mergeOxlintConfig } from './oxlint.ts'

// Where the team's config sets a rule ours states, anywhere, by a statement oxlint counts or a category
// it turns on, the team's setting decides it in every file; ours decide every other rule. Our part
// turns on the four rules the sources draw: no-debugger, no-undef, eqeqeq, and
// @typescript-eslint/array-type, which ESLint runs.

allowEveryTestForParallelLoad()

type TeamConfigFile = { readonly file: string; readonly config: OxlintConfig }

type OurRules = NonNullable<LintRules['rules']>

/** The settings our part is made from beside its rulesets: rules, entries and ignores. */
type OurFields = Pick<LintRules, 'rules' | 'fileOverrides' | 'ignores'>

/** The rulesets our part lists, by set: none unless given. */
type OurRulesets = Parameters<typeof buildConsumerLintRules>[1]

/**
 * Where a team config sets our rules otherwise: the oxlint codes of the rules it sets, whose findings
 * are the team's in every file, and a finding of ours of a rule it does not set.
 */
type SettingElsewhere = {
  readonly where: string
  readonly team: TeamConfigFile
  readonly codesOfTheRulesItSets: readonly string[]
  readonly oursOfARuleItDoesNotSet: readonly string[]
}

/** Where a team config lists a plugin other than in its own root `plugins`. */
type ListingElsewhere = { readonly where: string; readonly team: TeamConfigFile }

/** A project oxlint lints, and the paths it is given. */
type LintedProject = { readonly projectDir: string; readonly paths: readonly string[] }

/**
 * A team config that lists the react plugin in overrides only, if at all, and the findings of
 * react/jsx-no-duplicate-props, a rule our part does not state, that the team's config alone
 * reports (measured, oxlint 1.87).
 */
type ListingInOverrides = {
  readonly how: string
  readonly team: TeamConfigFile
  readonly teamAlone: readonly string[]
  /** Whether an override of the team's lists react, so the correctness category it turns on holds react's rules. */
  readonly listsReact: boolean
}

const OUR_RULES = {
  'no-debugger': 'error',
  eqeqeq: 'error',
  'no-undef': 'error',
  '@typescript-eslint/array-type': 'error',
} as const satisfies OurRules

// A rule of a plugin oxlint does not run by default: the merge lists react for it.
const OUR_REACT_RULE = { 'react/jsx-key': 'error' } as const satisfies OurRules
const OUR_REACT_FINDING = 'src/f.tsx:1 react(jsx-key)'
const REACT_CATEGORY_FINDING = 'src/f.tsx:1 react(jsx-no-duplicate-props)'
const REACT_FINDINGS = [OUR_REACT_FINDING, REACT_CATEGORY_FINDING]
// The same two react rules on a .jsx file, which a team override for .tsx files does not match.
const OUR_REACT_FINDING_OUTSIDE_TSX = 'src/g.jsx:1 react(jsx-key)'
const REACT_FINDINGS_OUTSIDE_TSX = [OUR_REACT_FINDING_OUTSIDE_TSX, 'src/g.jsx:1 react(jsx-no-duplicate-props)']
// A core rule our part does not state, which oxlint's default correctness category turns on.
const CORE_CATEGORY_FINDING = 'src/h.ts:1 eslint(no-compare-neg-zero)'
// The react category rule our part does not state, and our react rule, in each file of the react project.
const DUPLICATE_PROPS = 'react(jsx-no-duplicate-props)'
const JSX_KEY = 'react(jsx-key)'
const DUPLICATE_PROPS_IN = {
  lib: 'lib/m.tsx:1 react(jsx-no-duplicate-props)',
  test: 'src/f.test.tsx:1 react(jsx-no-duplicate-props)',
  tsx: 'src/f.tsx:1 react(jsx-no-duplicate-props)',
} as const
const OUR_REACT_FINDINGS_IN_EVERY_FILE = [
  'lib/m.tsx:1 react(jsx-key)',
  'src/f.test.tsx:1 react(jsx-key)',
  'src/f.tsx:1 react(jsx-key)',
  'src/g.jsx:1 react(jsx-key)',
]
const REACT_RULE = 'react/jsx-no-duplicate-props'
const NO_UNDEF = 'eslint(no-undef)'
const NO_DEBUGGER = 'eslint(no-debugger)'
const EQEQEQ = 'eslint(eqeqeq)'
const NO_WARNING_COMMENTS = 'eslint(no-warning-comments)'
const ARRAY_TYPE = 'typescript(array-type)'
const MAX_LINES = 'eslint(max-lines)'
// The findings each rule draws in the cross-engine project: array-type on line 1 of every file, and
// max-lines of 1 on its second line.
const ARRAY_TYPE_IN = {
  dist: 'dist/a.ts:1 typescript(array-type)',
  generated: 'generated/a.ts:1 typescript(array-type)',
  legacy: 'legacy/a.ts:1 typescript(array-type)',
  src: 'src/a.ts:1 typescript(array-type)',
  test: 'src/f.test.tsx:1 typescript(array-type)',
  tsx: 'src/f.tsx:1 typescript(array-type)',
  srcGenerated: 'src/generated/a.ts:1 typescript(array-type)',
} as const
const MAX_LINES_IN = {
  dist: 'dist/a.ts:2 eslint(max-lines)',
  generated: 'generated/a.ts:2 eslint(max-lines)',
  legacy: 'legacy/a.ts:2 eslint(max-lines)',
  src: 'src/a.ts:2 eslint(max-lines)',
  test: 'src/f.test.tsx:2 eslint(max-lines)',
  tsx: 'src/f.tsx:2 eslint(max-lines)',
  srcGenerated: 'src/generated/a.ts:2 eslint(max-lines)',
} as const
// The team's findings in every file, sorted as oxlint's are.
const ARRAY_TYPE_IN_EVERY_FILE = Object.values(ARRAY_TYPE_IN)
const MAX_LINES_IN_EVERY_FILE = Object.values(MAX_LINES_IN)

const tempProjects = setUpTempProjects()
const PROJECT = tempProjects.create({
  files: {
    'package.json': packageJsonText(buildPackageJsonListingOxlint()),
    [LOCAL_PLUGIN_FILE]: localPlugin,
    ...sourceFiles,
  },
  linkedPackages: [INSTALLED_OXLINT],
})
const THE_TEAM_PROJECT: LintedProject = { projectDir: PROJECT, paths: [LINTED_DIR] }
const THE_REACT_PROJECT: LintedProject = {
  projectDir: tempProjects.create({
    files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()), ...reactSourceFiles },
    linkedPackages: [INSTALLED_OXLINT],
  }),
  paths: REACT_LINTED_DIRS,
}
const THE_BROWSER_PROJECT: LintedProject = {
  projectDir: tempProjects.create({
    files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()), ...browserSourceFiles },
    linkedPackages: [INSTALLED_OXLINT],
  }),
  paths: [LINTED_DIR],
}
const THE_BROWSER_PROJECT_IN_TWO_FOLDERS: LintedProject = {
  projectDir: tempProjects.create({
    files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()), ...browserSourceFilesInTwoFolders },
    linkedPackages: [INSTALLED_OXLINT],
  }),
  paths: BROWSER_LINTED_DIRS,
}
const THE_CROSS_ENGINE_PROJECT: LintedProject = {
  projectDir: tempProjects.create({
    files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()), ...crossEngineSourceFiles },
    linkedPackages: [INSTALLED_OXLINT],
  }),
  paths: CROSS_ENGINE_LINTED_DIRS,
}
const THE_FOLDER_LAYOUT_PROJECT = tempProjects.create({
  files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()), ...folderLayoutSourceFiles },
  linkedPackages: [INSTALLED_OXLINT],
})
const THE_TRAILING_SLASH_PROJECT: LintedProject = {
  projectDir: tempProjects.create({
    files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()), ...trailingSlashSourceFiles },
    linkedPackages: [INSTALLED_OXLINT],
  }),
  paths: TRAILING_SLASH_LINTED_DIRS,
}
const THE_NEGATED_IGNORES_PROJECT: LintedProject = {
  projectDir: tempProjects.create({
    files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()), ...negatedIgnoresSourceFiles },
    linkedPackages: [INSTALLED_OXLINT],
  }),
  paths: NEGATED_IGNORES_LINTED_PATHS,
}
const THE_MAX_LINES_PROJECT: LintedProject = {
  projectDir: tempProjects.create({
    files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()), ...maxLinesSourceFiles },
    linkedPackages: [INSTALLED_OXLINT],
  }),
  paths: MAX_LINES_LINTED_DIRS,
}

/**
 * The findings oxlint reports with the team's config alone and with ours merged into it, as
 * `file:line code`. Our part turns on `ourRules`, the four the sources draw unless given, under
 * no ruleset unless given, and oxlint lints the team project's sources unless given another project.
 */
function findingsWithTheTeamAloneAndMerged(
  team: TeamConfigFile,
  ourRules: OurRules = OUR_RULES,
  project: LintedProject = THE_TEAM_PROJECT,
  ourRulesets: OurRulesets = {},
): { teamAlone: string[]; merged: string[] } {
  return findingsWithTheTeamAloneAndMergedWith(team, { rules: ourRules }, project, ourRulesets)
}

/** As findingsWithTheTeamAloneAndMerged, our part made from the rules, entries and ignores given. */
function findingsWithTheTeamAloneAndMergedWith(
  { file, config }: TeamConfigFile,
  ourFields: OurFields,
  { projectDir, paths }: LintedProject,
  ourRulesets: OurRulesets = {},
): { teamAlone: string[]; merged: string[] } {
  const { oxlint } = defineLintRules(buildConsumerLintRules(projectDir, ourRulesets, ourFields)).editorRulesets
  const mergedFile = `merged.${file}`
  writeOxlintConfigFile(projectDir, file, config)
  writeOxlintConfigFile(projectDir, mergedFile, mergeOxlintConfig(config, oxlint, NO_TEAM_ESLINT_CONFIG))
  return {
    teamAlone: oxlintFindingsIn(runOxlintCli(projectDir, file, paths).report).map(describeFinding),
    merged: oxlintFindingsIn(runOxlintCli(projectDir, mergedFile, paths).report).map(describeFinding),
  }
}

function findingsOf(findings: readonly string[], code: string): string[] {
  return findings.filter((finding) => finding.endsWith(code))
}

function among(findings: readonly string[], signals: readonly string[]): string[] {
  return findings.filter((finding) => signals.includes(finding))
}

/** The files the real oxlint CLI reports the code in over the folder layout project, with the config given written to the file given. */
function filesOxlintReportsInTheFolderLayout(file: string, config: OxlintConfig, code: string): string[] {
  return filesOxlintReportsIn({ projectDir: THE_FOLDER_LAYOUT_PROJECT, paths: ['.'] }, file, config, code)
}

/** The files the real oxlint CLI reports the code in over the project's paths, with the config given written to the file given. */
function filesOxlintReportsIn({ projectDir, paths }: LintedProject, file: string, config: OxlintConfig, code: string): string[] {
  writeOxlintConfigFile(projectDir, file, config)
  const findings = oxlintFindingsIn(runOxlintCli(projectDir, file, paths).report).filter(({ rule }) => rule === code)
  return [...new Set(findings.map((finding) => finding.file))].toSorted()
}

// Each team config turns every category off, so the rules it sets are those it states, and a rule it
// does not state stays ours.
const SETTINGS_ELSEWHERE: readonly SettingElsewhere[] = [
  {
    where: 'at the root, under another spelling',
    team: {
      file: 'root.oxlint.config.mts',
      config: buildTeamOxlintConfig({ categories: { correctness: 'off' }, rules: { 'eslint/no-debugger': 'off', 'eslint/eqeqeq': ['error', 'smart'] } }),
    },
    codesOfTheRulesItSets: [NO_DEBUGGER, EQEQEQ],
    oursOfARuleItDoesNotSet: ['src/e.js:2 eslint(no-undef)'],
  },
  // The team's override reaches the test files alone: the rule is the team's in src/a.ts too.
  {
    where: 'in an override of its own',
    team: {
      file: 'override.oxlint.config.mts',
      config: buildTeamOxlintConfig({ categories: { correctness: 'off' }, overrides: [{ files: ['**/*.test.ts'], rules: { 'no-debugger': 'off' } }] }),
    },
    codesOfTheRulesItSets: [NO_DEBUGGER],
    oursOfARuleItDoesNotSet: ['src/e.js:2 eslint(no-undef)'],
  },
  {
    where: 'in an override of a config it extends, given as an object',
    team: {
      file: 'extends-object.oxlint.config.mts',
      config: buildTeamOxlintConfig({
        categories: { correctness: 'off' },
        extends: [{ overrides: [{ files: ['**/*.test.ts'], rules: { 'no-debugger': 'off' } }] }],
      }),
    },
    codesOfTheRulesItSets: [NO_DEBUGGER],
    oursOfARuleItDoesNotSet: ['src/e.js:2 eslint(no-undef)'],
  },
]

describe('our rules, merged into a team oxlint config that sets them otherwise', () => {
  it.each(SETTINGS_ELSEWHERE)(
    "give the team's findings of the rules it sets $where, in every file, and ours of a rule it does not set",
    ({ team, codesOfTheRulesItSets, oursOfARuleItDoesNotSet }) => {
      const { teamAlone, merged } = findingsWithTheTeamAloneAndMerged(team)
      const ofTheRulesItSets = (findings: readonly string[]): string[] => findings.filter((finding) => codesOfTheRulesItSets.some((code) => finding.endsWith(code)))

      expect({ theTeams: ofTheRulesItSets(merged), ours: among(merged, oursOfARuleItDoesNotSet) }).toStrictEqual({
        theTeams: ofTheRulesItSets(teamAlone),
        ours: oursOfARuleItDoesNotSet,
      })
    },
  )
})

describe('a team oxlint config, merged with our part', () => {
  // It states an ESLint-run rule of ours under its oxlint spelling, which makes the rule the team's.
  it("loses no finding when it leaves out plugins and categories: oxlint's defaults stay on", () => {
    const { teamAlone, merged } = findingsWithTheTeamAloneAndMerged({
      file: 'defaults.oxlint.config.mts',
      config: buildTeamOxlintConfig({ rules: { 'typescript/array-type': 'error' } }),
    })

    expect(teamAlone.filter((finding) => !merged.includes(finding))).toStrictEqual([])
  })

  it("keeps the findings of oxlint's default category, one per default plugin, when it leaves out plugins and categories", () => {
    const { teamAlone, merged } = findingsWithTheTeamAloneAndMerged({ file: 'empty.oxlint.config.mts', config: buildTeamOxlintConfig() })
    const defaultCategoryFindings = [
      'src/c.ts:1 oxc(erasing-op)',
      'src/c.ts:2 unicorn(no-useless-spread)',
      'src/c.ts:3 typescript(no-duplicate-enum-values)',
    ]

    expect({ teamAlone: among(teamAlone, defaultCategoryFindings), merged: among(merged, defaultCategoryFindings) }).toStrictEqual({
      teamAlone: defaultCategoryFindings,
      merged: defaultCategoryFindings,
    })
  })

  it('loses no finding when it lists its plugins and categories', () => {
    const { teamAlone, merged } = findingsWithTheTeamAloneAndMerged({
      file: 'explicit.oxlint.config.mts',
      config: buildTeamOxlintConfig({ plugins: ['import'], categories: { correctness: 'error', suspicious: 'warn' } }),
    })

    expect(teamAlone.filter((finding) => !merged.includes(finding))).toStrictEqual([])
  })

  it("keeps running the team's JS plugin rule", () => {
    const signals = ['src/d.ts:1 local(no-direct-fetch)']
    const { teamAlone, merged } = findingsWithTheTeamAloneAndMerged({
      file: 'js-plugin.oxlint.config.mts',
      config: buildTeamOxlintConfig({ jsPlugins: [`./${LOCAL_PLUGIN_FILE}`], rules: { 'local/no-direct-fetch': 'error' } }),
    })

    expect({ teamAlone: among(teamAlone, signals), merged: among(merged, signals) }).toStrictEqual({
      teamAlone: signals,
      merged: signals,
    })
  })

  it("keeps the team's globals: our no-undef reports the name nobody declares, and not the team's global", () => {
    const { merged } = findingsWithTheTeamAloneAndMerged({
      file: 'globals.oxlint.config.mts',
      config: buildTeamOxlintConfig({ globals: { __APP__: 'readonly' } }),
    })

    expect(merged.filter((finding) => finding.endsWith('eslint(no-undef)'))).toStrictEqual(['src/e.js:2 eslint(no-undef)'])
  })
})

// Listing a plugin turns on, for the whole config, every rule of it the team's categories hold, so a
// plugin the merge lists only for a rule of ours must run no other the team did not ask for (measured).
describe('a plugin the merge lists for a rule of ours, which the team config does not list', () => {
  it("runs our rule of it and no rule of it that neither config states, though the team's categories hold that rule", () => {
    const { teamAlone, merged } = findingsWithTheTeamAloneAndMerged(
      { file: 'react-unlisted.oxlint.config.mts', config: buildTeamOxlintConfig() },
      OUR_REACT_RULE,
    )

    expect({ teamAlone: among(teamAlone, REACT_FINDINGS), merged: among(merged, REACT_FINDINGS) }).toStrictEqual({
      teamAlone: [],
      merged: [OUR_REACT_FINDING],
    })
  })

  // oxlint ignores a statement of a rule whose plugin is not listed, so the merge listing the plugin for
  // our rule must not make the statement count.
  it("runs no rule of it that the team's config states where oxlint ignores the statement, as the team's config alone runs none", () => {
    const { teamAlone, merged } = findingsWithTheTeamAloneAndMerged(
      {
        file: 'react-rule-stated.oxlint.config.mts',
        config: buildTeamOxlintConfig({ rules: { 'react/jsx-no-duplicate-props': 'warn' } }),
      },
      OUR_REACT_RULE,
    )

    expect({ teamAlone: among(teamAlone, REACT_FINDINGS), merged: among(merged, REACT_FINDINGS) }).toStrictEqual({
      teamAlone: [],
      merged: [OUR_REACT_FINDING],
    })
  })
})

// oxlint runs its core rules whatever `plugins` lists; the merge lists eslint for our core rules, and
// must not take that listing for one only it makes.
describe("oxlint's core rules, which it runs whatever a team config's plugins list", () => {
  it("keep running where the team's categories turn one on that our part does not state", () => {
    const { teamAlone, merged } = findingsWithTheTeamAloneAndMerged({
      file: 'core-category.oxlint.config.mts',
      config: buildTeamOxlintConfig(),
    })

    expect({ teamAlone: among(teamAlone, [CORE_CATEGORY_FINDING]), merged: among(merged, [CORE_CATEGORY_FINDING]) }).toStrictEqual({
      teamAlone: [CORE_CATEGORY_FINDING],
      merged: [CORE_CATEGORY_FINDING],
    })
  })
})

// A plugin the team lists anywhere it applies runs the rules the team's categories hold, so the
// merge turns none of them off.
const LISTINGS_ELSEWHERE: readonly ListingElsewhere[] = [
  {
    where: 'in a config it extends, given as an object',
    team: { file: 'react-extends-object.oxlint.config.mts', config: buildTeamOxlintConfig({ extends: [{ plugins: ['react'] }] }) },
  },
]

describe('a plugin the team config lists outside its root plugins, which the merge lists for a rule of ours too', () => {
  it.each(LISTINGS_ELSEWHERE)("keeps every rule its categories turn on, where the team lists it $where: the team's findings of it stay", ({ team }) => {
    const { teamAlone, merged } = findingsWithTheTeamAloneAndMerged(team, OUR_REACT_RULE)

    expect({ teamAlone: among(teamAlone, REACT_FINDINGS), merged: among(merged, REACT_FINDINGS) }).toStrictEqual({
      teamAlone: REACT_FINDINGS,
      merged: REACT_FINDINGS,
    })
  })
})

// An override's `plugins` turns the plugin's categories on in its files only; the merge's listing for
// our rule must not spread them further. The team's category holds our react rule, which is then the
// team's in every file.
describe('a plugin the team config lists only in an override, which the merge lists for a rule of ours too', () => {
  const team: TeamConfigFile = {
    file: 'react-override.oxlint.config.mts',
    config: buildTeamOxlintConfig({ categories: { correctness: 'warn' }, overrides: [{ files: ['**/*.tsx'], plugins: ['react'] }] }),
  }

  it("keeps every rule its categories turn on in that override's files: the team's findings of it stay", () => {
    const { teamAlone, merged } = findingsWithTheTeamAloneAndMerged(team, OUR_REACT_RULE)

    expect({ teamAlone: among(teamAlone, REACT_FINDINGS), merged: among(merged, REACT_FINDINGS) }).toStrictEqual({
      teamAlone: REACT_FINDINGS,
      merged: REACT_FINDINGS,
    })
  })

  it("runs no rule of it in a file outside that override, ours included, as the team's config runs none there", () => {
    const { teamAlone, merged } = findingsWithTheTeamAloneAndMerged(team, OUR_REACT_RULE)

    expect({
      teamAlone: among(teamAlone, REACT_FINDINGS_OUTSIDE_TSX),
      merged: among(merged, REACT_FINDINGS_OUTSIDE_TSX),
    }).toStrictEqual({ teamAlone: [], merged: [] })
  })
})

// A plugin the team lists in overrides only runs as those overrides order it: its categories where a
// listing override matches the file, and a statement of its rules only from an override listing it too
// (measured, 1.87). Once the merge lists the plugin at the root every such statement would apply, so
// the merge must report react/jsx-no-duplicate-props in exactly the files the team's config alone does.
describe('a rule our part does not state, of a plugin the team config lists in overrides only, which the merge lists for a rule of ours', () => {
  const listingsInOverrides: readonly ListingInOverrides[] = [
    {
      how: 'states it in the override that lists the plugin',
      team: {
        file: 'react-stated-in-listing.oxlint.config.mts',
        config: buildTeamOxlintConfig({
          categories: { correctness: 'warn' },
          overrides: [{ files: ['**/*.tsx'], plugins: ['react'], rules: { [REACT_RULE]: 'warn' } }],
        }),
      },
      teamAlone: [DUPLICATE_PROPS_IN.lib, DUPLICATE_PROPS_IN.test, DUPLICATE_PROPS_IN.tsx],
      listsReact: true,
    },
    {
      how: 'lists the plugin for .tsx files, and turns it off for test files in an override that does not list the plugin',
      team: {
        file: 'react-off-unlisted.oxlint.config.mts',
        config: buildTeamOxlintConfig({
          categories: { correctness: 'warn' },
          overrides: [
            { files: ['**/*.tsx'], plugins: ['react'] },
            { files: ['**/*.test.tsx'], rules: { [REACT_RULE]: 'off' } },
          ],
        }),
      },
      teamAlone: [DUPLICATE_PROPS_IN.lib, DUPLICATE_PROPS_IN.test, DUPLICATE_PROPS_IN.tsx],
      listsReact: true,
    },
    {
      how: 'lists the plugin for .tsx files, and turns it off for test files in a later override that lists the plugin too',
      team: {
        file: 'react-off-listed.oxlint.config.mts',
        config: buildTeamOxlintConfig({
          categories: { correctness: 'warn' },
          overrides: [
            { files: ['**/*.tsx'], plugins: ['react'] },
            { files: ['**/*.test.tsx'], plugins: ['react'], rules: { [REACT_RULE]: 'off' } },
          ],
        }),
      },
      teamAlone: [DUPLICATE_PROPS_IN.lib, DUPLICATE_PROPS_IN.tsx],
      listsReact: true,
    },
    {
      how: 'lists the plugin nowhere, and turns it off in one override',
      team: {
        file: 'react-off-nowhere-listed.oxlint.config.mts',
        config: buildTeamOxlintConfig({ categories: { correctness: 'warn' }, overrides: [{ files: ['**/*.test.tsx'], rules: { [REACT_RULE]: 'off' } }] }),
      },
      teamAlone: [],
      listsReact: false,
    },
    {
      how: 'lists the plugin in an override with excludeFiles of its own',
      team: {
        file: 'react-listing-excludes.oxlint.config.mts',
        config: buildTeamOxlintConfig({ categories: { correctness: 'warn' }, overrides: [{ files: ['src/**'], excludeFiles: ['**/*.jsx'], plugins: ['react'] }] }),
      },
      teamAlone: [DUPLICATE_PROPS_IN.test, DUPLICATE_PROPS_IN.tsx],
      listsReact: true,
    },
  ]

  it.each(listingsInOverrides)("runs it in no file the team's config alone does not, where the team config $how", ({ team, teamAlone }) => {
    const findings = findingsWithTheTeamAloneAndMerged(team, OUR_REACT_RULE, THE_REACT_PROJECT)

    expect({
      teamAlone: findingsOf(findings.teamAlone, DUPLICATE_PROPS),
      mergedBeyondIt: findingsOf(findings.merged, DUPLICATE_PROPS).filter((finding) => !findings.teamAlone.includes(finding)),
    }).toStrictEqual({ teamAlone, mergedBeyondIt: [] })
  })

  // Where an override lists react, the correctness category the team turns on holds our jsx-key, so
  // it is the team's in every file, reported as the team's config alone reports it; where none lists
  // react, the category holds none of react's rules, and ours runs in every file.
  it.each(listingsInOverrides)(
    "keeps it in every file the team's config alone runs it in, beside our react rule, the team's where an override lists react, where the team config $how",
    ({ team, listsReact }) => {
      const findings = findingsWithTheTeamAloneAndMerged(team, OUR_REACT_RULE, THE_REACT_PROJECT)

      expect({
        lostInMerged: findingsOf(findings.teamAlone, DUPLICATE_PROPS).filter((finding) => !findings.merged.includes(finding)),
        jsxKey: findingsOf(findings.merged, JSX_KEY),
      }).toStrictEqual({ lostInMerged: [], jsxKey: listsReact ? findingsOf(findings.teamAlone, JSX_KEY) : OUR_REACT_FINDINGS_IN_EVERY_FILE })
    },
  )
})

describe('a plugin the team config lists, which the merge lists for a rule of ours too', () => {
  it("keeps every rule its categories turn on: the team's findings of it stay", () => {
    const { teamAlone, merged } = findingsWithTheTeamAloneAndMerged(
      { file: 'react-listed.oxlint.config.mts', config: buildTeamOxlintConfig({ plugins: ['react'] }) },
      OUR_REACT_RULE,
    )

    expect({ teamAlone: among(teamAlone, REACT_FINDINGS), merged: among(merged, REACT_FINDINGS) }).toStrictEqual({
      teamAlone: REACT_FINDINGS,
      merged: REACT_FINDINGS,
    })
  })
})

// Our runtimes set oxlint's env in our overrides, so the globals they declare reach our rules in every
// file, as in our part alone.
describe("our runtimes, merged into a team oxlint config that sets no env", () => {
  it("declare their globals for our no-undef in every file: it reports the name nobody declares, and not the browser's window", () => {
    const { merged } = findingsWithTheTeamAloneAndMerged(
      { file: 'browser.oxlint.config.mts', config: buildTeamOxlintConfig() },
      { 'no-undef': 'error' },
      THE_BROWSER_PROJECT,
      { editorRulesets: { runtimes: ['browser'] } },
    )

    expect(findingsOf(merged, NO_UNDEF)).toStrictEqual(['src/i.js:2 eslint(no-undef)'])
  })
})

// Our env goes on the override of ours that excludes only what our part alone excludes from it. An
// entry of ours turning the browser runtime's rules off in lib/** makes our first override exclude lib/**.
describe("our runtimes, merged into a team oxlint config that sets no env, beside an entry of ours turning the runtime's rules off in some files", () => {
  it("declare their globals for our no-undef in those files too: it reports the name nobody declares, and not the browser's window", () => {
    const { merged } = findingsWithTheTeamAloneAndMergedWith(
      { file: 'browser-entry.oxlint.config.mts', config: buildTeamOxlintConfig() },
      {
        rules: { 'no-undef': 'error' },
        fileOverrides: [{ files: ['lib/**'], rules: { 'unicorn/prefer-add-event-listener': 'off', 'unicorn/require-post-message-target-origin': 'off' } }],
      },
      THE_BROWSER_PROJECT_IN_TWO_FOLDERS,
      { editorRulesets: { runtimes: ['browser'] } },
    )

    expect(findingsOf(merged, NO_UNDEF)).toStrictEqual(['lib/i.js:2 eslint(no-undef)', 'src/i.js:2 eslint(no-undef)'])
  })
})

// no-undef is the team's, so ours runs nowhere, and our runtime's globals are ours only where our own
// no-undef runs. The team's no-undef reports window in that entry's files too.
describe("our runtimes in an entry of ours alone, which turns the runtime's rules off, merged into a team oxlint config that sets no env", () => {
  it("declare no globals for the team's no-undef: it reports the name nobody declares, and the browser's window, in that entry's files and elsewhere", () => {
    const { merged } = findingsWithTheTeamAloneAndMergedWith(
      { file: 'browser-entry-only.oxlint.config.mts', config: buildTeamOxlintConfig({ rules: { 'no-undef': 'error' } }) },
      {
        fileOverrides: [
          {
            files: ['lib/**'],
            agentRulesets: { runtimes: ['browser'] },
            editorRulesets: { runtimes: ['browser'] },
            rules: { 'unicorn/prefer-add-event-listener': 'off', 'unicorn/require-post-message-target-origin': 'off' },
          },
        ],
      },
      THE_BROWSER_PROJECT_IN_TWO_FOLDERS,
    )

    expect(findingsOf(merged, NO_UNDEF)).toStrictEqual(['lib/i.js:1 eslint(no-undef)', 'lib/i.js:2 eslint(no-undef)', 'src/i.js:1 eslint(no-undef)', 'src/i.js:2 eslint(no-undef)'])
  })
})

// The team turns the rule on, so it is the team's in every file and nothing turns it off across engines
// (max-lines ships for .tsx and .jsx files but tests).
describe('a rule our ESLint part runs that oxlint has, merged into a team oxlint config that turns it on', () => {
  it.each([
    {
      how: 'beside our ignores of dist/** and an entry of ours turning it off in legacy/**',
      ours: {
        rules: { '@typescript-eslint/array-type': 'error' },
        ignores: ['dist/**'],
        fileOverrides: [{ files: ['legacy/**'], rules: { '@typescript-eslint/array-type': 'off' } }],
      },
      team: { file: 'array-type.oxlint.config.mts', config: buildTeamOxlintConfig({ rules: { 'typescript/array-type': 'error' } }) },
      code: ARRAY_TYPE,
      teamAlone: ARRAY_TYPE_IN_EVERY_FILE,
      merged: ARRAY_TYPE_IN_EVERY_FILE,
    },
    {
      how: 'beside our ignores of a folder by its name alone, generated, which the agent build leaves out at any depth',
      ours: { rules: { '@typescript-eslint/array-type': 'error' }, ignores: ['generated'] },
      team: { file: 'array-type-folder.oxlint.config.mts', config: buildTeamOxlintConfig({ rules: { 'typescript/array-type': 'error' } }) },
      code: ARRAY_TYPE,
      teamAlone: ARRAY_TYPE_IN_EVERY_FILE,
      merged: ARRAY_TYPE_IN_EVERY_FILE,
    },
    {
      how: "beside the rule's own files and ignores",
      ours: { rules: { 'max-lines': 'error' } },
      team: { file: 'max-lines.oxlint.config.mts', config: buildTeamOxlintConfig({ rules: { 'max-lines': ['error', { max: 1 }] } }) },
      code: MAX_LINES,
      teamAlone: MAX_LINES_IN_EVERY_FILE,
      merged: MAX_LINES_IN_EVERY_FILE,
    },
  ] satisfies readonly { how: string; ours: OurFields; team: TeamConfigFile; code: string; teamAlone: readonly string[]; merged: readonly string[] }[])(
    "keeps the team's findings of it in every file, $how",
    ({ ours, team, code, teamAlone, merged }) => {
      const findings = findingsWithTheTeamAloneAndMergedWith(team, ours, THE_CROSS_ENGINE_PROJECT)

      expect({ teamAlone: findingsOf(findings.teamAlone, code), merged: findingsOf(findings.merged, code) }).toStrictEqual({ teamAlone, merged })
    },
  )
})

const TEAM_TURNING_ARRAY_TYPE_ON = buildTeamOxlintConfig({ rules: { 'typescript/array-type': 'error' } })
const OURS_TURNING_ARRAY_TYPE_ON = { '@typescript-eslint/array-type': 'error' } as const satisfies OurRules

// Our ignores keep only our rules out of their files. A value ending in a slash names every folder of
// that name in both engines. ESLint's lib/** leaves out the folder itself, so a negated line under it
// takes no file back, where oxlint's .gitignore reading does (measured, ESLint 10.12, oxlint 1.87).
describe('a rule our ESLint part runs that oxlint has, merged into a team oxlint config that turns it on, beside our ignores', () => {
  it.each([
    {
      how: 'a folder ending in a slash, legacy/, which names every legacy folder',
      ignores: ['legacy/'],
      project: THE_TRAILING_SLASH_PROJECT,
      teamAlone: ['legacy/a.ts:1 typescript(array-type)', 'src/a.ts:1 typescript(array-type)', 'src/legacy/a.ts:1 typescript(array-type)'],
    },
    {
      how: 'lib/** and a negated line taking lib/a.ts back, which ESLint leaves out with the folder',
      ignores: ['lib/**', '!lib/a.ts'],
      project: THE_NEGATED_IGNORES_PROJECT,
      teamAlone: [
        'a.ts:1 typescript(array-type)',
        'lib/a.ts:1 typescript(array-type)',
        'lib/b.ts:1 typescript(array-type)',
        'src/a.ts:1 typescript(array-type)',
      ],
    },
  ])("keeps the team's findings of it in every file, where our ignores are $how", ({ ignores, project, teamAlone }) => {
    const findings = findingsWithTheTeamAloneAndMergedWith(
      { file: 'array-type-ignores.oxlint.config.mts', config: TEAM_TURNING_ARRAY_TYPE_ON },
      { rules: OURS_TURNING_ARRAY_TYPE_ON, ignores },
      project,
    )

    expect({ teamAlone: findingsOf(findings.teamAlone, ARRAY_TYPE), merged: findingsOf(findings.merged, ARRAY_TYPE) }).toStrictEqual({ teamAlone, merged: teamAlone })
  })
})

// ESLint's global ignores take lib/a.ts back from lib/**/*; either way the team's rule stands in every file.
describe('a rule our ESLint part runs that oxlint has, merged into a team oxlint config that turns it on, beside our ignores of lib/**/* and a negated line taking lib/a.ts back', () => {
  it("keeps the team's findings of it in every file", () => {
    const findings = findingsWithTheTeamAloneAndMergedWith(
      { file: 'array-type-negated.oxlint.config.mts', config: TEAM_TURNING_ARRAY_TYPE_ON },
      { rules: OURS_TURNING_ARRAY_TYPE_ON, ignores: ['lib/**/*', '!lib/a.ts'] },
      THE_NEGATED_IGNORES_PROJECT,
    )

    expect(findingsOf(findings.merged, ARRAY_TYPE)).toStrictEqual(findingsOf(findings.teamAlone, ARRAY_TYPE))
  })
})

// oxlint's .gitignore reading of lib/** leaves the folder in, so !lib/a.ts takes lib/a.ts back
// (measured, oxlint 1.87).
describe('our rules, merged into an empty team oxlint config, beside our ignores of lib/** and a negated line taking lib/a.ts back', () => {
  it('report in exactly the files the agent build reports in, lib/a.ts among them', () => {
    const defined = defineLintRules(
      buildConsumerLintRules(THE_NEGATED_IGNORES_PROJECT.projectDir, {}, { rules: { 'no-warning-comments': 'error' }, ignores: ['lib/**', '!lib/a.ts'] }),
    )
    const reportedIn = ['a.ts', 'lib/a.ts', 'src/a.ts']

    expect({
      merged: filesOxlintReportsIn(
        THE_NEGATED_IGNORES_PROJECT,
        'negated.merged.oxlint.config.mts',
        mergeOxlintConfig(buildTeamOxlintConfig(), defined.editorRulesets.oxlint, NO_TEAM_ESLINT_CONFIG),
        NO_WARNING_COMMENTS,
      ),
      agentBuild: filesOxlintReportsIn(
        THE_NEGATED_IGNORES_PROJECT,
        'negated.agent.oxlint.config.mts',
        buildOxlintConfig(agentSettingsOf(defined.editorRulesets.eslint), catalog),
        NO_WARNING_COMMENTS,
      ),
    }).toStrictEqual({ merged: reportedIn, agentBuild: reportedIn })
  })
})

// The team turns max-lines on, so it is the team's in every file, whatever an entry of ours says of it.
describe('max-lines, which our ESLint part runs and oxlint has, merged into a team oxlint config that turns it on, beside an entry of ours', () => {
  const inEveryFile = [
    'lib/b.ts:2 eslint(max-lines)',
    'lib/m.test.tsx:2 eslint(max-lines)',
    'lib/m.tsx:2 eslint(max-lines)',
    'src/a.ts:2 eslint(max-lines)',
    'src/f.tsx:2 eslint(max-lines)',
  ]

  it.each([
    {
      how: 'for lib/** listing complexity, which ships it, and turning it off in its own rules',
      entry: { files: ['lib/**'], editorRulesets: { quality: ['complexity'] }, rules: { 'max-lines': 'off' } },
    },
    {
      how: 'turning it on for lib/**, where it would run in the .tsx file but the test',
      entry: { files: ['lib/**'], rules: { 'max-lines': 'error' } },
    },
    {
      how: 'turning it on for src/**/*.ts, where it would run in no file',
      entry: { files: ['src/**/*.ts'], rules: { 'max-lines': 'error' } },
    },
  ] satisfies readonly { how: string; entry: NonNullable<OurFields['fileOverrides']>[number] }[])(
    "keeps the team's findings of it in every file, $how",
    ({ entry }) => {
      const findings = findingsWithTheTeamAloneAndMergedWith(
        { file: 'max-lines-entry.oxlint.config.mts', config: buildTeamOxlintConfig({ rules: { 'max-lines': ['error', { max: 1 }] } }) },
        { fileOverrides: [entry] },
        THE_MAX_LINES_PROJECT,
      )

      expect({ teamAlone: findingsOf(findings.teamAlone, MAX_LINES), merged: findingsOf(findings.merged, MAX_LINES) }).toStrictEqual({
        teamAlone: inEveryFile,
        merged: inEveryFile,
      })
    },
  )
})

// oxlint reads our ignores as .gitignore lines (measured, oxlint 1.87): a name with no slash but a last
// one matches in any folder. Our no-warning-comments, in no category the empty team config leaves on,
// draws a finding in every file.
describe('our ignores, merged into an empty team oxlint config', () => {
  const EVERY_A_JS = FOLDER_LAYOUT_FILES.filter((file) => file === 'a.js' || file.endsWith('/a.js'))

  it.each([
    { value: 'generated', ignored: ['generated/a.js', 'src/generated/a.js'] },
    { value: 'legacy/', ignored: ['legacy/a.js', 'src/legacy/deep/a.js'] },
    { value: '**/gen', ignored: ['gen/a.js', 'src/gen/a.js'] },
    { value: 'vendor/**', ignored: ['vendor/a.js', 'vendor/deep/a.js'] },
    { value: 'a.js', ignored: EVERY_A_JS },
  ])('keep our rules out of exactly the files the agent build leaves out: $value', ({ value, ignored }) => {
    const defined = defineLintRules(buildConsumerLintRules(THE_FOLDER_LAYOUT_PROJECT, {}, { rules: { 'no-warning-comments': 'error' }, ignores: [value] }))
    const name = value.replaceAll(/[^a-z]+/giu, '-')
    const reported = FOLDER_LAYOUT_FILES.filter((file) => !ignored.includes(file))

    expect({
      merged: filesOxlintReportsInTheFolderLayout(
        `ignores-${name}.merged.oxlint.config.mts`,
        mergeOxlintConfig(buildTeamOxlintConfig(), defined.editorRulesets.oxlint, NO_TEAM_ESLINT_CONFIG),
        NO_WARNING_COMMENTS,
      ),
      agentBuild: filesOxlintReportsInTheFolderLayout(
        `ignores-${name}.agent.oxlint.config.mts`,
        buildOxlintConfig(agentSettingsOf(defined.editorRulesets.eslint), catalog),
        NO_WARNING_COMMENTS,
      ),
    }).toStrictEqual({ merged: reported, agentBuild: reported })
  })
})
