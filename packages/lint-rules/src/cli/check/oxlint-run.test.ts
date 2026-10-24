import { readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { buildShippedRule } from '@workspace/rule-data/test-support/shipped-rule-factories'
import type { OxlintConfig, OxlintOverride } from 'oxlint'
import { describe, expect, it } from 'vitest'
import { idOfAnEndedProcess, tempConfigNameOf, tempConfigPatternOf } from '../../__tests__/cli-runs.ts'
import { buildCatalog, buildEslintRoute, buildOxlintRoute, buildQualityRuleset } from '../../__tests__/factories/catalog-factories.ts'
import { OXLINT_REFUSAL_OF_A_RULE, RULE_OXLINT_DOES_NOT_HAVE } from '../../__tests__/cases/oxlint-refusals.ts'
import { buildWithheldFixes, DEBUGGER_STATEMENT, moduleText } from '../../__tests__/factories/check-factories.ts'
import { settledOf } from '../../__tests__/settled-runs.ts'
import { allowEveryTestForParallelLoad } from '../../__tests__/parallel-load.ts'
import { setUpTempProjects } from '../../__tests__/temp-projects.ts'
import { oxlintRulesFailed } from './not-checked.ts'
import { fixRunConfigOf, oxlintLintRun, tempOxlintConfigIn } from './oxlint-run.ts'

allowEveryTestForParallelLoad()

const tempProjects = setUpTempProjects()

describe("the sweep of other runs' temporary oxlint configs", () => {
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

  // A run of this process is live, so a second check called in it never removes the first one's config.
  it('keeps a config another run of this process holds', () => {
    const heldByThisProcess = tempConfigNameOf(process.pid, 'held')
    const folder = tempProjects.create({ files: { [heldByThisProcess]: '{}' } })
    tempOxlintConfigIn(folder)

    expect(readdirSync(folder)).toStrictEqual([heldByThisProcess])
  })
})

describe("oxlint's fix run config", () => {
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

  // A team that sets a rule to warn has it listed, not fixed: check fixes errors alone.
  it('turns each rule set to warn off, at the top and in each override, its options with it, and leaves each rule at error on', () => {
    const WARNED_IN_AN_OVERRIDE: OxlintOverride = { files: ['src/**'], rules: { 'no-console': ['warn', { allow: ['info'] }], [WITHHELD_ON_OXLINT]: 'error' } }
    const warned: OxlintConfig = { rules: { [WITHHELD_ON_OXLINT]: 'warn', 'no-debugger': 'error' }, overrides: [WARNED_IN_AN_OVERRIDE] }

    expect(fixRunConfigOf(warned, buildWithheldFixes(WITHHELD_ON_ESLINT), CATALOG)).toStrictEqual({
      rules: { [WITHHELD_ON_OXLINT]: 'off', 'no-debugger': 'error' },
      overrides: [{ files: ['src/**'], rules: { 'no-console': 'off', [WITHHELD_ON_OXLINT]: 'error' } }],
    })
  })
})

describe("oxlint's lint run", () => {
  const LINTED_FILE = 'src/a.ts'
  const ACCEPTED: OxlintConfig = { rules: { 'no-debugger': 'error' } }
  const REFUSED: OxlintConfig = { rules: { [RULE_OXLINT_DOES_NOT_HAVE]: 'error' } }

  function lintedIn(folder: string, config: OxlintConfig, signal: AbortSignal): ReturnType<typeof oxlintLintRun> {
    return oxlintLintRun(tempOxlintConfigIn(folder), config, [join(folder, LINTED_FILE)], signal)
  }

  it("lists oxlint's rules as not checked, quoting all oxlint printed, where it refuses the config, beside a run it reports", async () => {
    const folder = tempProjects.create({ files: { [LINTED_FILE]: moduleText(DEBUGGER_STATEMENT) } })
    const running = new AbortController().signal
    const [refused, accepted] = [await lintedIn(folder, REFUSED, running), await lintedIn(folder, ACCEPTED, running)]

    expect({ refused, accepted: { codes: accepted.report.diagnostics.map(({ code }) => code), notChecked: accepted.notChecked } }).toStrictEqual({
      refused: { report: { diagnostics: [] }, notChecked: [oxlintRulesFailed(new Error(`oxlint failed: ${OXLINT_REFUSAL_OF_A_RULE}`))] },
      accepted: { codes: ['eslint(no-debugger)'], notChecked: [] },
    })
  })

  it('throws where the signal stopped it, beside a run oxlint refuses, which it lists', async () => {
    const folder = tempProjects.create({ files: { [LINTED_FILE]: moduleText(DEBUGGER_STATEMENT) } })
    const stopped = AbortSignal.abort()
    const settled = await settledOf(lintedIn(folder, REFUSED, stopped))

    expect({ threw: 'threw' in settled, listed: (await lintedIn(folder, REFUSED, new AbortController().signal)).notChecked }).toStrictEqual({
      threw: true,
      listed: [oxlintRulesFailed(new Error(`oxlint failed: ${OXLINT_REFUSAL_OF_A_RULE}`))],
    })
  })
})
