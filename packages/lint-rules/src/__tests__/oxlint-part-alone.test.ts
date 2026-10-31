import { catalog } from '@workspace/rule-data'
import { describe, expect, it } from 'vitest'
import { defineLintRules } from '../index.ts'
import type { OxlintPart } from '../core/editor-parts.ts'
import { oxlintPartOf } from './agent-configs.ts'
import { buildConsumerLintRules } from './factories/lint-rules-factories.ts'
import { createProjectListingOxlint } from './factories/package-json-factories.ts'
import { oxlintSeverityFor } from './oxlint-config-oracle.ts'
import { oxlintPartAlone } from './oxlint-part-alone.ts'
import { setUpTempProjects } from './temp-projects.ts'

const PROJECT_WITH_OXLINT = createProjectListingOxlint(setUpTempProjects())

function ourOxlintPart(): OxlintPart {
  const parts = defineLintRules(
    buildConsumerLintRules(
      PROJECT_WITH_OXLINT,
      {},
      {
        rules: { 'react/no-string-refs': 'error', '@typescript-eslint/no-inferrable-types': 'error', '@typescript-eslint/no-non-null-assertion': 'error' },
        fileOverrides: [{ files: ['lib/**'], rules: { 'react/no-string-refs': 'off' } }],
      },
    ),
  ).editorRulesets
  return oxlintPartOf(parts)
}

describe('oxlintPartAlone', () => {
  it('runs each oxlint rule our part states where it states it, and no rule ESLint runs for us', () => {
    const config = oxlintPartAlone(ourOxlintPart(), catalog)

    expect({
      ours: oxlintSeverityFor(config, 'src/f.tsx', 'react/no-string-refs'),
      oursInTheEntry: oxlintSeverityFor(config, 'lib/m.tsx', 'react/no-string-refs'),
      eslintRuns: oxlintSeverityFor(config, 'src/a.ts', 'typescript/no-inferrable-types'),
    }).toStrictEqual({ ours: 'error', oursInTheEntry: 'off', eslintRuns: undefined })
  })

  // typescript is listed for no-non-null-assertion and react for no-string-refs.
  it('lists the plugin of each rule it runs and turns every category off, so it runs no rule it does not name', () => {
    const { plugins, categories } = oxlintPartAlone(ourOxlintPart(), catalog)

    expect({ plugins, categories }).toStrictEqual({
      plugins: ['react', 'typescript'],
      categories: { correctness: 'off', nursery: 'off', pedantic: 'off', perf: 'off', restriction: 'off', style: 'off', suspicious: 'off' },
    })
  })
})
