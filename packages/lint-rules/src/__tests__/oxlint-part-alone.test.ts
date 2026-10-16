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
        rules: { 'react/jsx-key': 'error', '@typescript-eslint/array-type': 'error', '@typescript-eslint/no-non-null-assertion': 'error' },
        fileOverrides: [{ files: ['lib/**'], rules: { 'react/jsx-key': 'off' } }],
      },
    ),
  ).editorRulesets
  return oxlintPartOf(parts)
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

  // typescript is listed for no-non-null-assertion, which oxlint runs, react for jsx-key, and unicorn
  // for no-abusive-eslint-disable, which oxlint runs where suppressions are allowed (owner, q-r1), as
  // they are in the editor parts.
  it('lists the plugin of each rule it runs and turns every category off, so it runs no rule it does not name', () => {
    const { plugins, categories } = oxlintPartAlone(ourOxlintPart(), catalog)

    expect({ plugins, categories }).toStrictEqual({
      plugins: ['react', 'typescript', 'unicorn'],
      categories: { correctness: 'off', nursery: 'off', pedantic: 'off', perf: 'off', restriction: 'off', style: 'off', suspicious: 'off' },
    })
  })
})
