import { describe, expect, it } from 'vitest'

import {
  CHANGED_SETTING_CASES,
  DUPLICATES_LEFT_TO_THE_SPECIFIC_RULE,
  MOVED_OR_ADDED_CASES,
  SUPPRESSION_AND_RENAMED_CASES,
} from './__tests__/cases/changed-settings.ts'
import { STAND_IN_CASES } from './__tests__/cases/stand-ins.ts'
import { ruleCaseTitleOf, setUpRuleCaseOutcomes } from './__tests__/rule-case-outcomes.ts'
import { catalog } from './catalog.ts'

// Each changed rule runs as it ships, through the real engines: silent where the change allows the code,
// still reporting beside it. A rule oxlint runs is run in ESLint too, which runs it without oxlint.

const ENGINES_TIMEOUT_MS = 120_000

describe('the rules whose settings, engine or ruleset the owner changed, run as the catalog ships them', () => {
  const { outcomesOfCase, outcomesOfStandInCase } = setUpRuleCaseOutcomes(catalog)

  describe('a rule whose options or files changed', () => {
    it.each(CHANGED_SETTING_CASES.map((ruleCase, index) => ({ ...ruleCase, title: ruleCaseTitleOf(ruleCase), folder: `changed-${String(index)}` })))(
      '$title stays silent on the code the change allows, and still reports the code beside it, on each engine that may run it',
      async ({ folder, ...ruleCase }) => {
        const { actual, expected } = await outcomesOfCase(folder, ruleCase)

        expect(actual).toStrictEqual(expected)
      },
      ENGINES_TIMEOUT_MS,
    )
  })

  // no-deprecated leaves a legacy API to a more specific rule, so that rule's is the one report left.
  describe('a legacy API no-deprecated leaves to a more specific rule', () => {
    it.each(DUPLICATES_LEFT_TO_THE_SPECIFIC_RULE.map((ruleCase, index) => ({ ...ruleCase, folder: `duplicates-${String(index)}` })))(
      '$rule still reports each one',
      async ({ folder, ...ruleCase }) => {
        const { actual, expected } = await outcomesOfCase(folder, ruleCase)

        expect(actual).toStrictEqual(expected)
      },
      ENGINES_TIMEOUT_MS,
    )
  })

  describe('a rule moved to ESLint or newly shipped', () => {
    it.each(MOVED_OR_ADDED_CASES.map((ruleCase, index) => ({ ...ruleCase, folder: `moved-${String(index)}` })))(
      '$rule fires on its code in ESLint, and stays silent beside it',
      async ({ folder, ...ruleCase }) => {
        const { actual, expected } = await outcomesOfCase(folder, ruleCase)

        expect(actual).toStrictEqual(expected)
      },
      ENGINES_TIMEOUT_MS,
    )
  })

  describe('the blanket-suppression rule and the rules ESLint and oxlint name differently, on oxlint', () => {
    it.each(SUPPRESSION_AND_RENAMED_CASES.map((ruleCase, index) => ({ ...ruleCase, folder: `suppression-${String(index)}` })))(
      '$rule reports in oxlint exactly where the case says',
      async ({ folder, ...ruleCase }) => {
        const { actual, expected } = await outcomesOfCase(folder, ruleCase)

        expect(actual).toStrictEqual(expected)
      },
      ENGINES_TIMEOUT_MS,
    )
  })

  // Without oxlint, ESLint states a stand-in for each of these: it must report, and leave, the code
  // oxlint's rule does.
  describe('an oxlint rule ESLint has no version of, and its ESLint stand-in', () => {
    it.each(STAND_IN_CASES.map((standInCase, index) => ({ ...standInCase, folder: `stand-in-${String(index)}` })))(
      '$oxlintRule in oxlint and its stand-in in ESLint report the same code, and leave the same code',
      async ({ folder, ...standInCase }) => {
        const { actual, expected } = await outcomesOfStandInCase(folder, standInCase)

        expect(actual).toStrictEqual(expected)
      },
      ENGINES_TIMEOUT_MS,
    )
  })
})
