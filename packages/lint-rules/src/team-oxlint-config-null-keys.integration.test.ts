import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { filesOf } from './__tests__/cases/other-engine-configs.ts'
import {
  ESLINT_CONFIG_NAMING_THE_TEAMS_OXLINTRC,
  type FileRead,
  FILES_THE_TEAMS_OXLINT_CONFIGS_EXTEND,
  nullKeyProblem,
  OXLINTRC_CATEGORIES_NULL,
  OXLINTRC_CATEGORIES_NULL_BESIDE_EXTENDS,
  nullBelowAKeyRefusalStart,
  OXLINTRC_EMPTY_OBJECTS,
  OXLINTRC_ENV_NULL,
  OXLINTRC_EXTENDING_A_FILE_HOLDING_A_RULE_NULL,
  OXLINTRC_EXTENDING_OPTIONS_NULL,
  OXLINTRC_HOLDING_NULLS_OXLINT_TAKES_BELOW_A_KEY,
  OXLINTRC_LISTING_NO_PLUGIN,
  OXLINTRC_OPTIONS_NULL,
  OXLINTRC_OVERRIDE_FILES_NULL,
  OXLINTRC_OVERRIDE_RULES_NULL,
  OXLINTRC_OVERRIDES_SLOT_NULL,
  OXLINTRC_PLUGINS_NULL,
  readRefusalOfANullBelowAKeyStart,
  readRefusalProblem,
  TEAM_OXLINTRC,
  THEIRS_CORRECTNESS_NULL,
  THEIRS_EXTENDING_AN_OBJECT_HOLDING_AN_ENV_NULL,
  THEIRS_EXTENDING_CATEGORIES_NULL,
  THEIRS_EXTENDS_SLOT_NULL,
  THEIRS_HOLDING_NULLS_OXLINT_TAKES_BELOW_A_KEY,
  THEIRS_LISTING_NO_PLUGIN,
  THEIRS_OPTIONS_EMPTY,
  THEIRS_OPTIONS_NULL,
  THEIRS_PLUGINS_NULL,
  THEIRS_PLUGINS_SECOND_SLOT_NULL,
  THEIRS_RULES_NULL,
  type TheirsGiven,
} from './__tests__/cases/team-oxlint-config-null-keys.ts'
import { NO_THIS_ALIAS, OURS_NO_THIS_ALIAS, THIS_ALIAS_SOURCE } from './__tests__/cases/team-sets-a-rule.ts'
import { bothEnginesFindingsOf, type ConsumerCliRuns, setUpConsumerCliRuns, setUpMergedAndTeamAloneCliRuns } from './__tests__/consumer-cli-runs.ts'
import { describeFinding, type EslintCliOutcome, eslintCliOutcomeOf, fatalMessagesIn, type OxlintCliOutcome, oxlintCliOutcomeOf, oxlintFindingsIn } from './__tests__/engine-clis.ts'
import { CONSUMER_CONFIG_FILES, mergedEslintConfigText, mergedOxlintConfigText, projectNamingEachConfigText } from './__tests__/factories/consumer-project-factories.ts'
import { buildConsumerSettings } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { buildTsconfig } from './__tests__/factories/tsconfig-factories.ts'
import { type FindingsByFileAndRule, findingsByFileAndRule } from './__tests__/findings-beside-the-team.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { runMadeFor, setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { CONSUMER_INSTALL, installedPackage, type ProjectFiles, type TempProjects } from './__tests__/temp-projects.ts'

// A team oxlint config holding null where oxlint itself refuses it, at a key or below one, in the config or in one it
// extends, stops each engine loading our merge with one line naming the file to fix and the path to the null. The
// fixture's eslint.config.mjs names its oxlint.config.mts, which calls mergeOxlintConfig, so ESLint reads the config
// through that call; a project whose eslint.config.mjs names a JSON config is read as JSON. plugins null, which oxlint
// takes as plugins left out, is read so by each.

allowEveryTestForParallelLoad()

const CONSUMER_FILES_DIR = fileURLToPath(new URL('../test-fixtures/consumer-files', import.meta.url))
const PROJECT_FILES: ProjectFiles = { 'tsconfig.json': JSON.stringify(buildTsconfig({ include: ['src'] })) }
const OXLINT_SENTINEL = 'src/debugger.ts:2 eslint(no-debugger)'
// V8's words for the TypeError each engine stopped at.
const READ_ON_NULL = 'Cannot read properties of null'
// What each merge stopped at, reading into a null below a key.
const STOPS_ON_A_NULL_BELOW_A_KEY = [READ_ON_NULL, 'Cannot convert undefined or null to object', "of 'object null' as it is null", "names no plugin of oxlint's"]
const TYPESCRIPT_ESLINT = installedPackage('typescript-eslint')
const THIS_ALIAS_FILE = 'src/a.ts'
const MERGED_AND_TEAM_ALONE = {
  merged: { oxlintConfigFile: CONSUMER_CONFIG_FILES.oxlint },
  teamAlone: { oxlintConfigFile: CONSUMER_CONFIG_FILES.teamAloneOxlint, eslintConfigFile: CONSUMER_CONFIG_FILES.teamAloneEslint },
}

type EslintRunOfAnOxlintrc = { readonly kind: string; readonly projectDir: string; readonly eslint: EslintCliOutcome }

type RunsOfAnOxlintConfigModule = {
  readonly kind: string
  readonly projectDir: string
  readonly oxlint: OxlintCliOutcome
  readonly eslint: EslintCliOutcome
}

function consumerProjectWith(tempProjects: TempProjects, files: ProjectFiles): string {
  return tempProjects.create({ fixturesDir: CONSUMER_FILES_DIR, files: { ...PROJECT_FILES, ...files }, linkedPackages: CONSUMER_INSTALL })
}

function eslintRunOfAnOxlintrc(tempProjects: TempProjects, { what, text }: FileRead): EslintRunOfAnOxlintrc {
  const projectDir = consumerProjectWith(tempProjects, {
    ...ESLINT_CONFIG_NAMING_THE_TEAMS_OXLINTRC,
    ...filesOf(FILES_THE_TEAMS_OXLINT_CONFIGS_EXTEND),
    [TEAM_OXLINTRC]: text,
  })
  return { kind: what, projectDir, eslint: eslintCliOutcomeOf(projectDir) }
}

/** As the fixture's, handing the merge `theirs`. */
function oxlintConfigModuleHandingOver(theirs: unknown): string {
  // @ts-expect-error the rows are typed unknown: an oxlint.config.mts nobody type-checks may hand the merge null where oxlint's type takes an object or nothing
  return mergedOxlintConfigText(CONSUMER_CONFIG_FILES.lintRules, theirs, { eslintConfig: CONSUMER_CONFIG_FILES.eslint })
}

function runsOfAnOxlintConfigModule(tempProjects: TempProjects, { what, theirs }: TheirsGiven): RunsOfAnOxlintConfigModule {
  const projectDir = consumerProjectWith(tempProjects, { [CONSUMER_CONFIG_FILES.oxlint]: oxlintConfigModuleHandingOver(theirs) })
  return { kind: what, projectDir, oxlint: oxlintCliOutcomeOf(projectDir, CONSUMER_CONFIG_FILES.oxlint), eslint: eslintCliOutcomeOf(projectDir) }
}

function stopsOnANullIn(output: string): string[] {
  return STOPS_ON_A_NULL_BELOW_A_KEY.filter((stop) => output.includes(stop))
}

function projectAliasingThisBeside(teamOxlint: unknown): ProjectFiles {
  return {
    'package.json': packageJsonText(buildPackageJsonListingOxlint()),
    // @ts-expect-error the rows are typed unknown: an oxlint.config.mts nobody type-checks may hand the merge null where oxlint's type takes a list or nothing
    ...projectNamingEachConfigText(buildConsumerSettings({}, { rules: OURS_NO_THIS_ALIAS }), { eslintBlockSources: [], oxlint: teamOxlint }),
    [THIS_ALIAS_FILE]: THIS_ALIAS_SOURCE,
  }
}

function projectAliasingThisBesideAnOxlintrc(text: string): ProjectFiles {
  return {
    ...projectAliasingThisBeside(null),
    [CONSUMER_CONFIG_FILES.eslint]: mergedEslintConfigText(CONSUMER_CONFIG_FILES.lintRules, CONSUMER_CONFIG_FILES.teamEslintModule, { oxlintConfig: TEAM_OXLINTRC }),
    [TEAM_OXLINTRC]: text,
  }
}

function noThisAliasFindingsOf(runs: ConsumerCliRuns): FindingsByFileAndRule {
  return findingsByFileAndRule(bothEnginesFindingsOf(runs), [THIS_ALIAS_FILE], [NO_THIS_ALIAS])
}

describe('a project whose eslint.config.mjs names its .oxlintrc.json, linted by the ESLint CLI through the built package', () => {
  const refused = [OXLINTRC_OPTIONS_NULL, OXLINTRC_CATEGORIES_NULL, OXLINTRC_CATEGORIES_NULL_BESIDE_EXTENDS, OXLINTRC_ENV_NULL, OXLINTRC_EXTENDING_OPTIONS_NULL]
  const runs = setUpRunsBeforeTheSuite((tempProjects) => [...refused, OXLINTRC_EMPTY_OBJECTS].map((oxlintrc) => eslintRunOfAnOxlintrc(tempProjects, oxlintrc)))

  it.each(refused)('is refused where .oxlintrc.json holds $what, ESLint printing one line naming the file and $key, and no TypeError', (row) => {
    const { projectDir, eslint } = runMadeFor(runs(), row.what)
    if (eslint.outcome === 'linted') throw new Error('ESLint linted the project')

    expect(eslint.output).toContain(`eslint.config.mjs: could not read your oxlint config at ${join(projectDir, TEAM_OXLINTRC)}: ${readRefusalProblem(row, projectDir)}`)
    expect(eslint.output).not.toContain(READ_ON_NULL)
  })

  it('is linted with no fatal message on any file where .oxlintrc.json holds options and categories as empty objects', () => {
    const { projectDir, eslint } = runMadeFor(runs(), OXLINTRC_EMPTY_OBJECTS.what)
    if (eslint.outcome === 'refused') throw new Error(`ESLint could not lint the project: ${eslint.output}`)

    expect(fatalMessagesIn(eslint.results, projectDir)).toStrictEqual([])
  })
})

describe("a project whose oxlint.config.mts hands mergeOxlintConfig the team's config, linted by oxlint through -c oxlint.config.mts and by the ESLint CLI through its eslint.config.mjs naming it", () => {
  const refused = [THEIRS_OPTIONS_NULL, THEIRS_RULES_NULL, THEIRS_EXTENDING_CATEGORIES_NULL]
  const runs = setUpRunsBeforeTheSuite((tempProjects) => [...refused, THEIRS_OPTIONS_EMPTY].map((theirs) => runsOfAnOxlintConfigModule(tempProjects, theirs)))

  it.each(refused)('is refused by oxlint where the config holds $what, oxlint printing our line naming oxlint.config.mts and $key, and no TypeError', ({ what, key, at }) => {
    const { oxlint } = runMadeFor(runs(), what)
    if (oxlint.outcome === 'linted') throw new Error('oxlint linted the project')

    expect(oxlint.output).toContain(`oxlint.config.mts: ${nullKeyProblem(key, at)}`)
    expect(oxlint.output).not.toContain(READ_ON_NULL)
  })

  it.each(refused)(
    "is refused by ESLint where the config holds $what, ESLint printing one line naming eslint.config.mjs, the module's path, oxlint.config.mts and $key, and no TypeError",
    ({ what, key, at }) => {
      const { projectDir, eslint } = runMadeFor(runs(), what)
      if (eslint.outcome === 'linted') throw new Error('ESLint linted the project')

      expect(eslint.output).toContain(
        `eslint.config.mjs: could not read your oxlint config at ${join(projectDir, CONSUMER_CONFIG_FILES.oxlint)}: oxlint.config.mts: ${nullKeyProblem(key, at)}`,
      )
      expect(eslint.output).not.toContain(READ_ON_NULL)
    },
  )

  it("is linted by oxlint, which reports the fixture's debugger statement, where the config holds options as an empty object", () => {
    const { oxlint } = runMadeFor(runs(), THEIRS_OPTIONS_EMPTY.what)
    if (oxlint.outcome === 'refused') throw new Error(`oxlint refused the config: ${oxlint.output}`)

    expect(oxlintFindingsIn(oxlint.run.report).map(describeFinding)).toContain(OXLINT_SENTINEL)
  })

  it('is linted by ESLint with no fatal message on any file where the config holds options as an empty object', () => {
    const { projectDir, eslint } = runMadeFor(runs(), THEIRS_OPTIONS_EMPTY.what)
    if (eslint.outcome === 'refused') throw new Error(`ESLint could not lint the project: ${eslint.output}`)

    expect(fatalMessagesIn(eslint.results, projectDir)).toStrictEqual([])
  })
})

describe('a project whose eslint.config.mjs names its .oxlintrc.json holding null below a key, linted by the ESLint CLI through the built package', () => {
  const refused = [OXLINTRC_OVERRIDE_FILES_NULL, OXLINTRC_OVERRIDE_RULES_NULL, OXLINTRC_OVERRIDES_SLOT_NULL, OXLINTRC_EXTENDING_A_FILE_HOLDING_A_RULE_NULL]
  const runs = setUpRunsBeforeTheSuite((tempProjects) =>
    [...refused, OXLINTRC_HOLDING_NULLS_OXLINT_TAKES_BELOW_A_KEY].map((oxlintrc) => eslintRunOfAnOxlintrc(tempProjects, oxlintrc)),
  )

  it.each(refused)('is refused where .oxlintrc.json holds $what, ESLint printing one line naming the file and the path to the null, and stopping at no TypeError', (row) => {
    const { projectDir, eslint } = runMadeFor(runs(), row.what)
    if (eslint.outcome === 'linted') throw new Error('ESLint linted the project')

    expect(eslint.output).toContain(`eslint.config.mjs: could not read your oxlint config at ${join(projectDir, TEAM_OXLINTRC)}: ${readRefusalOfANullBelowAKeyStart(row, projectDir)}`)
    expect(stopsOnANullIn(eslint.output)).toStrictEqual([])
  })

  it(`is linted with no fatal message on any file where .oxlintrc.json holds ${OXLINTRC_HOLDING_NULLS_OXLINT_TAKES_BELOW_A_KEY.what}`, () => {
    const { projectDir, eslint } = runMadeFor(runs(), OXLINTRC_HOLDING_NULLS_OXLINT_TAKES_BELOW_A_KEY.what)
    if (eslint.outcome === 'refused') throw new Error(`ESLint could not lint the project: ${eslint.output}`)

    expect(fatalMessagesIn(eslint.results, projectDir)).toStrictEqual([])
  })
})

describe("a project whose oxlint.config.mts hands mergeOxlintConfig a config holding null below a key, linted by oxlint through -c oxlint.config.mts and by the ESLint CLI through its eslint.config.mjs naming it", () => {
  const refused = [THEIRS_EXTENDS_SLOT_NULL, THEIRS_PLUGINS_SECOND_SLOT_NULL, THEIRS_CORRECTNESS_NULL, THEIRS_EXTENDING_AN_OBJECT_HOLDING_AN_ENV_NULL]
  const runs = setUpRunsBeforeTheSuite((tempProjects) =>
    [...refused, THEIRS_HOLDING_NULLS_OXLINT_TAKES_BELOW_A_KEY].map((theirs) => runsOfAnOxlintConfigModule(tempProjects, theirs)),
  )

  it.each(refused)('is refused by oxlint where the config holds $what, oxlint printing our line naming oxlint.config.mts and the path to the null, and stopping at no TypeError', ({ what, location, at }) => {
    const { oxlint } = runMadeFor(runs(), what)
    if (oxlint.outcome === 'linted') throw new Error('oxlint linted the project')

    expect(oxlint.output).toContain(`oxlint.config.mts: ${nullBelowAKeyRefusalStart(location, at)}`)
    expect(stopsOnANullIn(oxlint.output)).toStrictEqual([])
  })

  it.each(refused)(
    "is refused by ESLint where the config holds $what, ESLint printing one line naming eslint.config.mjs, the module's path, oxlint.config.mts and the path to the null, and stopping at no TypeError",
    ({ what, location, at }) => {
      const { projectDir, eslint } = runMadeFor(runs(), what)
      if (eslint.outcome === 'linted') throw new Error('ESLint linted the project')

      expect(eslint.output).toContain(
        `eslint.config.mjs: could not read your oxlint config at ${join(projectDir, CONSUMER_CONFIG_FILES.oxlint)}: oxlint.config.mts: ${nullBelowAKeyRefusalStart(location, at)}`,
      )
      expect(stopsOnANullIn(eslint.output)).toStrictEqual([])
    },
  )

  it(`is linted by oxlint, which reports the fixture's debugger statement, where the config holds ${THEIRS_HOLDING_NULLS_OXLINT_TAKES_BELOW_A_KEY.what}`, () => {
    const { oxlint } = runMadeFor(runs(), THEIRS_HOLDING_NULLS_OXLINT_TAKES_BELOW_A_KEY.what)
    if (oxlint.outcome === 'refused') throw new Error(`oxlint refused the config: ${oxlint.output}`)

    expect(oxlintFindingsIn(oxlint.run.report).map(describeFinding)).toContain(OXLINT_SENTINEL)
  })

  it(`is linted by ESLint with no fatal message on any file where the config holds ${THEIRS_HOLDING_NULLS_OXLINT_TAKES_BELOW_A_KEY.what}`, () => {
    const { projectDir, eslint } = runMadeFor(runs(), THEIRS_HOLDING_NULLS_OXLINT_TAKES_BELOW_A_KEY.what)
    if (eslint.outcome === 'refused') throw new Error(`ESLint could not lint the project: ${eslint.output}`)

    expect(fatalMessagesIn(eslint.results, projectDir)).toStrictEqual([])
  })
})

describe('no-this-alias, which ESLint runs for us, beside a team oxlint config writing correctness on that oxlint.config.mts hands mergeOxlintConfig and eslint.config.mjs names, linted by both CLIs', () => {
  const pluginsNull = setUpMergedAndTeamAloneCliRuns(projectAliasingThisBeside(THEIRS_PLUGINS_NULL.theirs), MERGED_AND_TEAM_ALONE, [TYPESCRIPT_ESLINT])
  const listingNoPlugin = setUpConsumerCliRuns(projectAliasingThisBeside(THEIRS_LISTING_NO_PLUGIN.theirs), CONSUMER_CONFIG_FILES.oxlint, [TYPESCRIPT_ESLINT])

  it("is the team's, reported once, by oxlint, as the team's configs alone report it, where the config holds plugins null", () => {
    const { merged, teamAlone } = pluginsNull()

    expect({ merged: noThisAliasFindingsOf(merged), teamAlone: noThisAliasFindingsOf(teamAlone) }).toStrictEqual({
      merged: { [THIS_ALIAS_FILE]: { '@typescript-eslint/no-this-alias': ['src/a.ts:4 typescript(no-this-alias)'] } },
      teamAlone: { [THIS_ALIAS_FILE]: { '@typescript-eslint/no-this-alias': ['src/a.ts:4 typescript(no-this-alias)'] } },
    })
  })

  it('is reported once, by ESLint, where the config holds plugins [], under which oxlint runs no typescript rule', () => {
    expect(noThisAliasFindingsOf(listingNoPlugin())).toStrictEqual({ [THIS_ALIAS_FILE]: { '@typescript-eslint/no-this-alias': ['src/a.ts:4 @typescript-eslint/no-this-alias'] } })
  })
})

describe('no-this-alias, which ESLint runs for us, beside a team .oxlintrc.json writing correctness on that eslint.config.mjs names, linted by ESLint and by oxlint given that config', () => {
  const pluginsNull = setUpConsumerCliRuns(projectAliasingThisBesideAnOxlintrc(OXLINTRC_PLUGINS_NULL.text), TEAM_OXLINTRC, [TYPESCRIPT_ESLINT])
  const listingNoPlugin = setUpConsumerCliRuns(projectAliasingThisBesideAnOxlintrc(OXLINTRC_LISTING_NO_PLUGIN.text), TEAM_OXLINTRC, [TYPESCRIPT_ESLINT])

  it("is the team's, reported once, by oxlint, where the config holds plugins null", () => {
    expect(noThisAliasFindingsOf(pluginsNull())).toStrictEqual({ [THIS_ALIAS_FILE]: { '@typescript-eslint/no-this-alias': ['src/a.ts:4 typescript(no-this-alias)'] } })
  })

  it('is reported once, by ESLint, where the config holds plugins [], under which oxlint runs no typescript rule', () => {
    expect(noThisAliasFindingsOf(listingNoPlugin())).toStrictEqual({ [THIS_ALIAS_FILE]: { '@typescript-eslint/no-this-alias': ['src/a.ts:4 @typescript-eslint/no-this-alias'] } })
  })
})
