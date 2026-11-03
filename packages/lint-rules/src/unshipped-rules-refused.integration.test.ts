import { describe, expect, it } from 'vitest'
import {
  ENTRY_GLOBS,
  SHIPPED_RUN_BY_ESLINT,
  SHIPPED_RUN_BY_OXLINT,
  UNSHIPPED_RUN_BY_ESLINT,
  UNSHIPPED_RUN_BY_OXLINT,
  unshippedRuleRefusal,
} from './__tests__/cases/rules-we-do-not-ship.ts'
import { type CliRun, EXIT, runCheck } from './__tests__/cli-runs.ts'
import { type EslintCliOutcome, eslintCliOutcomeOf, type OxlintCliOutcome, oxlintCliOutcomeOf } from './__tests__/engine-clis.ts'
import { checkedPackageFiles, exportedConstant, moduleText, REPORTING_RULESETS } from './__tests__/factories/check-factories.ts'
import { CONSUMER_CONFIG_FILES, projectNamingEachConfigText } from './__tests__/factories/consumer-project-factories.ts'
import { buildConsumerSettings, type LintRulesPiece } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { createGitProject } from './__tests__/git-projects.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { INSTALLED_OXLINT, installedPackage, type TempProjects, THIS_PACKAGE } from './__tests__/temp-projects.ts'
import { EMPTY_TEAM_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'

// Our rules list accepts only rules we ship; naming any other rule there stops with a message pointing to the team's
// own ESLint or oxlint config. Each place agents-inc.lint.mts loads stops on it: check, and both engines' CLIs through
// the team's own configs, as an editor loads them.

const TYPESCRIPT_ESLINT = installedPackage('typescript-eslint')
const SOURCE_FILE = 'src/a.ts'

type EngineOutcomes = { readonly eslint: EslintCliOutcome; readonly oxlint: OxlintCliOutcome }

const LINTED = '(it linted, refusing nothing)'

/** What the CLI printed on refusing to lint, or LINTED: a refusal's text is what a failure here should show. */
function printedOnRefusing(outcome: EslintCliOutcome | OxlintCliOutcome): string {
  return outcome.outcome === 'refused' ? outcome.output : LINTED
}

const NAMING_UNSHIPPED_AT_THE_TOP: LintRulesPiece = { rules: { [UNSHIPPED_RUN_BY_OXLINT]: 'error' } }
const NAMING_UNSHIPPED_IN_AN_ENTRY: LintRulesPiece = { fileOverrides: [{ files: ENTRY_GLOBS, rules: { [UNSHIPPED_RUN_BY_ESLINT]: 'error' } }] }
const NAMING_ONLY_SHIPPED: LintRulesPiece = {
  rules: { [SHIPPED_RUN_BY_OXLINT]: 'error', [SHIPPED_RUN_BY_ESLINT]: 'off' },
  fileOverrides: [{ files: ENTRY_GLOBS, rules: { [SHIPPED_RUN_BY_ESLINT]: 'error' } }],
}

/** Committed, so check has nothing changed to lint once the config loads. */
function checkOfAProjectNaming(tempProjects: TempProjects, piece: LintRulesPiece): CliRun {
  return runCheck(createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(REPORTING_RULESETS, piece) }).dir)
}

function enginesOverAProjectNaming(tempProjects: TempProjects, piece: LintRulesPiece): EngineOutcomes {
  const projectDir = tempProjects.create({
    files: {
      'package.json': packageJsonText(buildPackageJsonListingOxlint()),
      ...projectNamingEachConfigText(buildConsumerSettings({}, piece), { eslintBlockSources: [], oxlint: EMPTY_TEAM_OXLINT_CONFIG }),
      [SOURCE_FILE]: moduleText(exportedConstant('a')),
    },
    linkedPackages: [THIS_PACKAGE, TYPESCRIPT_ESLINT, INSTALLED_OXLINT],
  })
  return { eslint: eslintCliOutcomeOf(projectDir), oxlint: oxlintCliOutcomeOf(projectDir, CONSUMER_CONFIG_FILES.oxlint) }
}

describe('check, where agents-inc.lint.mts names a rule we do not ship in its rules', () => {
  const runs = setUpRunsBeforeTheSuite((tempProjects) => ({
    atTheTop: checkOfAProjectNaming(tempProjects, NAMING_UNSHIPPED_AT_THE_TOP),
    inAnEntry: checkOfAProjectNaming(tempProjects, NAMING_UNSHIPPED_IN_AN_ENTRY),
    onlyShipped: checkOfAProjectNaming(tempProjects, NAMING_ONLY_SHIPPED),
  }))

  it("exits 2 where the top-level rules name it, printing the refusal that points to the team's own configs", () => {
    expect(runs().atTheTop).toStrictEqual({
      exitCode: EXIT.couldNotRun,
      signal: null,
      stdout: '',
      stderr: `check: could not run: ${unshippedRuleRefusal('rules', UNSHIPPED_RUN_BY_OXLINT)}\n`,
    })
  })

  it("exits 2 where a file override's rules name it, printing the refusal naming that entry", () => {
    expect(runs().inAnEntry).toStrictEqual({
      exitCode: EXIT.couldNotRun,
      signal: null,
      stdout: '',
      stderr: `check: could not run: ${unshippedRuleRefusal('fileOverrides[0].rules', UNSHIPPED_RUN_BY_ESLINT)}\n`,
    })
  })

  it('loads the config where the rules, top-level and in an entry, name only rules we ship', () => {
    const { exitCode, stderr } = runs().onlyShipped

    expect({ exitCode, stderr }).toStrictEqual({ exitCode: EXIT.clean, stderr: '' })
  })
})

describe("the engines' CLIs over the team's own configs, where agents-inc.lint.mts names a rule we do not ship in its rules", () => {
  const runs = setUpRunsBeforeTheSuite((tempProjects) => ({
    naming: enginesOverAProjectNaming(tempProjects, NAMING_UNSHIPPED_AT_THE_TOP),
    namingOnlyShipped: enginesOverAProjectNaming(tempProjects, NAMING_ONLY_SHIPPED),
  }))

  it('stop ESLint on loading eslint.config.mjs, with the refusal', () => {
    expect(printedOnRefusing(runs().naming.eslint)).toContain(unshippedRuleRefusal('rules', UNSHIPPED_RUN_BY_OXLINT))
  })

  it('stop oxlint on loading oxlint.config.mts, with the refusal', () => {
    expect(printedOnRefusing(runs().naming.oxlint)).toContain(unshippedRuleRefusal('rules', UNSHIPPED_RUN_BY_OXLINT))
  })

  it('let both lint where the rules name only rules we ship', () => {
    const { eslint, oxlint } = runs().namingOnlyShipped

    expect({ eslint: printedOnRefusing(eslint), oxlint: printedOnRefusing(oxlint) }).toStrictEqual({ eslint: LINTED, oxlint: LINTED })
  })
})
