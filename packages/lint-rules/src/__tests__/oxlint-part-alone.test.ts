import { catalog } from '@workspace/rule-data'
import { describe, expect, it } from 'vitest'
import { defineLintRules } from '../index.ts'
import type { OxlintPart } from '../core/editor-parts.ts'
import { buildConsumerLintRules } from './factories/lint-rules-factories.ts'
import { buildPackageJsonListingOxlint, packageJsonText } from './factories/package-json-factories.ts'
import { oxlintSeverityFor } from './oxlint-config-oracle.ts'
import { oxlintPartAlone } from './oxlint-part-alone.ts'
import { setUpTempProjects } from './temp-projects.ts'

const PROJECT_WITH_OXLINT = setUpTempProjects().create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()) } })

function ourOxlintPart(): OxlintPart {
  const { oxlint } = defineLintRules(
    buildConsumerLintRules(
      PROJECT_WITH_OXLINT,
      {},
      {
        rules: { 'react/jsx-key': 'error', '@typescript-eslint/array-type': 'error', '@typescript-eslint/no-non-null-assertion': 'error' },
        fileOverrides: [{ files: ['lib/**'], rules: { 'react/jsx-key': 'off' } }],
      },
    ),
  ).editorRulesets
  if (oxlint === undefined) throw new Error('a project listing oxlint has an oxlint part')
  return oxlint
}

describe('oxlintPartAlone', () => {
  it('runs each oxlint rule our part states where it states it, and no rule ESLint runs for us', () => {
    const config = oxlintPartAlone(ourOxlintPart(), catalog)

    expect({
      ours: oxlintSeverityFor(config, 'src/f.tsx', 'react/jsx-key'),
      oursInTheEntry: oxlintSeverityFor(config, 'lib/m.tsx', 'react/jsx-key'),
      eslintRuns: oxlintSeverityFor(config, 'src/a.ts', 'typescript/array-type'),
    }).toStrictEqual({ ours: 'error', oursInTheEntry: 'off', eslintRuns: undefined })
  })

  // typescript is listed for no-non-null-assertion, which oxlint runs, and react for jsx-key.
  it('lists the plugin of each rule it runs and turns every category off, so it runs no rule it does not name', () => {
    const { plugins, categories } = oxlintPartAlone(ourOxlintPart(), catalog)

    expect({ plugins, categories }).toStrictEqual({
      plugins: ['react', 'typescript'],
      categories: { correctness: 'off', nursery: 'off', pedantic: 'off', perf: 'off', restriction: 'off', style: 'off', suspicious: 'off' },
    })
  })
})
