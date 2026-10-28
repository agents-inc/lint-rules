import type { OxlintConfig } from 'oxlint'
import { describe, expect, it } from 'vitest'
import { buildConsumerLintRules } from '../__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOxlint, packageJsonText } from '../__tests__/factories/package-json-factories.ts'
import { buildTeamOxlintConfig } from '../__tests__/factories/team-config-factories.ts'
import { oxlintConfigForFile } from '../__tests__/oxlint-config-oracle.ts'
import { NO_TEAM_ESLINT_CONFIG } from '../__tests__/team-configs-of-the-other-engine.ts'
import { INSTALLED_OXLINT, setUpTempProjects } from '../__tests__/temp-projects.ts'
import { defineLintRules } from '../index.ts'
import { mergeOxlintConfig } from '../oxlint.ts'

// An env key the team's root sets stands in every file, so no override of ours restates it. Our runtime's env goes
// where our own no-undef runs: the correctness ruleset ships it for JS files, so the file read is a JS file.

const tempProjects = setUpTempProjects()

const JS_FILE = 'src/a.js'

/** The env oxlint applies to a JS file, our browser runtime's part merged into the team's config given. */
function envOfAJsFileMergedInto(projectDir: string, team: Readonly<OxlintConfig>): Readonly<Record<string, unknown>> {
  const { oxlint } = defineLintRules(buildConsumerLintRules(projectDir, { editorRulesets: { quality: ['correctness'], runtimes: ['browser'] } })).editorRulesets
  return oxlintConfigForFile(mergeOxlintConfig(team, oxlint, NO_TEAM_ESLINT_CONFIG), JS_FILE).env
}

describe("mergeOxlintConfig, given a team config whose root does or does not set our runtime's env key", () => {
  it("leaves the key to the team's root where it sets it, and sets it where the root sets only other keys or none", () => {
    const projectDir = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()) }, linkedPackages: [INSTALLED_OXLINT] })

    expect({
      rootTurnsItOff: envOfAJsFileMergedInto(projectDir, buildTeamOxlintConfig({ env: { browser: false } }))['browser'],
      rootSetsAnother: envOfAJsFileMergedInto(projectDir, buildTeamOxlintConfig({ env: { node: true } }))['browser'],
      rootSetsNone: envOfAJsFileMergedInto(projectDir, buildTeamOxlintConfig())['browser'],
    }).toStrictEqual({ rootTurnsItOff: false, rootSetsAnother: true, rootSetsNone: true })
  })
})
