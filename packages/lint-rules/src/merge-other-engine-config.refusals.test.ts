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
  OURS_RUN_BY_ESLINT,
  OURS_RUN_BY_OXLINT,
  TEAM_OXLINTRC_EXTENDING_THROUGH_A_FOLDER,
  teamOxlintrcExtendingThroughAFolderFiles,
} from './__tests__/cases/other-engine-configs.ts'
import { setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import { buildTeamOxlintConfig } from './__tests__/factories/team-config-factories.ts'
import { NOT_STATED, ourOxlintPartIn, ourPartsIn, projectListingOxlintIn, severityStatedFor } from './__tests__/other-engine-merges.ts'
import { NO_TEAM_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'
import { mergeEslintConfig } from './eslint.ts'
import { mergeOxlintConfig } from './oxlint.ts'

// The error names the config file calling the merge and describes what it was given, each kind in its
// own words; a module failing as it loads gives its own reason. An ESLint config is judged by every
// block at any depth, and a JSON oxlint config by every config it extends by path.

const tempProjects = setUpTempProjects()
const { ruleSeverityInProjectFor } = setUpEslintConfigOracle()

const SOURCE_FILE = 'src/a.tsx'

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
