import type { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'
import { setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import { installedEslintPlugin } from './__tests__/factories/eslint-merge-factories.ts'
import { buildConsumerLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJson, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { buildTeamEslintBlock } from './__tests__/factories/team-config-factories.ts'
import { NO_TEAM_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'
import { mergeEslintConfig } from './eslint.ts'
import { defineLintRules } from './index.ts'

// A key under a team's own prefix for one of our plugins names our rule of that plugin alone:
// prefer-includes under `u` is our unicorn rule, now the team's; under `ts` it is typescript-eslint's.

const tempProjects = setUpTempProjects()
const { ruleSeverityInProjectFor } = setUpEslintConfigOracle()

const SOURCE_FILE = 'src/a.ts'
const OUR_UNICORN_RULE = 'unicorn/prefer-includes'

function teamPrefixesOfOurPlugins(): Readonly<Record<string, ESLint.Plugin>> {
  return { ts: installedEslintPlugin('@typescript-eslint'), u: installedEslintPlugin('unicorn') }
}

describe('mergeEslintConfig, given a team block registering typescript-eslint as ts and eslint-plugin-unicorn as u', () => {
  const projectDir = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJson()) } })

  /** Our unicorn rule's severity in a source file, beside the team block stating the key given off. */
  async function ourUnicornRuleBeside(teamKey: string): Promise<string | undefined> {
    const { eslint } = defineLintRules(buildConsumerLintRules(projectDir, {}, { rules: { [OUR_UNICORN_RULE]: 'error' } })).editorRulesets
    const merged = mergeEslintConfig([buildTeamEslintBlock('team', { plugins: teamPrefixesOfOurPlugins(), rules: { [teamKey]: 'off' } })], eslint, NO_TEAM_OXLINT_CONFIG)
    return ruleSeverityInProjectFor(projectDir, merged, SOURCE_FILE, OUR_UNICORN_RULE)
  }

  it('keeps our unicorn prefer-includes where the team turns ts/prefer-includes off, a rule of typescript-eslint', async () => {
    expect(await ourUnicornRuleBeside('ts/prefer-includes')).toBe('error')
  })

  it('drops ours where the team turns u/prefer-includes off, our unicorn rule under its prefix', async () => {
    expect(await ourUnicornRuleBeside('u/prefer-includes')).toBeUndefined()
  })
})
