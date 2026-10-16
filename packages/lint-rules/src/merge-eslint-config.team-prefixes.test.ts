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

// A team may register several of our plugins under prefixes of its own, as antfu's config does
// (eslint-config-reading.ts, underOurPrefixes): a key under one of them names our rule of that plugin
// alone. Here the team registers typescript-eslint under `ts` and eslint-plugin-regexp under `rx`;
// both plugins have a prefer-regexp-exec. Stated under `rx`, it is our regexp rule, now the team's;
// stated under `ts`, it is typescript-eslint's, and our regexp rule stays ours.

const tempProjects = setUpTempProjects()
const { ruleSeverityInProjectFor } = setUpEslintConfigOracle()

const SOURCE_FILE = 'src/a.ts'
const OUR_REGEXP_RULE = 'regexp/prefer-regexp-exec'
const TEAM_PREFIXES_OF_OUR_PLUGINS = { ts: installedEslintPlugin('@typescript-eslint'), rx: installedEslintPlugin('regexp') }

describe('mergeEslintConfig, given a team block registering typescript-eslint as ts and eslint-plugin-regexp as rx', () => {
  const projectDir = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJson()) } })
  const { eslint } = defineLintRules(buildConsumerLintRules(projectDir, {}, { rules: { [OUR_REGEXP_RULE]: 'error' } })).editorRulesets

  /** Our regexp rule's severity in a source file, beside the team block stating the key given off. */
  async function ourRegexpRuleBeside(teamKey: string): Promise<string | undefined> {
    const merged = mergeEslintConfig([buildTeamEslintBlock('team', { plugins: TEAM_PREFIXES_OF_OUR_PLUGINS, rules: { [teamKey]: 'off' } })], eslint, NO_TEAM_OXLINT_CONFIG)
    return ruleSeverityInProjectFor(projectDir, merged, SOURCE_FILE, OUR_REGEXP_RULE)
  }

  it('keeps our regexp prefer-regexp-exec where the team turns ts/prefer-regexp-exec off, a rule of typescript-eslint', async () => {
    expect(await ourRegexpRuleBeside('ts/prefer-regexp-exec')).toBe('error')
  })

  it('drops ours where the team turns rx/prefer-regexp-exec off, our regexp rule under its prefix', async () => {
    expect(await ourRegexpRuleBeside('rx/prefer-regexp-exec')).toBeUndefined()
  })
})
