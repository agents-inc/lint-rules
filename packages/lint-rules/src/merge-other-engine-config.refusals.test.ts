import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ESLINT_CONFIG_NESTING_ENV,
  ESLINT_CONFIG_NESTING_NO_DEBUGGER_OFF,
  JSON_FILE_HOLDING_AN_OBJECT,
  JSON_FILES_HOLDING_NO_OBJECT,
  KEYS_OF_THE_EXTENDED_TSCONFIG_NO_OXLINT_CONFIG_HOLDS,
  MODULE_EXPORTING_AN_OBJECT,
  MODULES_EXPORTING_NO_OBJECT,
  MODULES_FAILING_AS_THEY_LOAD,
  OXLINTRC_EXTENDING_A_TSCONFIG,
  OXLINTRC_EXTENDING_A_TSCONFIG_FILES,
  VALUES_THAT_ARE_NO_PATH,
} from './__tests__/cases/other-engine-config-refusals.ts'
import {
  filesOf,
  NO_DEBUGGER,
  NO_EMPTY_PATTERN,
  NO_VAR,
  OURS_NO_EXPLICIT_ANY_AND_DEBUGGER,
  OURS_RUN_BY_ESLINT,
  OURS_RUN_BY_OXLINT,
  TEAM_OXLINTRC_EXTENDING_THROUGH_A_FOLDER,
  teamOxlintrcExtendingThroughAFolderFiles,
} from './__tests__/cases/other-engine-configs.ts'
import { NO_THIS_ALIAS } from './__tests__/cases/oxlint-categories-and-plugin-names.ts'
import {
  FILES_THE_TEAMS_OXLINT_CONFIGS_EXTEND,
  MODULES_HOLDING_A_NULL_BELOW_A_KEY,
  MODULES_HOLDING_A_NULL_KEY,
  MODULES_LEAVING_NO_THIS_ALIAS_OUT,
  MODULES_READ,
  MODULES_RUNNING_NO_THIS_ALIAS,
  nullBelowAKeyRefusalStart,
  nullKeyProblem,
  OXLINTRCS_HOLDING_A_NULL_BELOW_A_KEY,
  OXLINTRCS_HOLDING_A_NULL_KEY,
  OXLINTRCS_LEAVING_NO_THIS_ALIAS_OUT,
  OXLINTRCS_LEFT_TO_OXLINT,
  OXLINTRCS_READ,
  OXLINTRCS_RUNNING_NO_THIS_ALIAS,
  readRefusalOfANullBelowAKeyStart,
  readRefusalProblem,
  THEIRS_HOLDING_A_NULL_AT_A_KEY_OXLINT_REQUIRES,
  THEIRS_HOLDING_A_NULL_BELOW_A_KEY,
  THEIRS_HOLDING_A_NULL_KEY,
  THEIRS_HOLDING_A_PATH_BESIDE_OPTIONS_NULL,
  THEIRS_LEAVING_NO_THIS_ALIAS_OUT,
  THEIRS_LEFT_TO_OXLINT,
  THEIRS_MERGED,
  THEIRS_RUNNING_NO_THIS_ALIAS,
} from './__tests__/cases/team-oxlint-config-null-keys.ts'
import { OURS_NO_THIS_ALIAS } from './__tests__/cases/team-sets-a-rule.ts'
import { setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import { buildTeamOxlintConfig } from './__tests__/factories/team-config-factories.ts'
import { NOT_STATED, ourOxlintPartIn, ourPartsIn, projectListingOxlintIn, severityStatedFor } from './__tests__/other-engine-merges.ts'
import { PARALLEL_LOAD_TIMEOUT_MS } from './__tests__/parallel-load.ts'
import { type RunsBeforeTheSuiteOptions, setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { NO_TEAM_ESLINT_CONFIG, NO_TEAM_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'
import { mergeEslintConfig } from './eslint.ts'
import { mergeOxlintConfig } from './oxlint.ts'

// The error names the config file calling the merge and describes what it was given, each kind in its
// own words; a module failing as it loads gives its own reason. An ESLint config is judged by every
// block at any depth, and a JSON oxlint config by every config it extends by path.

const tempProjects = setUpTempProjects()
const { ruleSeverityInProjectFor } = setUpEslintConfigOracle()

const SOURCE_FILE = 'src/a.tsx'
const ADVICE_TO_LEAVE_IT_OUT = 'leave it out'
const PROJECT_WRITTEN: RunsBeforeTheSuiteOptions = { timeoutMs: PARALLEL_LOAD_TIMEOUT_MS, whatFailed: 'the project could not be written before the suite' }

describe("mergeEslintConfig's third argument, where it is neither a path nor null", () => {
  const projectDir = projectListingOxlintIn(tempProjects)

  it.each(VALUES_THAT_ARE_NO_PATH)('is refused where oxlintConfig is $what, the error describing it as $described', ({ value, described }) => {
    const { eslint } = ourPartsIn(projectDir)
    // @ts-expect-error oxlintConfig is a path or null
    expect(() => mergeEslintConfig([], eslint, { oxlintConfig: value })).toThrow(
      new Error(`eslint.config.mjs: oxlintConfig must be a path or null, and was given ${described}`),
    )
  })

  it('is accepted where oxlintConfig is null, the project having no oxlint config', () => {
    const { eslint } = ourPartsIn(projectDir)

    expect(() => mergeEslintConfig([], eslint, NO_TEAM_OXLINT_CONFIG)).not.toThrow()
  })
})

// Neither a path nor null, it is refused by its type alone (merge-oxlint-config.test-d.ts; what an untyped
// oxlint.config.mts gets instead: untyped-oxlint-config.test.ts).
describe("mergeOxlintConfig's third argument", () => {
  const projectDir = projectListingOxlintIn(tempProjects)

  it('is accepted where eslintConfig is null, the project having no ESLint config', () => {
    const oxlint = ourOxlintPartIn(projectDir)

    expect(() => mergeOxlintConfig(buildTeamOxlintConfig(), oxlint, { eslintConfig: null })).not.toThrow()
  })
})

describe("a file named as the team's oxlint config that holds no config object, read by mergeEslintConfig", () => {
  const projectDir = projectListingOxlintIn(tempProjects, filesOf([...JSON_FILES_HOLDING_NO_OBJECT, JSON_FILE_HOLDING_AN_OBJECT, ...MODULES_EXPORTING_NO_OBJECT, MODULE_EXPORTING_AN_OBJECT]))

  it.each(JSON_FILES_HOLDING_NO_OBJECT)('is refused where it is JSON holding $what, the error saying it holds $described', ({ file, described }) => {
    const { eslint } = ourPartsIn(projectDir)
    const path = join(projectDir, file)

    expect(() => mergeEslintConfig([], eslint, { oxlintConfig: file })).toThrow(
      new Error(`eslint.config.mjs: could not read your oxlint config at ${path}: ${path} holds ${described}, not a JSON object`),
    )
  })

  it('is read where it is JSON holding an object', () => {
    const { eslint } = ourPartsIn(projectDir)

    expect(() => mergeEslintConfig([], eslint, { oxlintConfig: JSON_FILE_HOLDING_AN_OBJECT.file })).not.toThrow()
  })

  it.each(MODULES_EXPORTING_NO_OBJECT)('is refused where it is a module exporting $what by default, the error saying it exports $described', ({ file, described }) => {
    const { eslint } = ourPartsIn(projectDir)

    expect(() => mergeEslintConfig([], eslint, { oxlintConfig: file })).toThrow(
      new Error(`eslint.config.mjs: could not read your oxlint config at ${join(projectDir, file)}: its default export is ${described}, not an oxlint config object`),
    )
  })

  it('is read where it is a module exporting an object by default', () => {
    const { eslint } = ourPartsIn(projectDir)

    expect(() => mergeEslintConfig([], eslint, { oxlintConfig: MODULE_EXPORTING_AN_OBJECT.file })).not.toThrow()
  })
})

// Each merge reads files of its own project: Node 23 answers a second require() of a module that threw
// with an internal error of its own (measured, Node 23.10; Node 22.23 rethrows the module's error).
describe("a config module that fails as it loads, named as the team's other config", () => {
  const eslintProjectDir = projectListingOxlintIn(tempProjects, filesOf(MODULES_FAILING_AS_THEY_LOAD))
  const oxlintProjectDir = projectListingOxlintIn(tempProjects, filesOf(MODULES_FAILING_AS_THEY_LOAD))

  it.each(MODULES_FAILING_AS_THEY_LOAD)('is refused by mergeEslintConfig where it $what, the error giving its own reason', ({ file, reason }) => {
    const { eslint } = ourPartsIn(eslintProjectDir)

    expect(() => mergeEslintConfig([], eslint, { oxlintConfig: file })).toThrow(
      new Error(`eslint.config.mjs: could not read your oxlint config at ${join(eslintProjectDir, file)}: ${reason}`),
    )
  })

  it.each(MODULES_FAILING_AS_THEY_LOAD)('is refused by mergeOxlintConfig where it $what, the error giving its own reason', ({ file, reason }) => {
    const oxlint = ourOxlintPartIn(oxlintProjectDir)

    expect(() => mergeOxlintConfig(buildTeamOxlintConfig(), oxlint, { eslintConfig: file })).toThrow(
      new Error(`oxlint.config.mts: could not read your ESLint config at ${join(oxlintProjectDir, file)}: ${reason}`),
    )
  })
})

describe('a team ESLint config nesting its blocks in arrays, read by mergeOxlintConfig', () => {
  const projectDir = projectListingOxlintIn(tempProjects, filesOf([ESLINT_CONFIG_NESTING_ENV, ESLINT_CONFIG_NESTING_NO_DEBUGGER_OFF]))

  it("is refused where a block nested three arrays deep holds eslintrc's env, the error naming it", () => {
    const oxlint = ourOxlintPartIn(projectDir, OURS_RUN_BY_OXLINT)

    expect(() => mergeOxlintConfig(buildTeamOxlintConfig(), oxlint, { eslintConfig: ESLINT_CONFIG_NESTING_ENV.file })).toThrow(
      new Error(
        `oxlint.config.mts: could not read your ESLint config at ${join(projectDir, ESLINT_CONFIG_NESTING_ENV.file)}: it is not an ESLint config: no ESLint config holds env`,
      ),
    )
  })

  it('is read where a block nested three arrays deep turns no-debugger off: our part drops no-debugger, and keeps no-empty-pattern', () => {
    const oxlint = ourOxlintPartIn(projectDir, OURS_RUN_BY_OXLINT)
    const merged = mergeOxlintConfig(buildTeamOxlintConfig(), oxlint, { eslintConfig: ESLINT_CONFIG_NESTING_NO_DEBUGGER_OFF.file })

    expect({ noDebugger: severityStatedFor(merged, SOURCE_FILE, NO_DEBUGGER), noEmptyPattern: severityStatedFor(merged, SOURCE_FILE, NO_EMPTY_PATTERN) }).toStrictEqual({
      noDebugger: NOT_STATED,
      noEmptyPattern: 'error',
    })
  })
})

describe('a team JSON oxlint config extending another file by path, read by mergeEslintConfig', () => {
  const projectDir = projectListingOxlintIn(tempProjects, { ...filesOf(OXLINTRC_EXTENDING_A_TSCONFIG_FILES), ...teamOxlintrcExtendingThroughAFolderFiles })

  // The error names the team's file, though the keys listed are the extended file's.
  it('is refused where the file it extends is a tsconfig.json, judged by its keys before what it extends is read', () => {
    const { eslint } = ourPartsIn(projectDir, OURS_RUN_BY_ESLINT)

    expect(() => mergeEslintConfig([], eslint, { oxlintConfig: OXLINTRC_EXTENDING_A_TSCONFIG.file })).toThrow(
      new Error(
        `eslint.config.mjs: could not read your oxlint config at ${join(projectDir, OXLINTRC_EXTENDING_A_TSCONFIG.file)}: it is not an oxlint config: no oxlint config holds ${KEYS_OF_THE_EXTENDED_TSCONFIG_NO_OXLINT_CONFIG_HOLDS}`,
      ),
    )
  })

  it('is read where each file it extends is an oxlint config: our part drops no-var, which one of them sets', async () => {
    const { eslint } = ourPartsIn(projectDir, OURS_RUN_BY_ESLINT)
    const merged = mergeEslintConfig([], eslint, { oxlintConfig: TEAM_OXLINTRC_EXTENDING_THROUGH_A_FOLDER })

    expect(await ruleSeverityInProjectFor(projectDir, merged, SOURCE_FILE, NO_VAR)).toBeUndefined()
  })
})

// oxlint refuses null at every key of a config but $schema, jsPlugins and plugins (measured, 1.87: "invalid type:
// null"), at its root and in each config it extends, so each merge refuses it, naming the file and the key, and below
// the root the file extended by path holding it, or the path to the object extended holding it.
describe('a team JSON oxlint config holding null at a key where oxlint refuses it, read by mergeEslintConfig', () => {
  const projectDir = projectListingOxlintIn(
    tempProjects,
    filesOf([...OXLINTRCS_HOLDING_A_NULL_KEY, ...OXLINTRCS_READ, ...OXLINTRCS_LEFT_TO_OXLINT, ...FILES_THE_TEAMS_OXLINT_CONFIGS_EXTEND]),
  )

  it.each(OXLINTRCS_HOLDING_A_NULL_KEY)('is refused where it holds $what, the error naming the file and $key', (row) => {
    const { eslint } = ourPartsIn(projectDir)

    expect(() => mergeEslintConfig([], eslint, { oxlintConfig: row.file })).toThrow(
      new Error(`eslint.config.mjs: could not read your oxlint config at ${join(projectDir, row.file)}: ${readRefusalProblem(row, projectDir)}`),
    )
  })

  it.each(OXLINTRCS_READ)('is read where it holds $what', ({ file }) => {
    const { eslint } = ourPartsIn(projectDir)

    expect(() => mergeEslintConfig([], eslint, { oxlintConfig: file })).not.toThrow()
  })

  it.each(OXLINTRCS_LEFT_TO_OXLINT)('is read where it holds $what, left for oxlint to refuse', ({ file }) => {
    const { eslint } = ourPartsIn(projectDir)

    expect(() => mergeEslintConfig([], eslint, { oxlintConfig: file })).not.toThrow()
  })
})

describe('a team oxlint config module exporting a plain object by default, holding null at a key where oxlint refuses it, read by mergeEslintConfig', () => {
  const projectDir = projectListingOxlintIn(tempProjects, filesOf([...MODULES_HOLDING_A_NULL_KEY, ...MODULES_READ, ...FILES_THE_TEAMS_OXLINT_CONFIGS_EXTEND]))

  it.each(MODULES_HOLDING_A_NULL_KEY)('is refused where it holds $what, the error naming the module and $key', (row) => {
    const { eslint } = ourPartsIn(projectDir)

    expect(() => mergeEslintConfig([], eslint, { oxlintConfig: row.file })).toThrow(
      new Error(`eslint.config.mjs: could not read your oxlint config at ${join(projectDir, row.file)}: ${readRefusalProblem(row, projectDir)}`),
    )
  })

  it.each(MODULES_READ)('is read where it holds $what', ({ file }) => {
    const { eslint } = ourPartsIn(projectDir)

    expect(() => mergeEslintConfig([], eslint, { oxlintConfig: file })).not.toThrow()
  })
})

describe('a team oxlint config handed to mergeOxlintConfig, holding null at a key where oxlint refuses it', () => {
  const projectDir = projectListingOxlintIn(tempProjects)

  it.each(THEIRS_HOLDING_A_NULL_KEY)('is refused where it holds $what, the error naming oxlint.config.mts and $key', ({ theirs, key, at }) => {
    const oxlint = ourOxlintPartIn(projectDir)

    // @ts-expect-error a config nobody type-checks may hold null where oxlint's type takes an object or nothing
    expect(() => mergeOxlintConfig(theirs, oxlint, NO_TEAM_ESLINT_CONFIG)).toThrow(new Error(`oxlint.config.mts: ${nullKeyProblem(key, at)}`))
  })

  it.each(THEIRS_MERGED)('is merged where it holds $what', ({ theirs }) => {
    const oxlint = ourOxlintPartIn(projectDir)

    // @ts-expect-error as above, these rows are typed unknown
    expect(() => mergeOxlintConfig(theirs, oxlint, NO_TEAM_ESLINT_CONFIG)).not.toThrow()
  })

  it.each(THEIRS_LEFT_TO_OXLINT)('is merged where it holds $what, left for oxlint to refuse', ({ theirs }) => {
    const oxlint = ourOxlintPartIn(projectDir)

    // @ts-expect-error as above, these rows are typed unknown
    expect(() => mergeOxlintConfig(theirs, oxlint, NO_TEAM_ESLINT_CONFIG)).not.toThrow()
  })

  it('is refused for the path where its extends holds a path beside options null, that refusal coming first', () => {
    const oxlint = ourOxlintPartIn(projectDir)

    // @ts-expect-error as above, the config is typed unknown
    expect(() => mergeOxlintConfig(THEIRS_HOLDING_A_PATH_BESIDE_OPTIONS_NULL.theirs, oxlint, NO_TEAM_ESLINT_CONFIG)).toThrow(
      new Error('oxlint.config.mts: extends[0] is a path, which oxlint refuses in a JS or TS config: import that file and put the object in extends'),
    )
  })
})

// Below a key, wherever oxlint refuses null whatever the rule or plugin (measured, 1.87): in an override, at a rule's
// or a category's severity, at an env, global or plugin's settings entry, and in a slot of a list. The refusal names the
// path to the null; the cases pin the start of the line, what to do instead following it.
describe('a team JSON oxlint config holding null below a key where oxlint refuses it, read by mergeEslintConfig', () => {
  const project = setUpRunsBeforeTheSuite(
    (temporaryProjects) => projectListingOxlintIn(temporaryProjects, filesOf([...OXLINTRCS_HOLDING_A_NULL_BELOW_A_KEY, ...FILES_THE_TEAMS_OXLINT_CONFIGS_EXTEND])),
    PROJECT_WRITTEN,
  )

  it.each(OXLINTRCS_HOLDING_A_NULL_BELOW_A_KEY)('is refused where it holds $what, the error naming the file and the path to the null', (row) => {
    const projectDir = project()
    const { eslint } = ourPartsIn(projectDir)

    expect(() => mergeEslintConfig([], eslint, { oxlintConfig: row.file })).toThrow(
      `eslint.config.mjs: could not read your oxlint config at ${join(projectDir, row.file)}: ${readRefusalOfANullBelowAKeyStart(row, projectDir)}`,
    )
  })
})

describe('a team oxlint config module exporting a plain object by default, holding null below a key where oxlint refuses it, read by mergeEslintConfig', () => {
  const project = setUpRunsBeforeTheSuite((temporaryProjects) => projectListingOxlintIn(temporaryProjects, filesOf(MODULES_HOLDING_A_NULL_BELOW_A_KEY)), PROJECT_WRITTEN)

  it.each(MODULES_HOLDING_A_NULL_BELOW_A_KEY)('is refused where it holds $what, the error naming the module and the path to the null', (row) => {
    const projectDir = project()
    const { eslint } = ourPartsIn(projectDir)

    expect(() => mergeEslintConfig([], eslint, { oxlintConfig: row.file })).toThrow(
      `eslint.config.mjs: could not read your oxlint config at ${join(projectDir, row.file)}: ${readRefusalOfANullBelowAKeyStart(row, projectDir)}`,
    )
  })
})

describe('a team oxlint config handed to mergeOxlintConfig, holding null below a key where oxlint refuses it', () => {
  const project = setUpRunsBeforeTheSuite((temporaryProjects) => projectListingOxlintIn(temporaryProjects), PROJECT_WRITTEN)

  it.each(THEIRS_HOLDING_A_NULL_BELOW_A_KEY)('is refused where it holds $what, the error naming oxlint.config.mts and the path to the null', ({ theirs, location, at }) => {
    const oxlint = ourOxlintPartIn(project())

    // @ts-expect-error a config nobody type-checks may hold null where oxlint's type takes a value
    expect(() => mergeOxlintConfig(theirs, oxlint, NO_TEAM_ESLINT_CONFIG)).toThrow(`oxlint.config.mts: ${nullBelowAKeyRefusalStart(location, at)}`)
  })

  it.each(THEIRS_HOLDING_A_NULL_AT_A_KEY_OXLINT_REQUIRES)('is refused where it holds $what, telling the team what to write there rather than to leave it out', ({ theirs, location }) => {
    const oxlint = ourOxlintPartIn(project())
    function merging(): void {
      // @ts-expect-error a config nobody type-checks may hold null where oxlint's type takes a value
      mergeOxlintConfig(theirs, oxlint, NO_TEAM_ESLINT_CONFIG)
    }

    expect(merging).toThrow(`oxlint.config.mts: ${nullBelowAKeyRefusalStart(location)}`)
    expect(merging).not.toThrow(ADVICE_TO_LEAVE_IT_OUT)
  })
})

// plugins null runs oxlint's default plugins, as plugins left out does (measured, 1.87), so each merge reads it so: at a
// root, in a config extended and in an override. Which plugins run decides whether the team's correctness on runs
// no-this-alias, which our ESLint part runs too; each row sits beside its twin leaving plugins out, and those listing
// other plugins show the rule turns on them.
describe('a team oxlint config writing correctness on, read by mergeEslintConfig beside our no-this-alias, by the plugins it runs', () => {
  const projectDir = projectListingOxlintIn(
    tempProjects,
    filesOf([...OXLINTRCS_RUNNING_NO_THIS_ALIAS, ...OXLINTRCS_LEAVING_NO_THIS_ALIAS_OUT, ...MODULES_RUNNING_NO_THIS_ALIAS, ...MODULES_LEAVING_NO_THIS_ALIAS_OUT, ...FILES_THE_TEAMS_OXLINT_CONFIGS_EXTEND]),
  )

  async function oursBeside(oxlintConfig: string): Promise<string | undefined> {
    const { eslint } = ourPartsIn(projectDir, OURS_NO_THIS_ALIAS)
    return ruleSeverityInProjectFor(projectDir, mergeEslintConfig([], eslint, { oxlintConfig }), SOURCE_FILE, NO_THIS_ALIAS)
  }

  it.each(OXLINTRCS_RUNNING_NO_THIS_ALIAS)('drops ours where the JSON config holds $what, under which oxlint runs it', async ({ file }) => {
    expect(await oursBeside(file)).toBeUndefined()
  })

  it.each(OXLINTRCS_LEAVING_NO_THIS_ALIAS_OUT)('keeps ours where the JSON config holds $what, under which oxlint does not run it', async ({ file }) => {
    expect(await oursBeside(file)).toBe('error')
  })

  it.each(MODULES_RUNNING_NO_THIS_ALIAS)('drops ours where the module holds $what, under which oxlint runs it', async ({ file }) => {
    expect(await oursBeside(file)).toBeUndefined()
  })

  it.each(MODULES_LEAVING_NO_THIS_ALIAS_OUT)('keeps ours where the module holds $what, under which oxlint does not run it', async ({ file }) => {
    expect(await oursBeside(file)).toBe('error')
  })
})

// Our no-explicit-any lists typescript at the merged root, so where the team's config alone runs no typescript, the
// merge turns its no-this-alias off; where it does, the rule is the team's.
describe('a team oxlint config writing correctness on, handed to mergeOxlintConfig beside our no-explicit-any, by the plugins it runs', () => {
  const projectDir = projectListingOxlintIn(tempProjects)

  it.each(THEIRS_RUNNING_NO_THIS_ALIAS)("states nothing of no-this-alias, the team's, where the config holds $what, under which oxlint runs it", ({ theirs }) => {
    const oxlint = ourOxlintPartIn(projectDir, OURS_NO_EXPLICIT_ANY_AND_DEBUGGER)

    // @ts-expect-error a config nobody type-checks may hold null where oxlint's type takes a list or nothing
    expect(severityStatedFor(mergeOxlintConfig(theirs, oxlint, NO_TEAM_ESLINT_CONFIG), SOURCE_FILE, NO_THIS_ALIAS)).toBe(NOT_STATED)
  })

  it.each(THEIRS_LEAVING_NO_THIS_ALIAS_OUT)('turns no-this-alias off where the config holds $what, under which oxlint does not run it', ({ theirs }) => {
    const oxlint = ourOxlintPartIn(projectDir, OURS_NO_EXPLICIT_ANY_AND_DEBUGGER)

    // @ts-expect-error as above, these rows are typed unknown
    expect(severityStatedFor(mergeOxlintConfig(theirs, oxlint, NO_TEAM_ESLINT_CONFIG), SOURCE_FILE, NO_THIS_ALIAS)).toBe('off')
  })
})
