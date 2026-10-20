import type { OxlintConfig } from 'oxlint'
import { describe, expect, it } from 'vitest'
import { oxlintPartOf } from './__tests__/agent-configs.ts'
import { ARRAY_TYPE, NO_DEBUGGER, NO_EMPTY_PATTERN, NO_VAR, OURS_RUN_BY_ESLINT, OURS_RUN_BY_OXLINT } from './__tests__/cases/other-engine-configs.ts'
import { THE_PARTS_NAME, THIRD_ARGUMENTS_HOLDING_NO_PATH } from './__tests__/cases/untyped-oxlint-config-arguments.ts'
import { buildTeamOxlintConfig } from './__tests__/factories/team-config-factories.ts'
import { NOT_STATED, ourPartsIn, projectListingOxlintIn, severityStatedFor } from './__tests__/other-engine-merges.ts'
import { NO_TEAM_ESLINT_CONFIG, TEAM_ESLINT_CONFIG_SETTING_NO_RULE, teamEslintConfigSettingNoRuleFiles } from './__tests__/team-configs-of-the-other-engine.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'
import { mergeOxlintConfig } from './oxlint.ts'

// What an untyped oxlint.config.mts does: one whose type errors nobody reads. The types refuse every value below as
// mergeOxlintConfig's second or third argument, and no check of ours refuses it at run time (owner, 2026-10-20), so
// each is measured beside the call the types take, by what it builds or the error it stops at.

type OurRulesStated = Readonly<Record<string, string>>

const tempProjects = setUpTempProjects()
const projectDir = projectListingOxlintIn(tempProjects, teamEslintConfigSettingNoRuleFiles)
// Two rules oxlint runs for us, and two ESLint does, whose copies oxlint's default correctness category would run.
const editorRulesets = ourPartsIn(projectDir, { ...OURS_RUN_BY_OXLINT, ...OURS_RUN_BY_ESLINT })
const { eslint } = editorRulesets
const oxlint = oxlintPartOf(editorRulesets)
// Leaves correctness at oxlint's default.
const theirs = buildTeamOxlintConfig()
const SOURCE_FILE = 'src/a.ts'
const OUR_RULES = [NO_DEBUGGER, NO_EMPTY_PATTERN, NO_VAR, ARRAY_TYPE]
// Our message where the installed oxlint is looked up from a tsconfigRootDir the value given has none of.
const INSTALLED_OXLINT_LOOKED_UP_FROM_NO_FOLDER = 'oxlint.config.mts: a package.json lists oxlint, yet it does not resolve from undefined: install it'
// Node's error for an argument of the wrong type, such as a path that is no string.
const NODE_REFUSING_A_PATH_THAT_IS_NO_STRING = { name: 'TypeError', code: 'ERR_INVALID_ARG_TYPE' }

/** How the merged config sets each of our rules in a TS source file. */
function ourRulesStatedIn(merged: Readonly<OxlintConfig>): OurRulesStated {
  return Object.fromEntries(OUR_RULES.map((ruleId) => [ruleId, severityStatedFor(merged, SOURCE_FILE, ruleId)]))
}

describe('the ESLint part handed to mergeOxlintConfig, in an untyped oxlint.config.mts', () => {
  it('builds, with no error, a config stating none of our rules: oxlint runs none of the rules our oxlint part runs, and its copies of the ESLint-run ones stay on', () => {
    // @ts-expect-error mergeOxlintConfig takes the oxlint part, not the ESLint part
    const merged = mergeOxlintConfig(theirs, eslint, NO_TEAM_ESLINT_CONFIG)

    expect(ourRulesStatedIn(merged)).toStrictEqual({ [NO_DEBUGGER]: NOT_STATED, [NO_EMPTY_PATTERN]: NOT_STATED, [NO_VAR]: NOT_STATED, [ARRAY_TYPE]: NOT_STATED })
  })

  it('is not what the oxlint part builds, which turns on the rules oxlint runs for us and turns off its copies of the ESLint-run ones', () => {
    const merged = mergeOxlintConfig(theirs, oxlint, NO_TEAM_ESLINT_CONFIG)

    expect(ourRulesStatedIn(merged)).toStrictEqual({ [NO_DEBUGGER]: 'error', [NO_EMPTY_PATTERN]: 'error', [NO_VAR]: 'off', [ARRAY_TYPE]: 'off' })
  })
})

// The merge reads the part's tsconfigRootDir first, to check the installed oxlint, and our message for an oxlint that
// does not resolve says to install it.
describe('a value that is neither part, handed to mergeOxlintConfig in an untyped oxlint.config.mts', () => {
  it('stops, where it is the object holding both parts, at the check of the installed oxlint, naming undefined as the folder', () => {
    // @ts-expect-error mergeOxlintConfig takes the oxlint part, not the object holding both parts
    expect(() => mergeOxlintConfig(theirs, editorRulesets, NO_TEAM_ESLINT_CONFIG)).toThrow(new Error(INSTALLED_OXLINT_LOOKED_UP_FROM_NO_FOLDER))
  })

  it("stops, where it is the part's name, at the check of the installed oxlint, naming undefined as the folder", () => {
    // @ts-expect-error mergeOxlintConfig takes the oxlint part, not a string
    expect(() => mergeOxlintConfig(theirs, THE_PARTS_NAME, NO_TEAM_ESLINT_CONFIG)).toThrow(new Error(INSTALLED_OXLINT_LOOKED_UP_FROM_NO_FOLDER))
  })

  // The text is V8's.
  it('stops, where it is null, at a TypeError', () => {
    // @ts-expect-error mergeOxlintConfig takes the oxlint part, not null
    expect(() => mergeOxlintConfig(theirs, null, NO_TEAM_ESLINT_CONFIG)).toThrow(TypeError)
  })
})

describe("mergeOxlintConfig's third argument, in an untyped oxlint.config.mts", () => {
  // The text is V8's.
  it('stops, where it is left out, at a TypeError', () => {
    // @ts-expect-error the path of the team's ESLint config is required
    expect(() => mergeOxlintConfig(theirs, oxlint)).toThrow(TypeError)
  })

  it('stops, where it is null, at a TypeError', () => {
    // @ts-expect-error the third argument is an object holding the path, not null
    expect(() => mergeOxlintConfig(theirs, oxlint, null)).toThrow(TypeError)
  })

  it.each(THIRD_ARGUMENTS_HOLDING_NO_PATH)('stops, where it is $what, at the TypeError Node throws for a path that is no string', ({ given }) => {
    // @ts-expect-error eslintConfig is a path or null
    expect(() => mergeOxlintConfig(theirs, oxlint, given)).toThrow(expect.objectContaining(NODE_REFUSING_A_PATH_THAT_IS_NO_STRING))
  })

  it("merges where eslintConfig names the team's ESLint config, which sets none of our rules", () => {
    expect(ourRulesStatedIn(mergeOxlintConfig(theirs, oxlint, TEAM_ESLINT_CONFIG_SETTING_NO_RULE))).toStrictEqual({
      [NO_DEBUGGER]: 'error',
      [NO_EMPTY_PATTERN]: 'error',
      [NO_VAR]: 'off',
      [ARRAY_TYPE]: 'off',
    })
  })
})
