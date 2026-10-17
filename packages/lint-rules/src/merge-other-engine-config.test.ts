import { join } from 'node:path'
import { catalog } from '@workspace/rule-data'
import type { OxlintConfig } from 'oxlint'
import { describe, expect, it } from 'vitest'
import {
  ARRAY_TYPE,
  ESLINT_CONFIG_HOLDING_EVERY_KEY,
  ESLINT_CONFIG_SETTING_NO_RULE_TEXT,
  FILES_THAT_ARE_NO_ESLINT_CONFIG,
  FILES_THAT_ARE_NO_OXLINT_CONFIG,
  filesOf,
  MAX_LINES,
  NO_DEBUGGER,
  NO_EMPTY_PATTERN,
  NO_EXPLICIT_ANY,
  NO_VAR,
  NO_WARNING_COMMENTS,
  OURS_BESIDE_THE_LEGACY_CONFIGS,
  OURS_NO_EXPLICIT_ANY_AND_DEBUGGER,
  OURS_RUN_BY_ESLINT,
  OURS_RUN_BY_OXLINT,
  OXLINT_CONFIG_SETTING_NO_RULE_TEXT,
  OXLINT_CONFIGS_HOLDING_EVERY_KEY,
  TEAM_ESLINT_BLOCKS_IN_LEGACY,
  TEAM_OXLINT_CONFIG_IN_LEGACY,
  TEAM_OXLINTRC_SETTING_RULES_IN_LEGACY,
  TEAM_OXLINTRC_EXTENDING_ONE_WRITING_CORRECTNESS_ON,
  TEAM_OXLINTRC_EXTENDING_THROUGH_A_FOLDER,
  TEAM_OXLINTRC_WRITING_CORRECTNESS_OFF,
  TEAM_OXLINTRC_WRITING_CORRECTNESS_ON,
  TEAM_OXLINTRC_WRITING_NO_CATEGORY,
  teamConfigsSettingRulesInLegacyFiles,
  teamOxlintrcExtendingThroughAFolderFiles,
  teamOxlintrcsBesideOxlintsOwnCorrectnessFiles,
  TEAMS_ESLINT_NO_EXPLICIT_ANY_OFF_UNDER_TS,
} from './__tests__/cases/other-engine-configs.ts'
import { BLOCK_TURNING_NO_DEBUGGER_OFF, OURS_NO_THIS_ALIAS } from './__tests__/cases/team-sets-a-rule.ts'
import { setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import { CONSUMER_CONFIG_FILES, eslintConfigCallingTheMergeTwiceText, projectNamingEachConfigText } from './__tests__/factories/consumer-project-factories.ts'
import { buildConsumerSettings } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJson, buildPackageJsonListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { buildTeamOxlintrcExtending } from './__tests__/factories/shape-factories.ts'
import { buildTeamOxlintConfig } from './__tests__/factories/team-config-factories.ts'
import {
  moduleAwaitingAtItsTopLevelText,
  moduleExportingByDefaultText,
  moduleThrowingText,
  teamOxlintrcTextWithTrailingCommas,
} from './__tests__/factories/team-config-file-factories.ts'
import { NOT_STATED, ourOxlintPartIn, ourPartsIn, projectListingOxlintIn, severityStatedFor } from './__tests__/other-engine-merges.ts'
import { mergedConfigsOf, setUpOxlintMergesInOneProcess } from './__tests__/oxlint-merges-in-one-process.ts'
import { oxlintSeverityFor } from './__tests__/oxlint-config-oracle.ts'
import {
  EMPTY_TEAM_OXLINT_CONFIG,
  NO_TEAM_ESLINT_CONFIG,
  NO_TEAM_OXLINT_CONFIG,
  TEAM_ESLINT_CONFIG_SETTING_NO_RULE,
  teamEslintConfigSettingNoRuleFiles,
} from './__tests__/team-configs-of-the-other-engine.ts'
import { installedPackage, type ProjectFiles, setUpTempProjects } from './__tests__/temp-projects.ts'
import { mergeEslintConfig } from './eslint.ts'
import { mergeOxlintConfig } from './oxlint.ts'

// Each merge takes the path of the team's other engine config, relative to tsconfigRootDir or null, to
// see the rules set only there. A config calling no merge of ours is read as its default export; one
// calling our merge for its own engine as what it hands that merge, which only the built package,
// loaded in a process of its own, shows (the last describe).

const tempProjects = setUpTempProjects()
const { ruleSeverityInProjectFor } = setUpEslintConfigOracle()

const OXLINT_CONFIG = 'oxlint.config.mts'
const ESLINT_CONFIG = 'eslint.config.mjs'
const TEAM_OXLINTRC_WRITING_TRAILING_COMMAS = 'team-trailing-commas.oxlintrc.json'
const MISSING_CONFIG = 'missing.config.mts'
const THROWING_CONFIG = 'throwing.config.mts'
const NOT_A_CONFIG = 'not-a-config.mts'
const AWAITING_CONFIG = 'awaiting.config.mts'
const THROWN_MESSAGE = 'the config could not be built'
const NO_CONFIG_BUT_A_NUMBER = 42
const SOURCE_FILE = 'src/a.tsx'
const JS_FILE_ELSEWHERE = 'lib/b.js'
const TOP_LEVEL_AWAIT_REFUSED = 'ERR_REQUIRE_ASYNC_MODULE'
const TOP_LEVEL_AWAIT_EXPLAINED = 'a config read while another loads cannot use top-level await'
const NO_THIS_ALIAS = '@typescript-eslint/no-this-alias'
const TYPESCRIPT_ESLINT = installedPackage('typescript-eslint')

// Config files that fail to load, each the way the spec's failure rows name, and nothing else.
const FAILING_CONFIG_FILES: ProjectFiles = {
  [THROWING_CONFIG]: moduleThrowingText(THROWN_MESSAGE),
  [NOT_A_CONFIG]: moduleExportingByDefaultText(NO_CONFIG_BUT_A_NUMBER),
  [AWAITING_CONFIG]: moduleAwaitingAtItsTopLevelText(buildTeamOxlintConfig()),
}

/** A project listing no oxlint, holding the files given. */
function projectListingNoOxlint(files: ProjectFiles = {}): string {
  return tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJson()), ...files } })
}

/** The name oxlint runs a rule of ours under: throws for a rule it has no version of. */
function oxlintNameOf(ruleId: string): string {
  const route = catalog.rules.get(ruleId)
  if (route === undefined || route.oxlintName === null) throw new Error(`oxlint runs no ${ruleId} of ours`)
  return route.oxlintName
}

/** The error the call throws, for a test of its cause: throws where the call does not. */
function errorThrownBy(call: () => unknown): Error {
  try {
    call()
  } catch (error) {
    if (error instanceof Error) return error
    throw new Error('the call threw something that is no Error', { cause: error })
  }
  throw new Error('the call threw nothing')
}

/** The error's message, and the code of its cause, which Node gives the errors it throws. */
function messageAndCauseCodeOf(error: Error): { readonly message: string; readonly causeCode: unknown } {
  return { message: error.message, causeCode: error.cause instanceof Error && 'code' in error.cause ? error.cause.code : error.cause }
}

describe("mergeEslintConfig's third argument, in a project whose package.json lists oxlint", () => {
  const projectDir = projectListingOxlintIn(tempProjects, { [OXLINT_CONFIG]: OXLINT_CONFIG_SETTING_NO_RULE_TEXT, ...FAILING_CONFIG_FILES })
  const { eslint } = ourPartsIn(projectDir)

  it.each([
    // @ts-expect-error the third argument is required
    { how: 'left out', merge: () => mergeEslintConfig([], eslint) },
    // @ts-expect-error oxlintConfig is required
    { how: 'given without its key', merge: () => mergeEslintConfig([], eslint, {}) },
  ])('is refused where it is $how, the error naming eslint.config.mjs and both ways to give it', ({ merge }) => {
    expect(merge).toThrowError(
      new Error(
        "eslint.config.mjs: mergeEslintConfig needs the path of your oxlint config as its third argument, { oxlintConfig: 'oxlint.config.mts' }, or { oxlintConfig: null } if this project has none: the package.json nearest to tsconfigRootDir lists oxlint",
      ),
    )
  })

  it('is refused where oxlintConfig is neither a path nor null, the error describing what it was given', () => {
    // @ts-expect-error a number is no path
    expect(() => mergeEslintConfig([], eslint, { oxlintConfig: NO_CONFIG_BUT_A_NUMBER })).toThrowError(
      new Error('eslint.config.mjs: oxlintConfig must be a path or null, and was given number 42'),
    )
  })

  it('is refused where the path names no file, the error giving the path as read from tsconfigRootDir', () => {
    expect(() => mergeEslintConfig([], eslint, { oxlintConfig: MISSING_CONFIG })).toThrowError(
      new Error(`eslint.config.mjs: oxlintConfig names ${join(projectDir, MISSING_CONFIG)}, where there is no file`),
    )
  })

  it('is refused where the file it names throws, with what it threw as the cause', () => {
    const error = errorThrownBy(() => mergeEslintConfig([], eslint, { oxlintConfig: THROWING_CONFIG }))

    expect({ message: error.message, cause: error.cause instanceof Error ? error.cause.message : error.cause }).toStrictEqual({
      message: `eslint.config.mjs: could not read your oxlint config at ${join(projectDir, THROWING_CONFIG)}: ${THROWN_MESSAGE}`,
      cause: THROWN_MESSAGE,
    })
  })

  it('is refused where the file it names exports no object by default, the error saying what it exports', () => {
    expect(() => mergeEslintConfig([], eslint, { oxlintConfig: NOT_A_CONFIG })).toThrowError(
      new Error(`eslint.config.mjs: could not read your oxlint config at ${join(projectDir, NOT_A_CONFIG)}: its default export is number 42, not an oxlint config object`),
    )
  })

  it("is refused where the file it names awaits at its top level, saying so, with Node's refusal as the cause", () => {
    expect(messageAndCauseCodeOf(errorThrownBy(() => mergeEslintConfig([], eslint, { oxlintConfig: AWAITING_CONFIG })))).toStrictEqual({
      message: `eslint.config.mjs: could not read your oxlint config at ${join(projectDir, AWAITING_CONFIG)}: ${TOP_LEVEL_AWAIT_EXPLAINED}`,
      causeCode: TOP_LEVEL_AWAIT_REFUSED,
    })
  })

  it.each([
    { how: 'null, the project having no oxlint config', given: NO_TEAM_OXLINT_CONFIG },
    { how: 'a path relative to tsconfigRootDir naming a config', given: { oxlintConfig: OXLINT_CONFIG } },
    { how: 'an absolute path naming a config', given: { oxlintConfig: join(projectDir, OXLINT_CONFIG) } },
  ])('is accepted where it is $how', ({ given }) => {
    expect(() => mergeEslintConfig([], eslint, given)).not.toThrow()
  })
})

describe("mergeEslintConfig's third argument, in a project whose package.json lists no oxlint", () => {
  const projectDir = projectListingNoOxlint()
  const { eslint } = ourPartsIn(projectDir)

  // No oxlint runs there, so no rule of the team's is set in it.
  it.each([
    // @ts-expect-error the third argument is required
    { how: 'left out', merge: () => mergeEslintConfig([], eslint) },
    { how: 'a path naming no file', merge: () => mergeEslintConfig([], eslint, { oxlintConfig: MISSING_CONFIG }) },
  ])('is not read where it is $how', ({ merge }) => {
    expect(merge).not.toThrow()
  })
})

describe("mergeOxlintConfig's third argument", () => {
  const projectDir = projectListingOxlintIn(tempProjects, { [ESLINT_CONFIG]: ESLINT_CONFIG_SETTING_NO_RULE_TEXT, ...FAILING_CONFIG_FILES })
  const oxlint = ourOxlintPartIn(projectDir)

  it.each([
    // @ts-expect-error the third argument is required
    { how: 'left out', merge: () => mergeOxlintConfig({}, oxlint) },
    // @ts-expect-error eslintConfig is required
    { how: 'given without its key', merge: () => mergeOxlintConfig({}, oxlint, {}) },
  ])('is refused where it is $how, the error naming oxlint.config.mts and both ways to give it', ({ merge }) => {
    expect(merge).toThrowError(
      new Error(
        "oxlint.config.mts: mergeOxlintConfig needs the path of your ESLint config as its third argument, { eslintConfig: 'eslint.config.mjs' }, or { eslintConfig: null } if this project has none",
      ),
    )
  })

  it('is refused where eslintConfig is neither a path nor null, the error describing what it was given', () => {
    // @ts-expect-error a number is no path
    expect(() => mergeOxlintConfig({}, oxlint, { eslintConfig: NO_CONFIG_BUT_A_NUMBER })).toThrowError(
      new Error('oxlint.config.mts: eslintConfig must be a path or null, and was given number 42'),
    )
  })

  it('is refused where the path names no file, the error giving the path as read from tsconfigRootDir', () => {
    expect(() => mergeOxlintConfig({}, oxlint, { eslintConfig: MISSING_CONFIG })).toThrowError(
      new Error(`oxlint.config.mts: eslintConfig names ${join(projectDir, MISSING_CONFIG)}, where there is no file`),
    )
  })

  it('is refused where the file it names throws, with what it threw as the cause', () => {
    const error = errorThrownBy(() => mergeOxlintConfig({}, oxlint, { eslintConfig: THROWING_CONFIG }))

    expect({ message: error.message, cause: error.cause instanceof Error ? error.cause.message : error.cause }).toStrictEqual({
      message: `oxlint.config.mts: could not read your ESLint config at ${join(projectDir, THROWING_CONFIG)}: ${THROWN_MESSAGE}`,
      cause: THROWN_MESSAGE,
    })
  })

  // ESLint's own defineConfig refuses it (measured, ESLint 10.12), and its message is the cause's.
  it("is refused where the file it names exports no object by default, the error giving ESLint's refusal", () => {
    expect(() => mergeOxlintConfig({}, oxlint, { eslintConfig: NOT_A_CONFIG })).toThrowError(
      new Error(`oxlint.config.mts: could not read your ESLint config at ${join(projectDir, NOT_A_CONFIG)}: Expected an object but received 42.`),
    )
  })

  it("is refused where the file it names awaits at its top level, saying so, with Node's refusal as the cause", () => {
    expect(messageAndCauseCodeOf(errorThrownBy(() => mergeOxlintConfig({}, oxlint, { eslintConfig: AWAITING_CONFIG })))).toStrictEqual({
      message: `oxlint.config.mts: could not read your ESLint config at ${join(projectDir, AWAITING_CONFIG)}: ${TOP_LEVEL_AWAIT_EXPLAINED}`,
      causeCode: TOP_LEVEL_AWAIT_REFUSED,
    })
  })

  it.each([
    { how: 'null, the project having no ESLint config', given: NO_TEAM_ESLINT_CONFIG },
    { how: 'a path relative to tsconfigRootDir naming a config', given: { eslintConfig: ESLINT_CONFIG } },
  ])('is accepted where it is $how', ({ given }) => {
    expect(() => mergeOxlintConfig({}, oxlint, given)).not.toThrow()
  })
})

// A file that is no config of the other engine is refused by its keys: any key no config of that
// engine holds refuses it, the error listing those keys in the file's order. A tsconfig.json is judged
// before what it extends is read, an ESLint config block by block.
describe("a file named as the team's oxlint config, read by mergeEslintConfig", () => {
  const projectDir = projectListingOxlintIn(tempProjects, { ...filesOf(FILES_THAT_ARE_NO_OXLINT_CONFIG), ...filesOf(OXLINT_CONFIGS_HOLDING_EVERY_KEY) })
  const { eslint } = ourPartsIn(projectDir, OURS_RUN_BY_ESLINT)

  it.each(FILES_THAT_ARE_NO_OXLINT_CONFIG)('is refused where it is $what, the error naming the keys no oxlint config holds', ({ file, foreignKeys }) => {
    expect(() => mergeEslintConfig([], eslint, { oxlintConfig: file })).toThrowError(
      new Error(`eslint.config.mjs: could not read your oxlint config at ${join(projectDir, file)}: it is not an oxlint config: no oxlint config holds ${foreignKeys}`),
    )
  })

  it.each(OXLINT_CONFIGS_HOLDING_EVERY_KEY)(
    'is read where it is $form: our part drops no-var, which it turns off, and keeps array-type',
    async ({ file }) => {
      const merged = mergeEslintConfig([], eslint, { oxlintConfig: file })

      expect({
        noVar: await ruleSeverityInProjectFor(projectDir, merged, SOURCE_FILE, NO_VAR),
        arrayType: await ruleSeverityInProjectFor(projectDir, merged, SOURCE_FILE, ARRAY_TYPE),
      }).toStrictEqual({ noVar: undefined, arrayType: 'error' })
    },
  )
})

describe("a file named as the team's ESLint config, read by mergeOxlintConfig", () => {
  const projectDir = projectListingOxlintIn(tempProjects, { ...filesOf(FILES_THAT_ARE_NO_ESLINT_CONFIG), ...filesOf([ESLINT_CONFIG_HOLDING_EVERY_KEY]) })
  const oxlint = ourOxlintPartIn(projectDir, OURS_RUN_BY_OXLINT)

  it.each(FILES_THAT_ARE_NO_ESLINT_CONFIG)('is refused where it is $what, the error naming the keys no ESLint config holds', ({ file, foreignKeys }) => {
    expect(() => mergeOxlintConfig(buildTeamOxlintConfig(), oxlint, { eslintConfig: file })).toThrowError(
      new Error(`oxlint.config.mts: could not read your ESLint config at ${join(projectDir, file)}: it is not an ESLint config: no ESLint config holds ${foreignKeys}`),
    )
  })

  it('is read where its block holds every key an ESLint block can hold: our part drops no-debugger, which it turns off, and keeps no-empty-pattern', () => {
    const merged = mergeOxlintConfig(buildTeamOxlintConfig(), oxlint, { eslintConfig: ESLINT_CONFIG_HOLDING_EVERY_KEY.file })

    expect({ noDebugger: severityStatedFor(merged, SOURCE_FILE, NO_DEBUGGER), noEmptyPattern: severityStatedFor(merged, SOURCE_FILE, NO_EMPTY_PATTERN) }).toStrictEqual({
      noDebugger: NOT_STATED,
      noEmptyPattern: 'error',
    })
  })
})

// Only what the team's oxlint config writes counts: null, a config writing no category, and oxlint's
// default correctness: warn set no rule; correctness written on sets each rule of that category of
// oxlint's default plugins. oxlint's no-this-alias is in it, under typescript.
describe('mergeEslintConfig, in a project whose package.json lists oxlint, given an oxlint config that writes no category, or writes correctness on', () => {
  const projectDir = projectListingOxlintIn(tempProjects, teamOxlintrcsBesideOxlintsOwnCorrectnessFiles)
  const { eslint } = ourPartsIn(projectDir, OURS_NO_THIS_ALIAS)

  it.each([
    { how: 'null, the project having none', given: NO_TEAM_OXLINT_CONFIG },
    { how: 'a config writing no category', given: { oxlintConfig: TEAM_OXLINTRC_WRITING_NO_CATEGORY } },
    { how: 'a config writing correctness off', given: { oxlintConfig: TEAM_OXLINTRC_WRITING_CORRECTNESS_OFF } },
  ])('keeps no-this-alias ours where the oxlint config given is $how', async ({ given }) => {
    expect(await ruleSeverityInProjectFor(projectDir, mergeEslintConfig([], eslint, given), SOURCE_FILE, NO_THIS_ALIAS)).toBe('error')
  })

  it.each([
    { how: 'writes correctness on', given: { oxlintConfig: TEAM_OXLINTRC_WRITING_CORRECTNESS_ON } },
    { how: 'extends, by path, a config that writes correctness on', given: { oxlintConfig: TEAM_OXLINTRC_EXTENDING_ONE_WRITING_CORRECTNESS_ON } },
  ])('drops no-this-alias from our part where the oxlint config given $how', async ({ given }) => {
    expect(await ruleSeverityInProjectFor(projectDir, mergeEslintConfig([], eslint, given), SOURCE_FILE, NO_THIS_ALIAS)).toBeUndefined()
  })
})

// Where oxlint's default correctness: warn would run its copy of a rule our ESLint part runs, the oxlint
// merge switches that copy off in every file; where the team writes correctness on, the rule is the
// team's. Which rules our ESLint part runs is read from our parts.
describe("mergeOxlintConfig, beside our ESLint part running no-this-alias, whose oxlint version is in oxlint's correctness category", () => {
  const oxlint = ourOxlintPartIn(projectListingOxlintIn(tempProjects, teamEslintConfigSettingNoRuleFiles), OURS_NO_THIS_ALIAS)
  const files = [SOURCE_FILE, JS_FILE_ELSEWHERE]

  it.each([
    { how: 'leaves its categories out', team: buildTeamOxlintConfig() },
    { how: 'writes another category on, and leaves correctness out', team: buildTeamOxlintConfig({ categories: { style: 'warn' } }) },
  ])("turns oxlint's no-this-alias off in every file where the team's config $how", ({ team }) => {
    const merged = mergeOxlintConfig(team, oxlint, TEAM_ESLINT_CONFIG_SETTING_NO_RULE)

    expect(files.map((file) => severityStatedFor(merged, file, NO_THIS_ALIAS))).toStrictEqual(['off', 'off'])
  })

  it("states nothing of oxlint's no-this-alias where the team's config writes correctness on, which runs it as the team's", () => {
    const merged = mergeOxlintConfig(buildTeamOxlintConfig({ categories: { correctness: 'warn' } }), oxlint, TEAM_ESLINT_CONFIG_SETTING_NO_RULE)

    expect(files.map((file) => severityStatedFor(merged, file, NO_THIS_ALIAS))).toStrictEqual([NOT_STATED, NOT_STATED])
  })
})

// oxlint itself refuses a path in `extends` of a JS or TS config, so the merge refuses it first,
// naming what to do instead.
describe('a team oxlint config handed to mergeOxlintConfig', () => {
  const oxlint = ourOxlintPartIn(projectListingOxlintIn(tempProjects))

  it('is refused where its extends holds a path, the error naming the entry and what to do instead', () => {
    expect(() => mergeOxlintConfig(buildTeamOxlintrcExtending(['./base.json']), oxlint, NO_TEAM_ESLINT_CONFIG)).toThrowError(
      new Error('oxlint.config.mts: extends[0] is a path, which oxlint refuses in a JS or TS config: import that file and put the object in extends'),
    )
  })

  it('is accepted where its extends holds objects alone', () => {
    expect(() => mergeOxlintConfig(buildTeamOxlintConfig({ extends: [buildTeamOxlintConfig({ rules: { [NO_DEBUGGER]: 'off' } })] }), oxlint, NO_TEAM_ESLINT_CONFIG)).not.toThrow()
  })
})

// A JSON oxlint config is read as oxlint reads it (measured, oxlint 1.87 --print-config): comments
// and trailing commas allowed, and each path in extends read from the folder of the config naming it,
// at any depth.
describe('a team JSON oxlint config, read by mergeEslintConfig', () => {
  const projectDir = projectListingOxlintIn(tempProjects, {
    ...teamOxlintrcExtendingThroughAFolderFiles,
    [TEAM_OXLINTRC_WRITING_TRAILING_COMMAS]: teamOxlintrcTextWithTrailingCommas(NO_VAR),
  })
  const { eslint } = ourPartsIn(projectDir, OURS_RUN_BY_ESLINT)

  it('drops from our part a rule a config it extends, through another by path, sets; and keeps the rule the team sets nowhere', async () => {
    const merged = mergeEslintConfig([], eslint, { oxlintConfig: TEAM_OXLINTRC_EXTENDING_THROUGH_A_FOLDER })

    expect({
      noVar: await ruleSeverityInProjectFor(projectDir, merged, SOURCE_FILE, NO_VAR),
      arrayType: await ruleSeverityInProjectFor(projectDir, merged, SOURCE_FILE, ARRAY_TYPE),
    }).toStrictEqual({ noVar: undefined, arrayType: 'error' })
  })

  it('drops from our part a rule a config writing a comma after the last entry of each object and array sets; and keeps the rule the team sets nowhere', async () => {
    const merged = mergeEslintConfig([], eslint, { oxlintConfig: TEAM_OXLINTRC_WRITING_TRAILING_COMMAS })

    expect({
      noVar: await ruleSeverityInProjectFor(projectDir, merged, SOURCE_FILE, NO_VAR),
      arrayType: await ruleSeverityInProjectFor(projectDir, merged, SOURCE_FILE, ARRAY_TYPE),
    }).toStrictEqual({ noVar: undefined, arrayType: 'error' })
  })
})

// Both merges read the same set of rules the team sets from the same pair of configs: each must drop
// the rules the other config sets as well as its own, in every file.
describe('both merges, given one pair of team configs, each naming the other', () => {
  const projectDir = projectListingOxlintIn(tempProjects, teamConfigsSettingRulesInLegacyFiles)
  const { eslint } = ourPartsIn(projectDir, OURS_BESIDE_THE_LEGACY_CONFIGS)
  const oxlint = ourOxlintPartIn(projectDir, OURS_BESIDE_THE_LEGACY_CONFIGS)

  it('drop, each from its own engine, every rule either config sets, and no other, where neither config reaches', async () => {
    const mergedEslint = mergeEslintConfig(TEAM_ESLINT_BLOCKS_IN_LEGACY, eslint, { oxlintConfig: TEAM_OXLINTRC_SETTING_RULES_IN_LEGACY })
    const mergedOxlint = mergeOxlintConfig(TEAM_OXLINT_CONFIG_IN_LEGACY, oxlint, { eslintConfig: ESLINT_CONFIG })
    const eslintSeverities = await Promise.all(
      [MAX_LINES, NO_VAR, ARRAY_TYPE].map(async (ruleId) => [ruleId, await ruleSeverityInProjectFor(projectDir, mergedEslint, SOURCE_FILE, ruleId)]),
    )

    expect({
      runByOurEslintPart: eslintSeverities.filter(([, severity]) => severity === 'error').map(([ruleId]) => ruleId),
      runByOurOxlintPart: [NO_WARNING_COMMENTS, NO_DEBUGGER, NO_EMPTY_PATTERN].filter(
        (ruleId) => oxlintSeverityFor(mergedOxlint, SOURCE_FILE, oxlintNameOf(ruleId)) === 'error',
      ),
    }).toStrictEqual({ runByOurEslintPart: [ARRAY_TYPE], runByOurOxlintPart: [NO_EMPTY_PATTERN] })
  })
})

// A config calling our merge for its own engine is read as what it hands that merge, with the plugins
// we register; on a later read in the same process, Node serves the cached module without calling the
// merge again. Our oxlint part is merged in a process loading the built package, as a team's oxlint run does.
describe('mergeOxlintConfig, reading a team ESLint config that calls mergeEslintConfig', () => {
  const settings = buildConsumerSettings({}, { rules: OURS_NO_EXPLICIT_ANY_AND_DEBUGGER })
  const projectFiles: ProjectFiles = {
    'package.json': packageJsonText(buildPackageJsonListingOxlint()),
    ...projectNamingEachConfigText(settings, { eslintBlockSources: [TEAMS_ESLINT_NO_EXPLICIT_ANY_OFF_UNDER_TS], oxlint: EMPTY_TEAM_OXLINT_CONFIG }),
  }
  const merges = { theirs: EMPTY_TEAM_OXLINT_CONFIG, eslintConfig: CONSUMER_CONFIG_FILES.eslint }
  const twoMerges = setUpOxlintMergesInOneProcess(projectFiles, { ...merges, times: 2 }, [TYPESCRIPT_ESLINT])
  const callingTheMergeTwice = setUpOxlintMergesInOneProcess(
    {
      ...projectFiles,
      [CONSUMER_CONFIG_FILES.eslint]: eslintConfigCallingTheMergeTwiceText(
        CONSUMER_CONFIG_FILES.lintRules,
        CONSUMER_CONFIG_FILES.teamEslintModule,
        { oxlintConfig: CONSUMER_CONFIG_FILES.oxlint },
        BLOCK_TURNING_NO_DEBUGGER_OFF,
      ),
    },
    { ...merges, times: 1 },
    [TYPESCRIPT_ESLINT],
  )
  // The team turns no-explicit-any off, so it is the team's; no-debugger, which it sets nowhere, stays ours.
  const OWED = { noExplicitAny: NOT_STATED, noDebugger: 'error' }

  function statedFor(merged: OxlintConfig): typeof OWED {
    return { noExplicitAny: severityStatedFor(merged, SOURCE_FILE, NO_EXPLICIT_ANY), noDebugger: severityStatedFor(merged, SOURCE_FILE, NO_DEBUGGER) }
  }

  it("drops from our part no-explicit-any, which the team's config turns off under ts/, the prefix it registers typescript-eslint under; and keeps no-debugger", () => {
    expect(mergedConfigsOf(twoMerges()).map(statedFor).at(0)).toStrictEqual(OWED)
  })

  it('drops it in a second merge in the same process too, which reads the config Node cached, its merge not called again', () => {
    expect(mergedConfigsOf(twoMerges()).map(statedFor)).toStrictEqual([OWED, OWED])
  })

  it("is refused where the team's ESLint config calls mergeEslintConfig twice, which leaves no one config to read, the error naming the calls", () => {
    const { projectDir, outcome } = callingTheMergeTwice()

    expect(outcome).toStrictEqual({
      refused: `oxlint.config.mts: could not read your ESLint config at ${join(projectDir, CONSUMER_CONFIG_FILES.eslint)}: it calls mergeEslintConfig 2 times, where one call gives the team's config`,
    })
  })
})
