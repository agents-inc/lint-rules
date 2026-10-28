import { describe, expect, it } from 'vitest'

import canonicalRules from '../data/rules.json' with { type: 'json' }
import { heldCasesOutOfPlace } from './__tests__/accepted-rules-out-of-place.ts'
import {
  ACCEPTED_COMPAT_CASES,
  ACCEPTED_COMPAT_CASES_IN_PROJECTS_NAMING_BROWSERS,
  ACCEPTED_CPT_HELD_CASES,
  ACCEPTED_CPT_HELD_CASES_IN_PROJECTS_NAMING_BROWSERS,
  type CaseInAProjectNamingBrowsers,
  MAJOR_BROWSERS_AS_VITE_TARGETS,
} from './__tests__/cases/accepted-cpt.ts'
import { ACCEPTED_ON_2026_10_24 } from './__tests__/cases/accepted-on-2026-10-24.ts'
import { ruleCaseTitleOf, setUpRuleCaseOutcomes } from './__tests__/rule-case-outcomes.ts'
import { type CaseFile, type FileOutcome, eslintBlocksOf, eslintOutcomesOf, shippedSettingsOf, writeCaseFiles } from './__tests__/rule-case-runs.ts'
import { setUpTempDir } from './__tests__/temp-dirs.ts'
import { catalog, routeOf } from './catalog.ts'

// The compat rule the owner accepted runs as it ships, through the real ESLint: it reports a browser API one of the
// major browsers lacks and stays silent beside it. It ships in browser-targets, the opt-in ruleset the owner named, set to
// check the major browsers as Vite targets them (card q-lint-compat-default-target), and untyped: every case reports
// without type information. eslint-plugin-compat reads a project's own browserslist from the linted file's folder up,
// so the cases in projects naming browsers write a package.json beside their files, which the case runner has no field
// for. While the rule's build waits on a card its cases are held unrun (ACCEPTED_CPT_HELD_CASES and
// ACCEPTED_CPT_HELD_CASES_IN_PROJECTS_NAMING_BROWSERS), each checked in the describe that runs it once the rule ships,
// since vitest fails a describe left with no test.

const ENGINES_TIMEOUT_MS = 120_000

const COMPAT_RULE = /^compat\//u

const PROJECT_MANIFEST_PATH = 'package.json'

function inFolder(folder: string, files: readonly CaseFile[]): CaseFile[] {
  return files.map((file) => ({ ...file, path: `${folder}/${file.path}` }))
}

describe('the compat rule accepted on 2026-10-24', () => {
  const { outcomesOfCase } = setUpRuleCaseOutcomes(catalog)

  it.each(ACCEPTED_COMPAT_CASES.map((ruleCase, index) => ({ ...ruleCase, title: ruleCaseTitleOf(ruleCase), folder: `accepted-cpt-${String(index)}` })))(
    '$title run as the catalog ships it, reports the API a major browser lacks and stays silent beside it, in ESLint',
    async ({ folder, ...ruleCase }) => {
      const { actual, expected } = await outcomesOfCase(folder, ruleCase)

      expect(actual).toStrictEqual(expected)
    },
    ENGINES_TIMEOUT_MS,
  )

  it('ships, and no other compat rule does, in browser-targets, in ESLint, checking the major browsers as Vite targets them, untyped, on every file, assigned by the owner on its card', () => {
    const expectedEntries = [...new Set(ACCEPTED_COMPAT_CASES.map(({ rule }) => rule))].map((rule) => {
      const accepted = ACCEPTED_ON_2026_10_24[rule]
      if (accepted === undefined) throw new Error(`${rule} is no rule the owner accepted on 2026-10-24`)
      return {
        id: rule,
        ruleset: 'browser-targets',
        engine: 'eslint',
        options: [MAJOR_BROWSERS_AS_VITE_TARGETS],
        typed: false,
        assignment: { confidence: 'high', note: accepted.card, by: 'owner-2026-10-24' },
      }
    })

    expect(canonicalRules.filter(({ id }) => COMPAT_RULE.test(id))).toStrictEqual(expectedEntries)
  })

  it('whose build waits on a card has its cases held unrun only while the rule is accepted and does not ship, each case naming the card its build waits on', () => {
    const shippedIds = new Set(canonicalRules.map(({ id }) => id))

    expect(heldCasesOutOfPlace(ACCEPTED_CPT_HELD_CASES, ACCEPTED_ON_2026_10_24, shippedIds)).toStrictEqual([])
  })
})

describe('the compat rule accepted on 2026-10-24, in a project whose package.json names its own browsers', () => {
  const projectDir = setUpTempDir('rule-data-accepted-cpt-')

  async function outcomesInAProjectNamingBrowsers(folder: string, { rule, projectManifest, silentIn, reportedIn }: CaseInAProjectNamingBrowsers) {
    const route = routeOf(rule, catalog)
    const silent = inFolder(folder, silentIn)
    const reported = inFolder(folder, reportedIn)
    await writeCaseFiles(projectDir(), [{ path: `${folder}/${PROJECT_MANIFEST_PATH}`, source: projectManifest }, ...silent, ...reported])
    const outcomes = await eslintOutcomesOf(projectDir(), eslintBlocksOf(route, shippedSettingsOf(route), catalog), [...silent, ...reported], { typed: route.typed })
    return {
      actual: Object.fromEntries(outcomes),
      expected: Object.fromEntries([
        ...silent.map(({ path }): [string, FileOutcome] => [path, 'silent']),
        ...reported.map(({ path }): [string, FileOutcome] => [path, 'reports']),
      ]),
    }
  }

  it.each(
    ACCEPTED_COMPAT_CASES_IN_PROJECTS_NAMING_BROWSERS.map((ruleCase, index) => ({ ...ruleCase, title: ruleCaseTitleOf(ruleCase), folder: `accepted-cpt-project-${String(index)}` })),
  )(
    '$title run as the catalog ships it, reports what its browsers or ours lack and stays silent beside it, in ESLint',
    async ({ folder, ...ruleCase }) => {
      const { actual, expected } = await outcomesInAProjectNamingBrowsers(folder, ruleCase)

      expect(actual).toStrictEqual(expected)
    },
    ENGINES_TIMEOUT_MS,
  )

  it('whose build waits on a card has its cases held unrun only while the rule is accepted and does not ship, each case naming the card its build waits on', () => {
    const shippedIds = new Set(canonicalRules.map(({ id }) => id))

    expect(heldCasesOutOfPlace(ACCEPTED_CPT_HELD_CASES_IN_PROJECTS_NAMING_BROWSERS, ACCEPTED_ON_2026_10_24, shippedIds)).toStrictEqual([])
  })
})
