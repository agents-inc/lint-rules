import { readdirSync } from 'node:fs'
import { basename } from 'node:path'
import type { OxlintConfig, OxlintOverride } from 'oxlint'
import { describe, expect, it } from 'vitest'
import { idOfAnEndedProcess, tempConfigNameOf, tempConfigPatternOf } from '../../__tests__/cli-runs.ts'
import { buildCatalog, buildEslintRoute, buildOxlintRoute, buildQualityRuleset, buildShippedRule } from '../../__tests__/factories/catalog-factories.ts'
import { buildWithheldFixes } from '../../__tests__/factories/check-factories.ts'
import { setUpTempProjects } from '../../__tests__/temp-projects.ts'
import { fixRunConfigOf, tempOxlintConfigIn } from './oxlint-run.ts'

const tempProjects = setUpTempProjects()

describe("the sweep of other runs' temporary oxlint configs (K-11)", () => {
  // Process 1 lives, and belongs to root: another user is not permitted to signal it (EPERM).
  const A_LIVE_PROCESS_OF_ANOTHER_USER = 1
  const ENDED = idOfAnEndedProcess()
  const LEFT_BY_AN_ENDED_RUN = tempConfigNameOf(ENDED, 'left')
  const HELD_BY_ANOTHER_USERS_RUN = tempConfigNameOf(A_LIVE_PROCESS_OF_ANOTHER_USER, 'held')
  const NAMES_THAT_ONLY_HOLD_ONE = [`notes${LEFT_BY_AN_ENDED_RUN}`, `${LEFT_BY_AN_ENDED_RUN}.bak`]

  it("removes an ended run's config, keeps a live run's, another user's included, and a file whose name only holds a config's name, and reserves this run's name", () => {
    const folder = tempProjects.create({
      files: Object.fromEntries([LEFT_BY_AN_ENDED_RUN, HELD_BY_ANOTHER_USERS_RUN, ...NAMES_THAT_ONLY_HOLD_ONE].map((name) => [name, '{}'])),
    })
    const reserved = tempOxlintConfigIn(folder)

    expect({ left: readdirSync(folder).toSorted(), reserved: { folder: reserved.folder, isThisRuns: tempConfigPatternOf(process.pid).test(basename(reserved.path)) } }).toStrictEqual({
      left: [HELD_BY_ANOTHER_USERS_RUN, ...NAMES_THAT_ONLY_HOLD_ONE].toSorted(),
      reserved: { folder, isThisRuns: true },
    })
  })
})

describe("oxlint's fix run config (X2)", () => {
  const QUALITY = 'quality-set'
  const WITHHELD_ON_OXLINT = 'unicorn/prefer-optional-catch-binding'
  const WITHHELD_ON_ESLINT = 'perfectionist/sort-arrays'
  const CATALOG = buildCatalog({
    rulesets: [buildQualityRuleset(QUALITY)],
    rules: [
      buildOxlintRoute(WITHHELD_ON_OXLINT, { oxlintName: WITHHELD_ON_OXLINT, oxlintPlugin: 'unicorn', shipped: buildShippedRule(QUALITY) }),
      buildOxlintRoute('no-debugger', { oxlintName: 'no-debugger', oxlintPlugin: 'eslint', shipped: buildShippedRule(QUALITY) }),
      buildEslintRoute(WITHHELD_ON_ESLINT, { typed: false, shipped: buildShippedRule(QUALITY) }),
    ],
  })
  const ON_TS_FILES: OxlintOverride = { files: ['**/*.ts'], rules: { [WITHHELD_ON_OXLINT]: 'error' } }
  const AGENT_BUILD: OxlintConfig = { rules: { [WITHHELD_ON_OXLINT]: 'error', 'no-debugger': 'error' }, overrides: [ON_TS_FILES] }

  it("turns each withheld rule oxlint runs off in every file, in an override after the build's own", () => {
    expect(fixRunConfigOf(AGENT_BUILD, buildWithheldFixes(WITHHELD_ON_OXLINT, WITHHELD_ON_ESLINT), CATALOG)).toStrictEqual({
      ...AGENT_BUILD,
      overrides: [ON_TS_FILES, { files: ['**/*'], rules: { [WITHHELD_ON_OXLINT]: 'off' } }],
    })
  })

  it('leaves the build as it is where no withheld rule runs on oxlint', () => {
    expect(fixRunConfigOf(AGENT_BUILD, buildWithheldFixes(WITHHELD_ON_ESLINT), CATALOG)).toStrictEqual(AGENT_BUILD)
  })
})
