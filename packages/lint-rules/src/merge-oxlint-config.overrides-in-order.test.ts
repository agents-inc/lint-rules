import type { OxlintConfig } from 'oxlint'
import { describe, expect, it } from 'vitest'
import { oxlintPartOf } from './__tests__/agent-configs.ts'
import { FILE_EXCLUDED_BY_TWO_LISTINGS } from './__tests__/cases/oxlint-merge-shapes.ts'
import { buildConsumerLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { buildTeamOxlintConfig, buildTeamOxlintConfigFrom } from './__tests__/factories/team-config-factories.ts'
import { oxlintSeverityFor } from './__tests__/oxlint-config-oracle.ts'
import { NO_TEAM_ESLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { INSTALLED_OXLINT, setUpTempProjects } from './__tests__/temp-projects.ts'
import { defineLintRules, type LintRules } from './index.ts'
import { mergeOxlintConfig } from './oxlint.ts'

// Overrides in order, as oxlint applies them, a later one over an earlier (merge-oxlint-config.ts):
// an entry of ours turning a rule on after one turning it off runs it in its files; and where the
// team's overrides list plugins, the categories oxlint switches on for the team in a file stay on
// there. The second case is the file of merge-oxlint-config.differential.integration.test.ts's G3
// shape (questions.md #48) the gap does not reach: src/f.test.tsx, where both [react] and a [promise]
// listing apply, so oxlint switches react's categories on for the team (correctness warns).

const tempProjects = setUpTempProjects()

const NO_DEBUGGER = 'no-debugger'
const JSX_KEY = 'react/jsx-key'
const NOT_RUN = 'not run'

const projectDir = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()) }, linkedPackages: [INSTALLED_OXLINT] })

/** Our oxlint part of the settings given, merged into the team config given. */
function mergedWith(fields: Partial<Omit<LintRules, 'tsconfigRootDir'>>, team: OxlintConfig): OxlintConfig {
  return mergeOxlintConfig(team, oxlintPartOf(defineLintRules(buildConsumerLintRules(projectDir, {}, fields)).editorRulesets), NO_TEAM_ESLINT_CONFIG)
}

/** The severity oxlint runs the rule at in each file given: NOT_RUN where it is off or no statement applies. */
function severitiesIn(merged: OxlintConfig, oxlintName: string, files: readonly string[]): Readonly<Record<string, string>> {
  return Object.fromEntries(
    files.map((file) => {
      const severity = oxlintSeverityFor(merged, file, oxlintName)
      return [file, severity === undefined || severity === 'off' ? NOT_RUN : severity]
    }),
  )
}

describe('mergeOxlintConfig, given our entries turning no-debugger off in legacy/** and then on again in legacy/keep/**', () => {
  it("runs ours in the later entry's files, and in no other legacy file", () => {
    const merged = mergedWith(
      {
        rules: { [NO_DEBUGGER]: 'error' },
        fileOverrides: [
          { files: ['legacy/**'], rules: { [NO_DEBUGGER]: 'off' } },
          { files: ['legacy/keep/**'], rules: { [NO_DEBUGGER]: 'error' } },
        ],
      },
      buildTeamOxlintConfig(),
    )

    expect(severitiesIn(merged, NO_DEBUGGER, ['legacy/keep/a.ts', 'legacy/a.ts', 'src/a.ts'])).toStrictEqual({
      'legacy/keep/a.ts': 'error',
      'legacy/a.ts': NOT_RUN,
      'src/a.ts': 'error',
    })
  })
})

describe("mergeOxlintConfig, given a team config listing [react] for TSX files and [promise] by two overrides each excluding the other's files", () => {
  it("runs react's rules as oxlint switches them on for the team, in a TSX test file outside lib/, and in no non-TSX file", () => {
    const merged = mergedWith({}, buildTeamOxlintConfigFrom([FILE_EXCLUDED_BY_TWO_LISTINGS.team]))

    expect(severitiesIn(merged, JSX_KEY, ['src/f.test.tsx', 'src/a.ts'])).toStrictEqual({ 'src/f.test.tsx': 'warn', 'src/a.ts': NOT_RUN })
  })
})
