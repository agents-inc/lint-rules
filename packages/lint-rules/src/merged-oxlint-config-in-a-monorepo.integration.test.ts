import { join } from 'node:path'
import type { OxlintConfig } from 'oxlint'
import { describe, expect, it } from 'vitest'
import { describeFinding, type OxlintCliOutcome, oxlintCliOutcomeFindingItsConfigs, oxlintFindingsIn, writeOxlintConfigFile } from './__tests__/engine-clis.ts'
import { agentsIncLintModuleTextRootedAtItsFolder, CONSUMER_CONFIG_FILES, mergedOxlintConfigText } from './__tests__/factories/consumer-project-factories.ts'
import { buildConsumerSettings } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { buildTeamOxlintConfig } from './__tests__/factories/team-config-factories.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { EMPTY_TEAM_OXLINT_CONFIG, NO_TEAM_ESLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { CONSUMER_INSTALL, type ProjectFiles, type TempProjects } from './__tests__/temp-projects.ts'

// oxlint refuses `options` in any config below the one in the folder it starts in, so a merged package config
// written with an option of ours stopped a root git hook or CI linting anything. Run with no config named,
// oxlint takes the root's config and the package's for the package's files.

/** What oxlint did: the findings in web's own files, or the text it printed refusing a config. */
type Linting = { readonly outcome: 'linted'; readonly webFindings: readonly string[] } | { readonly outcome: 'refused'; readonly output: string }

const WEB = 'apps/web'
const PLANTED_FINDING_FILE = 'src/a.ts'
const DEBUGGER_STATEMENT = 'debugger\n'
// The rule the planted finding draws, turned on through `rules` with no ruleset listed.
const WEB_SETTINGS = buildConsumerSettings({}, { rules: { 'no-debugger': 'error' } })
const TYPE_AWARE_ONLY_AT_THE_ROOT = 'The `options.typeAware` option is only supported in the root config, but it was found in '

/** A monorepo root with a config of its own, and web, whose config merges our part into the team's. */
function monorepoWithWebMerging(tempProjects: TempProjects, webTeamConfig: Readonly<OxlintConfig>): string {
  const webFiles: ProjectFiles = {
    'package.json': packageJsonText(buildPackageJsonListingOxlint()),
    [CONSUMER_CONFIG_FILES.lintRules]: agentsIncLintModuleTextRootedAtItsFolder(WEB_SETTINGS),
    [CONSUMER_CONFIG_FILES.oxlint]: mergedOxlintConfigText(CONSUMER_CONFIG_FILES.lintRules, webTeamConfig, NO_TEAM_ESLINT_CONFIG),
    [PLANTED_FINDING_FILE]: DEBUGGER_STATEMENT,
  }
  const projectDir = tempProjects.create({
    files: {
      'package.json': packageJsonText(buildPackageJsonListingOxlint()),
      ...filesUnderWeb(webFiles),
    },
    linkedPackages: CONSUMER_INSTALL,
  })
  writeOxlintConfigFile(projectDir, CONSUMER_CONFIG_FILES.oxlint, EMPTY_TEAM_OXLINT_CONFIG)
  return projectDir
}

/** Paths given in web, returned from the monorepo's root. */
function filesUnderWeb(files: ProjectFiles): ProjectFiles {
  return Object.fromEntries(Object.entries(files).map(([file, text]) => [`${WEB}/${file}`, text]))
}

/** Web's findings as oxlint names their files from the folder it ran in. */
function lintingOf(outcome: OxlintCliOutcome, webFilesPrefix: string): Linting {
  if (outcome.outcome === 'refused') return outcome
  const webFindings = oxlintFindingsIn(outcome.run.report).filter(({ file }) => file.startsWith(`${webFilesPrefix}src/`))
  return { outcome: 'linted', webFindings: webFindings.map(describeFinding) }
}

describe("a monorepo whose root has an oxlint config of its own, beside a package's config merging our part", () => {
  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    const merged = monorepoWithWebMerging(tempProjects, buildTeamOxlintConfig())
    const teamTypeAware = monorepoWithWebMerging(tempProjects, buildTeamOxlintConfig({ options: { typeAware: false } }))
    return {
      fromTheRoot: lintingOf(oxlintCliOutcomeFindingItsConfigs(merged), `${WEB}/`),
      fromThePackage: lintingOf(oxlintCliOutcomeFindingItsConfigs(join(merged, WEB)), ''),
      teamTypeAwareFromTheRoot: { linting: lintingOf(oxlintCliOutcomeFindingItsConfigs(teamTypeAware), `${WEB}/`), webConfig: join(teamTypeAware, WEB, CONSUMER_CONFIG_FILES.oxlint) },
    }
  })

  it("is linted by oxlint from the root, which reports the package's planted finding", () => {
    expect(runs().fromTheRoot).toStrictEqual({ outcome: 'linted', webFindings: [`${WEB}/${PLANTED_FINDING_FILE}:1 eslint(no-debugger)`] })
  })

  it("is linted by oxlint from the package's folder, which reports the planted finding", () => {
    expect(runs().fromThePackage).toStrictEqual({ outcome: 'linted', webFindings: [`${PLANTED_FINDING_FILE}:1 eslint(no-debugger)`] })
  })

  // A written limit: an option is oxlint's to refuse below the root, and its refusal names the option and the file.
  it("is refused by oxlint from the root where the team's own package config gives an option", () => {
    const { linting, webConfig } = runs().teamTypeAwareFromTheRoot
    // vitest types its asymmetric matchers as any; held as unknown, it compares as written.
    const namingTheOptionAndTheFile: unknown = expect.stringContaining(`${TYPE_AWARE_ONLY_AT_THE_ROOT}${webConfig}.`)

    expect(linting).toStrictEqual({ outcome: 'refused', output: namingTheOptionAndTheFile })
  })
})
