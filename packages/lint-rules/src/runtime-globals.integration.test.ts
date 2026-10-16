import { ESLint, type Linter } from 'eslint'
import type { OxlintConfig } from 'oxlint'
import { describe, expect, it } from 'vitest'
import { describeFinding, eslintFindingsIn, oxlintFindingsIn, runOxlintCli, writeOxlintConfigFile } from './__tests__/engine-clis.ts'
import { setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import { buildConsumerLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOthers, buildPackageJsonListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { buildTeamEslintBlock, buildTeamOxlintConfig } from './__tests__/factories/team-config-factories.ts'
import { isRecord } from './core/is-record.ts'
import { oxlintConfigForFile } from './__tests__/oxlint-config-oracle.ts'
import { EMPTY_TEAM_OXLINT_CONFIG, NO_TEAM_ESLINT_CONFIG, writeTeamOxlintConfigSettingNoRule } from './__tests__/team-configs-of-the-other-engine.ts'
import { INSTALLED_OXLINT, setUpTempProjects } from './__tests__/temp-projects.ts'
import { mergeEslintConfig } from './eslint.ts'
import { defineLintRules, type LintRules } from './index.ts'
import { mergeOxlintConfig } from './oxlint.ts'

// #68 (spec-core.md C7, read-q68): in the editor merges our runtimes' globals are ours only in the
// files where our own no-undef runs, in that part's engine, so they no longer silence a team's
// no-undef. Beside oxlint, oxlint runs our no-undef, so the ESLint merge gives none; without it,
// ESLint does, in the JS files it reaches. Where the team sets no-undef it is the team's, so ours
// runs nowhere and gives none. The editor set lists the browser runtime alone, so a Node file's
// `process` is reported where our no-undef runs, and `window` only where none of ours declares it.

const NODE_FILE = 'src/node.js'
const ENTRY_FILE = 'lib/node.js'
const TS_FILE = 'src/a.ts'
// window (1), which the browser runtime declares; process (2), which it does not.
const NODE_SOURCE = 'export const width = window.innerWidth\nexport const cwd = process.cwd()\n'
const SOURCES = { [NODE_FILE]: NODE_SOURCE, [ENTRY_FILE]: NODE_SOURCE, [TS_FILE]: 'export const width: number = window.innerWidth\n' }
const NO_UNDEF_IN_OXLINT = 'eslint(no-undef)'
const NO_UNDEF_IN_ESLINT = 'no-undef'
const BROWSER_ENV = 'browser'
const WINDOW = 'window'
const OXLINT_CONFIG_FILE = 'merged.oxlint.config.mts'
// The ruleset shipping no-undef, beside the browser runtime alone.
const BROWSER_SET: Parameters<typeof buildConsumerLintRules>[1] = {
  agentRulesets: { quality: ['correctness'], runtimes: ['browser'] },
  editorRulesets: { quality: ['correctness'], runtimes: ['browser'] },
}
const NO_UNDEF_OFF_IN_LIB: Pick<LintRules, 'fileOverrides'> = { fileOverrides: [{ files: ['lib/**'], rules: { 'no-undef': 'off' } }] }
const TEAM_ESLINT_CONFIG_SETTING_NO_UNDEF: Linter.Config[] = [buildTeamEslintBlock('team/no-undef', { files: ['**/*.js'], rules: { 'no-undef': 'error' } })]
const TEAM_OXLINT_CONFIG_SETTING_NO_UNDEF = buildTeamOxlintConfig({ categories: { correctness: 'off' }, rules: { 'no-undef': 'error' } })

const tempProjects = setUpTempProjects()
const { calculatedConfigInProjectFor } = setUpEslintConfigOracle()
const PROJECT_WITH_OXLINT = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()), ...SOURCES }, linkedPackages: [INSTALLED_OXLINT] })
const PROJECT_WITHOUT_OXLINT = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOthers()), ...SOURCES } })

function definedIn(projectDir: string, fields: Partial<Pick<LintRules, 'fileOverrides'>> = {}): ReturnType<typeof defineLintRules> {
  return defineLintRules(buildConsumerLintRules(projectDir, BROWSER_SET, fields))
}

function mergedOxlintConfig(teamConfig: OxlintConfig, fields: Partial<Pick<LintRules, 'fileOverrides'>> = {}): OxlintConfig {
  const { oxlint } = definedIn(PROJECT_WITH_OXLINT, fields).editorRulesets
  return mergeOxlintConfig(teamConfig, oxlint, NO_TEAM_ESLINT_CONFIG)
}

function mergedEslintConfig(projectDir: string, teamConfig: Linter.Config[], fields: Partial<Pick<LintRules, 'fileOverrides'>> = {}): Linter.Config[] {
  const { eslint } = definedIn(projectDir, fields).editorRulesets
  return mergeEslintConfig(teamConfig, eslint, writeTeamOxlintConfigSettingNoRule(eslint))
}

/** Each no-undef finding the real oxlint CLI reports in the Node file, with the merged config. */
function oxlintNoUndefInTheNodeFile(merged: OxlintConfig): string[] {
  writeOxlintConfigFile(PROJECT_WITH_OXLINT, OXLINT_CONFIG_FILE, merged)
  return oxlintFindingsIn(runOxlintCli(PROJECT_WITH_OXLINT, OXLINT_CONFIG_FILE, [NODE_FILE]).report)
    .filter(({ rule }) => rule === NO_UNDEF_IN_OXLINT)
    .map(describeFinding)
}

/** Each no-undef finding ESLint reports in the Node file, with the merged config. */
async function eslintNoUndefInTheNodeFile(projectDir: string, merged: Linter.Config[]): Promise<string[]> {
  const results = await new ESLint({ cwd: projectDir, overrideConfigFile: true, overrideConfig: merged }).lintFiles([NODE_FILE])
  return eslintFindingsIn(results, projectDir)
    .filter(({ rule }) => rule === NO_UNDEF_IN_ESLINT)
    .map(describeFinding)
}

/** The browser's `window` as ESLint's calculated config for the file declares it: undefined where no block does. */
async function eslintWindowGlobalIn(projectDir: string, merged: Linter.Config[], file: string): Promise<unknown> {
  const calculated = await calculatedConfigInProjectFor(projectDir, merged, file)
  if (calculated === undefined) throw new Error(`ESLint does not lint ${file}`)
  const { languageOptions } = calculated
  if (languageOptions === undefined) throw new Error(`ESLint calculated no language options for ${file}`)
  const globals: unknown = languageOptions['globals']
  if (!isRecord(globals)) return undefined
  return globals[WINDOW]
}

function windowAndProcessIn(file: string, ruleName: string): string[] {
  return [`${file}:1 ${ruleName}`, `${file}:2 ${ruleName}`]
}

describe('the oxlint merge, in a project whose package.json lists oxlint', () => {
  it("gives our no-undef our runtime's globals where the team does not set it: process reported in a Node file, window not", () => {
    expect(oxlintNoUndefInTheNodeFile(mergedOxlintConfig(EMPTY_TEAM_OXLINT_CONFIG))).toStrictEqual([`${NODE_FILE}:2 ${NO_UNDEF_IN_OXLINT}`])
  })

  it("gives no runtime global of ours where the team's oxlint config sets no-undef: the team's reports window in a Node file", () => {
    expect(oxlintNoUndefInTheNodeFile(mergedOxlintConfig(TEAM_OXLINT_CONFIG_SETTING_NO_UNDEF))).toStrictEqual(windowAndProcessIn(NODE_FILE, NO_UNDEF_IN_OXLINT))
  })

  it("states our runtime's env only in the files our no-undef runs in: the JS file, not the TS file it ignores, nor an entry's files turning it off", () => {
    const merged = mergedOxlintConfig(EMPTY_TEAM_OXLINT_CONFIG, NO_UNDEF_OFF_IN_LIB)

    expect({
      jsFile: oxlintConfigForFile(merged, NODE_FILE).env[BROWSER_ENV],
      tsFile: oxlintConfigForFile(merged, TS_FILE).env[BROWSER_ENV],
      entrysFile: oxlintConfigForFile(merged, ENTRY_FILE).env[BROWSER_ENV],
    }).toStrictEqual({ jsFile: true, tsFile: undefined, entrysFile: undefined })
  })
})

describe('the ESLint merge, in a project whose package.json lists oxlint, which runs our no-undef', () => {
  it("gives no runtime global of ours in any file, the team setting no-undef or not", async () => {
    expect({
      teamSettingNone: await eslintWindowGlobalIn(PROJECT_WITH_OXLINT, mergedEslintConfig(PROJECT_WITH_OXLINT, []), NODE_FILE),
      teamSettingNoUndef: await eslintWindowGlobalIn(PROJECT_WITH_OXLINT, mergedEslintConfig(PROJECT_WITH_OXLINT, TEAM_ESLINT_CONFIG_SETTING_NO_UNDEF), NODE_FILE),
    }).toStrictEqual({ teamSettingNone: undefined, teamSettingNoUndef: undefined })
  })

  it("leaves window to the team's no-undef where its ESLint config sets it: reported in a Node file", async () => {
    expect(await eslintNoUndefInTheNodeFile(PROJECT_WITH_OXLINT, mergedEslintConfig(PROJECT_WITH_OXLINT, TEAM_ESLINT_CONFIG_SETTING_NO_UNDEF))).toStrictEqual(
      windowAndProcessIn(NODE_FILE, NO_UNDEF_IN_ESLINT),
    )
  })
})

describe('the ESLint merge, in a project whose package.json lists no oxlint, where ESLint runs our no-undef', () => {
  it("gives our no-undef our runtime's globals where the team does not set it: process reported in a Node file, window not", async () => {
    expect(await eslintNoUndefInTheNodeFile(PROJECT_WITHOUT_OXLINT, mergedEslintConfig(PROJECT_WITHOUT_OXLINT, []))).toStrictEqual([`${NODE_FILE}:2 ${NO_UNDEF_IN_ESLINT}`])
  })

  it("gives no runtime global of ours where the team's ESLint config sets no-undef: the team's reports window in a Node file", async () => {
    expect(await eslintNoUndefInTheNodeFile(PROJECT_WITHOUT_OXLINT, mergedEslintConfig(PROJECT_WITHOUT_OXLINT, TEAM_ESLINT_CONFIG_SETTING_NO_UNDEF))).toStrictEqual(
      windowAndProcessIn(NODE_FILE, NO_UNDEF_IN_ESLINT),
    )
  })

  it("declares our runtime's globals only in the files our no-undef reaches: the JS file, not the TS file it ignores, nor an entry's files turning it off", async () => {
    const merged = mergedEslintConfig(PROJECT_WITHOUT_OXLINT, [], NO_UNDEF_OFF_IN_LIB)

    expect({
      jsFile: await eslintWindowGlobalIn(PROJECT_WITHOUT_OXLINT, merged, NODE_FILE),
      tsFile: await eslintWindowGlobalIn(PROJECT_WITHOUT_OXLINT, merged, TS_FILE),
      entrysFile: await eslintWindowGlobalIn(PROJECT_WITHOUT_OXLINT, merged, ENTRY_FILE),
    }).toStrictEqual({ jsFile: false, tsFile: undefined, entrysFile: undefined })
  })
})
