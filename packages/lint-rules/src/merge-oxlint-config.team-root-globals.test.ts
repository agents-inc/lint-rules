import type { OxlintConfig } from 'oxlint'
import { describe, expect, it } from 'vitest'
import { buildConsumerLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { buildTeamOxlintConfig } from './__tests__/factories/team-config-factories.ts'
import { NO_TEAM_ESLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { INSTALLED_OXLINT, setUpTempProjects } from './__tests__/temp-projects.ts'
import { defineLintRules } from './index.ts'
import { mergeOxlintConfig } from './oxlint.ts'

// Q-E for globals, as merge-oxlint-config.test.ts pins it for env: a global the team's root sets
// stands in every file, so no override of ours sets it. Our oxlint part sets Svelte's legacy
// component globals read-only in Svelte components (framework-globals.ts), whatever rulesets are
// listed; the team's root here makes one of them writable.

const tempProjects = setUpTempProjects()

const SVELTE_GLOBAL = '$$props'
const TEAM_SETTING = 'writable'

const projectDir = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()) }, linkedPackages: [INSTALLED_OXLINT] })
const { oxlint } = defineLintRules(buildConsumerLintRules(projectDir, {})).editorRulesets

/** The merged config with ours merged into the team's config given. */
function mergedInto(team: OxlintConfig): OxlintConfig {
  if (oxlint === undefined) throw new Error('the project lists oxlint, so it has an oxlint part')
  return mergeOxlintConfig(team, oxlint, NO_TEAM_ESLINT_CONFIG)
}

/** The global's setting among those given, as a list: none where they leave it out. */
function settingIn(globals: NonNullable<OxlintConfig['globals']>): unknown[] {
  const setting = globals[SVELTE_GLOBAL]
  return setting === undefined ? [] : [setting]
}

/** How the merged config sets the global: at its root, and in each override that sets it, in order. */
function settingsOfTheGlobal({ globals = {}, overrides }: OxlintConfig): { readonly root: unknown; readonly overrides: readonly unknown[] } {
  if (overrides === undefined) throw new Error('the merged config always holds overrides')
  return { root: globals[SVELTE_GLOBAL], overrides: overrides.flatMap(({ globals: overrideGlobals = {} }) => settingIn(overrideGlobals)) }
}

describe("mergeOxlintConfig, given a team config whose root does or does not set one of Svelte's component globals", () => {
  it("leaves the global to the team's root, which sets it writable, stating it in no override of ours", () => {
    expect(settingsOfTheGlobal(mergedInto(buildTeamOxlintConfig({ globals: { [SVELTE_GLOBAL]: TEAM_SETTING } })))).toStrictEqual({ root: TEAM_SETTING, overrides: [] })
  })

  it("sets it read-only in our override for Svelte components where the team's root sets no global", () => {
    expect(settingsOfTheGlobal(mergedInto(buildTeamOxlintConfig()))).toStrictEqual({ root: undefined, overrides: ['readonly'] })
  })
})
