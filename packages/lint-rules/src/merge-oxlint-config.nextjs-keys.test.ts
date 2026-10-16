import type { OxlintConfig } from 'oxlint'
import { describe, expect, it } from 'vitest'
import { oxlintPartOf } from './__tests__/agent-configs.ts'
import { buildConsumerLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { buildTeamOxlintConfig } from './__tests__/factories/team-config-factories.ts'
import { oxlintEntryOfRuleFor } from './__tests__/oxlint-config-oracle.ts'
import { NO_TEAM_ESLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { INSTALLED_OXLINT, setUpTempProjects } from './__tests__/temp-projects.ts'
import { defineLintRules } from './index.ts'
import { mergeOxlintConfig } from './oxlint.ts'

// In a rule key, oxlint reads `@next`, `@next/next` and the package name `@next/eslint-plugin-next`
// as nextjs (oxlint-config-reading.ts, builtinPluginOfRulePrefix; unalias_plugin_name, rules.rs;
// measured, oxlint 1.87 in merge-oxlint-config.differential.integration.test.ts). A team override
// stating nextjs rules under those keys, where nextjs is listed for no file it applies to, is ignored
// by oxlint for the team, so the merge, which lists every plugin at its root, drops the statements;
// where the team's root lists nextjs, they count, and stay.

const tempProjects = setUpTempProjects()

const APP_FILE = 'app/k.jsx'
const NEXTJS_KEYS = ['@next/no-img-element', '@next/next/no-html-link-for-pages', '@next/eslint-plugin-next/no-sync-scripts']
const NOT_STATED = 'not stated'

const projectDir = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()) }, linkedPackages: [INSTALLED_OXLINT] })
const ourParts = defineLintRules(buildConsumerLintRules(projectDir, {})).editorRulesets

/** The team config, its root listing the plugins given, nextjs listed for vendor/**, and an override for app/** stating each nextjs key on. */
function teamStatingNextjsKeysInApp(rootPlugins: NonNullable<OxlintConfig['plugins']>): OxlintConfig {
  return buildTeamOxlintConfig({
    plugins: rootPlugins,
    overrides: [
      { files: ['vendor/**'], plugins: ['nextjs'] },
      { files: ['app/**'], rules: Object.fromEntries(NEXTJS_KEYS.map((key) => [key, 'error'])) },
    ],
  })
}

/** Each key's entry in the app file, under the key itself, in the config merged into the team config given. */
function entriesInTheAppFile(team: OxlintConfig): Readonly<Record<string, unknown>> {
  const merged = mergeOxlintConfig(team, oxlintPartOf(ourParts), NO_TEAM_ESLINT_CONFIG)
  return Object.fromEntries(NEXTJS_KEYS.map((key) => [key, oxlintEntryOfRuleFor(merged, APP_FILE, [key]) ?? NOT_STATED]))
}

describe('mergeOxlintConfig, given a team override for app/** stating nextjs rules under each other name oxlint takes for nextjs in a key', () => {
  it('drops each statement where nextjs is listed for vendor/** alone, as oxlint ignores them for the team', () => {
    expect(entriesInTheAppFile(teamStatingNextjsKeysInApp(['oxc']))).toStrictEqual(Object.fromEntries(NEXTJS_KEYS.map((key) => [key, NOT_STATED])))
  })

  it("keeps each statement where the team's root lists nextjs, as they count for the team", () => {
    expect(entriesInTheAppFile(teamStatingNextjsKeysInApp(['oxc', 'nextjs']))).toStrictEqual(Object.fromEntries(NEXTJS_KEYS.map((key) => [key, 'error'])))
  })
})
