import { realpathSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONSUMER_CONFIG_FILES, projectNamingEachConfigText } from './__tests__/factories/consumer-project-factories.ts'
import { buildConsumerLintRules, buildConsumerSettings } from './__tests__/factories/lint-rules-factories.ts'
import {
  buildInstalledEslintFiles,
  buildPackageJsonListingOthers,
  buildPackageJsonListingOxlint,
  INSTALLED_ESLINT_MANIFEST,
  packageJsonText,
} from './__tests__/factories/package-json-factories.ts'
import { setUpOxlintMergesInOneProcess } from './__tests__/oxlint-merges-in-one-process.ts'
import { EMPTY_TEAM_OXLINT_CONFIG, NO_TEAM_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { installedPackage, setUpTempProjects } from './__tests__/temp-projects.ts'
import { mergeEslintConfig } from './eslint.ts'
import { defineLintRules } from './index.ts'

// The merge was measured on ESLint 10 alone, so it refuses an installed ESLint below 10. Where no
// ESLint resolves from tsconfigRootDir, the one running the config is installed elsewhere: the merge goes on.

const ESLINT_BELOW_10 = '9.39.1'
const ESLINT_10 = '10.0.0'
const ESLINT_OF_A_LATER_MAJOR = '11.0.0'
const ESLINT_10_PRERELEASE = '10.0.0-rc.1'
// A version that does not start with digits and a dot, which no release of ESLint gives.
const NOT_A_VERSION = 'latest'
// Nor this one, which holds digits and a dot after its start.
const A_VERSION_AFTER_A_PREFIX = 'v10.0.0'
const TYPESCRIPT_ESLINT = installedPackage('typescript-eslint')

const tempProjects = setUpTempProjects()

/** A project listing no oxlint, with a fake ESLint of the version given installed, or none where null. */
function projectWithInstalledEslint(version: string | null): string {
  return tempProjects.create({
    files: { 'package.json': packageJsonText(buildPackageJsonListingOthers()), ...(version === null ? {} : buildInstalledEslintFiles(version)) },
  })
}

function mergedInto(projectDir: string): () => unknown {
  const { eslint } = defineLintRules(buildConsumerLintRules(projectDir, {})).editorRulesets
  return () => mergeEslintConfig([], eslint, NO_TEAM_OXLINT_CONFIG)
}

function belowTenMessage(projectDir: string, version: string): string {
  return `eslint.config.mjs: the ESLint installed for ${projectDir} is ${version}; @agents-inc/lint-rules needs ESLint 10 or later: install eslint 10`
}

describe("mergeEslintConfig, given a project's installed ESLint", () => {
  it(`refuses one below 10, ${ESLINT_BELOW_10}, naming the project, the version and the fix`, () => {
    const projectDir = projectWithInstalledEslint(ESLINT_BELOW_10)

    expect(mergedInto(projectDir)).toThrowError(new Error(belowTenMessage(projectDir, ESLINT_BELOW_10)))
  })

  it.each([
    { which: 'ESLint 10', version: ESLINT_10 },
    { which: 'a later major', version: ESLINT_OF_A_LATER_MAJOR },
    { which: 'a prerelease of ESLint 10', version: ESLINT_10_PRERELEASE },
  ])('accepts $which, $version', ({ version }) => {
    expect(mergedInto(projectWithInstalledEslint(version))).not.toThrow()
  })

  it('accepts a project where no ESLint resolves from tsconfigRootDir', () => {
    expect(mergedInto(projectWithInstalledEslint(null))).not.toThrow()
  })

  it('refuses a manifest whose version does not start with digits and a dot, naming the manifest', () => {
    const projectDir = projectWithInstalledEslint(NOT_A_VERSION)

    expect(mergedInto(projectDir)).toThrowError(realpathSync(join(projectDir, INSTALLED_ESLINT_MANIFEST)))
  })

  it(`refuses a manifest whose version holds digits and a dot only after its start, ${A_VERSION_AFTER_A_PREFIX}, naming the manifest`, () => {
    const projectDir = projectWithInstalledEslint(A_VERSION_AFTER_A_PREFIX)

    expect(mergedInto(projectDir)).toThrowError(realpathSync(join(projectDir, INSTALLED_ESLINT_MANIFEST)))
  })
})

// The check runs on every call, so an oxlint merge reading a team's eslint.config.mjs that calls
// mergeEslintConfig fails with the same message, inside the read's own.
describe('mergeOxlintConfig, reading a team ESLint config that calls mergeEslintConfig, in a project installing ESLint below 10', () => {
  const projectFiles = {
    'package.json': packageJsonText(buildPackageJsonListingOxlint()),
    ...projectNamingEachConfigText(buildConsumerSettings({}), { eslintBlockSources: [], oxlint: EMPTY_TEAM_OXLINT_CONFIG }),
    ...buildInstalledEslintFiles(ESLINT_BELOW_10),
  }
  const mergeReadingTheEslintConfig = setUpOxlintMergesInOneProcess(
    projectFiles,
    { theirs: EMPTY_TEAM_OXLINT_CONFIG, eslintConfig: CONSUMER_CONFIG_FILES.eslint, times: 1 },
    [TYPESCRIPT_ESLINT],
  )

  it('is refused with the ESLint merge\'s message, inside the error naming the file it could not read', () => {
    const { projectDir, outcome } = mergeReadingTheEslintConfig()

    expect(outcome).toStrictEqual({
      refused: `oxlint.config.mts: could not read your ESLint config at ${join(projectDir, CONSUMER_CONFIG_FILES.eslint)}: ${belowTenMessage(projectDir, ESLINT_BELOW_10)}`,
    })
  })
})
