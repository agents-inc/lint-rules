import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { oxlintPartOf } from './__tests__/agent-configs.ts'
import { buildEveryRulesetLintRules, EMPTY_TSCONFIG_ROOT_DIR } from './__tests__/factories/lint-rules-factories.ts'
import {
  buildPackageJsonListingOxlint,
  createProjectListingOxlint,
  malformedPackageJsonText,
  packageJsonText,
} from './__tests__/factories/package-json-factories.ts'
import { buildTeamOxlintConfig } from './__tests__/factories/team-config-factories.ts'
import { NO_TEAM_ESLINT_CONFIG, NO_TEAM_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { INSTALLED_OXLINT, setUpTempProjects } from './__tests__/temp-projects.ts'
import { mergeEslintConfig } from './eslint.ts'
import { defineLintRules, type LintRules } from './index.ts'
import { mergeOxlintConfig } from './oxlint.ts'

const validLintRules = buildEveryRulesetLintRules(EMPTY_TSCONFIG_ROOT_DIR)
const PACKAGE_JSON = 'package.json'

describe('an error in agents-inc.lint.mts', () => {
  it('is absent from a valid config, both sets given', () => {
    expect(() => defineLintRules(validLintRules)).not.toThrow()
  })
})

// Each value fails one condition alone, beside one passing all; each message names the condition it
// fails, as a wrong reason sends the consumer after the wrong problem.
describe('tsconfigRootDir in agents-inc.lint.mts', () => {
  const tempProjects = setUpTempProjects()
  const projectDir = createProjectListingOxlint(tempProjects)
  const refusedValues = [
    { value: '.', refused: 'as a relative path to a folder', reason: 'is not an absolute path' },
    { value: join(projectDir, 'no-such-folder'), refused: 'as an absolute path to nothing', reason: 'does not exist' },
    { value: join(projectDir, PACKAGE_JSON), refused: 'as an absolute path to a file', reason: 'is not a folder' },
  ]

  it.each(refusedValues)('is refused $refused, naming the file, the key, the value and the condition it fails', ({ value, reason }) => {
    expect(() => defineLintRules({ ...validLintRules, tsconfigRootDir: value })).toThrowError(
      new Error(`agents-inc.lint.mts: tsconfigRootDir: "${value}" ${reason}`),
    )
  })

  it('is accepted as the absolute path of an existing folder', () => {
    expect(() => defineLintRules({ ...validLintRules, tsconfigRootDir: projectDir })).not.toThrow()
  })

  // Checked before anything reads the folder, so a package.json above it that cannot be read is blamed only once the
  // folder passes.
  describe('under a package.json that cannot be read', () => {
    const projectWithAMalformedPackageJson = tempProjects.create({ files: { [PACKAGE_JSON]: malformedPackageJsonText() } })

    it('is refused for the condition it fails, not for that package.json', () => {
      const value = join(projectWithAMalformedPackageJson, 'no-such-folder')

      expect(() => defineLintRules({ ...validLintRules, tsconfigRootDir: value })).toThrow(
        new Error(`agents-inc.lint.mts: tsconfigRootDir: "${value}" does not exist`),
      )
    })

    it('passes as an existing folder, and that package.json is then blamed', () => {
      expect(() => defineLintRules({ ...validLintRules, tsconfigRootDir: projectWithAMalformedPackageJson })).toThrow(
        new Error(`${join(projectWithAMalformedPackageJson, PACKAGE_JSON)}: not valid JSON`),
      )
    })
  })
})

describe('allowSuppressions in agents-inc.lint.mts', () => {
  it.each([[true], [false]])('is accepted as %s', (allowSuppressions) => {
    expect(() => defineLintRules({ ...validLintRules, allowSuppressions })).not.toThrow()
  })
})

describe('a library ruleset in agents-inc.lint.mts', () => {
  it('is accepted in its own domain', () => {
    expect(() => defineLintRules({ ...validLintRules, agentRulesets: { ...validLintRules.agentRulesets, libs: { data: ['drizzle'] } } })).not.toThrow()
  })
})

// allowSuppressions sets the suppression rules; the types refuse one named in rules, though not in every shape
// (docs/plan.md, Open, "Written limit of the config's types").
describe('a suppression rule set in agents-inc.lint.mts', () => {
  it('is absent from a config that allows suppressions through allowSuppressions and sets other rules', () => {
    const allowingSuppressions = {
      ...validLintRules,
      allowSuppressions: true,
      rules: { 'no-debugger': 'off' },
      fileOverrides: [{ files: ['strict/**'], allowSuppressions: false, rules: { 'no-debugger': 'error' } }],
    } satisfies LintRules

    expect(() => defineLintRules(allowingSuppressions)).not.toThrow()
  })
})

// A team's eslint.config.mjs is untyped, so it may hand mergeEslintConfig the oxlint part. The error names the config
// file that passed it. mergeOxlintConfig handed the ESLint part is refused by its type alone (merge-oxlint-config.test-d.ts).
describe("a part handed to the other engine's merge", () => {
  const tempProjects = setUpTempProjects()
  const projectWithOxlint = tempProjects.create({
    files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()) },
    linkedPackages: [INSTALLED_OXLINT],
  })

  /** Both parts of a project whose package.json lists oxlint, the oxlint one checked present. */
  function bothParts() {
    const parts = defineLintRules(buildEveryRulesetLintRules(projectWithOxlint)).editorRulesets
    return { eslint: parts.eslint, oxlint: oxlintPartOf(parts) }
  }

  it('is refused by mergeEslintConfig when it is the oxlint part, the error naming eslint.config.mjs', () => {
    const { oxlint } = bothParts()

    // @ts-expect-error the oxlint part is no ESLint part
    expect(() => mergeEslintConfig([], oxlint, NO_TEAM_OXLINT_CONFIG)).toThrowError(/^eslint\.config\.mjs: /u)
  })

  it('is accepted by mergeEslintConfig when it is the ESLint part', () => {
    const { eslint } = bothParts()

    expect(() => mergeEslintConfig([], eslint, NO_TEAM_OXLINT_CONFIG)).not.toThrow()
  })

  it('is accepted by mergeOxlintConfig when it is the oxlint part', () => {
    const { oxlint } = bothParts()

    expect(() => mergeOxlintConfig(buildTeamOxlintConfig(), oxlint, NO_TEAM_ESLINT_CONFIG)).not.toThrow()
  })
})
