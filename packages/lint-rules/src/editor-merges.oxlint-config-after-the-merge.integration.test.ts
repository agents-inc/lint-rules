import { beforeAll, describe, expect, it } from 'vitest'
import { ARRAY_TYPE, ARRAY_TYPE_SOURCE, NO_VAR, OURS_ARRAY_TYPE_AND_NO_VAR } from './__tests__/cases/team-sets-a-rule.ts'
import { eslintEngineFindingsOf, eslintFatalMessagesOf, setUpConsumerEslintCliRun } from './__tests__/consumer-cli-runs.ts'
import { CONSUMER_CONFIG_FILES, projectNamingEachConfigText } from './__tests__/factories/consumer-project-factories.ts'
import { buildConsumerSettings } from './__tests__/factories/lint-rules-factories.ts'
import { oxlintConfigAddingRulesAfterTheMergeText } from './__tests__/factories/oxlint-config-after-the-merge-factories.ts'
import { buildPackageJsonListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { type FindingsByFileAndRule, findingsByFileAndRule } from './__tests__/findings-beside-the-team.ts'
import { EMPTY_TEAM_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { INSTALLED_OXLINT, installedPackage } from './__tests__/temp-projects.ts'

// A documented limit: a rule a team's oxlint.config.mts sets after our merge is out of the ESLint
// merge's sight. Our ESLint part runs no-var and array-type; the team turns no-var off after the merge.

const TYPESCRIPT_ESLINT = installedPackage('typescript-eslint')
const SOURCE_FILE = 'src/a.ts'

describe('no-var, which the team turns off in rules its oxlint.config.mts adds after our merge, rather than handing them to the merge', () => {
  const run = setUpConsumerEslintCliRun(
    {
      'package.json': packageJsonText(buildPackageJsonListingOxlint()),
      ...projectNamingEachConfigText(buildConsumerSettings({}, { rules: OURS_ARRAY_TYPE_AND_NO_VAR }), { eslintBlockSources: [], oxlint: EMPTY_TEAM_OXLINT_CONFIG }),
      [CONSUMER_CONFIG_FILES.oxlint]: oxlintConfigAddingRulesAfterTheMergeText(
        CONSUMER_CONFIG_FILES.lintRules,
        EMPTY_TEAM_OXLINT_CONFIG,
        { eslintConfig: CONSUMER_CONFIG_FILES.eslint },
        { [NO_VAR.rule]: 'off' },
      ),
      [SOURCE_FILE]: ARRAY_TYPE_SOURCE,
    },
    [TYPESCRIPT_ESLINT, INSTALLED_OXLINT],
  )
  // eslint-disable-next-line functional/no-let -- it.fails: only the assertion may throw, so the run is in beforeAll and its result crosses to the test (CLAUDE.md, Tests; q-lint-no-let-it-fails)
  let findings: FindingsByFileAndRule = {}

  beforeAll(() => {
    findings = findingsByFileAndRule(eslintEngineFindingsOf(run()), [SOURCE_FILE], [NO_VAR, ARRAY_TYPE])
  })

  it('is linted by ESLint with no fatal message', () => {
    expect(eslintFatalMessagesOf(run())).toStrictEqual([])
  })

  it('has array-type, which the team sets nowhere, reported by ESLint, ours', () => {
    expect(findingsByFileAndRule(eslintEngineFindingsOf(run()), [SOURCE_FILE], [ARRAY_TYPE])).toStrictEqual({
      [SOURCE_FILE]: { [ARRAY_TYPE.rule]: ['src/a.ts:1 @typescript-eslint/array-type'] },
    })
  })

  // KNOWN GAP: the ESLint merge reads only what was handed to the oxlint merge, so ours still runs no-var.
  it.fails("is the team's, which ESLint does not report", () => {
    expect(findings).toStrictEqual({ [SOURCE_FILE]: { [NO_VAR.rule]: [], [ARRAY_TYPE.rule]: ['src/a.ts:1 @typescript-eslint/array-type'] } })
  })
})
