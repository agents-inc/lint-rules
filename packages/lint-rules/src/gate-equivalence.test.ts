import { catalog, type RuleRoute } from '@workspace/rule-data'
import { describe, expect, it } from 'vitest'
import { agentConfigsOf } from './__tests__/agent-configs.ts'
import {
  buildConsumerLintRules,
  buildEveryRulesetLintRules,
  EVERY_RULESET,
  EMPTY_TSCONFIG_ROOT_DIR,
} from './__tests__/factories/lint-rules-factories.ts'
import {
  onItsEngine,
  type RuleOnEngine,
  rulesOnInEslint,
  rulesOnInOxlint,
  sortedById,
  uniqueById,
} from './__tests__/rules-on-engines.ts'
import { defineLintRules } from './index.ts'

// With every ruleset listed in the agent set and nothing overridden, the agent build's two configs
// together must run the canonical list: each rule once, on its routed engine, with its shipped
// options. The agent build runs oxlint whatever the project's package.json lists.
//
// Owner, 2026-10-10: allowSuppressions decides three rules whatever rulesets are listed, and a
// fourth since 2026-10-14 (r2-d22), so they are stated here per setting rather than read from the
// canonical list.
const SUPPRESSION_RULE_IDS: ReadonlySet<string> = new Set([
  '@typescript-eslint/ban-ts-comment',
  'house/no-suppressions',
  'react-hooks/rule-suppression',
  'unicorn/no-abusive-eslint-disable',
])
const BAN_TS_COMMENTS_OUTRIGHT = { 'ts-expect-error': true, 'ts-ignore': true, 'ts-nocheck': true }
const BAN_TS_COMMENTS_BUT_A_DESCRIBED_EXPECT_ERROR = {
  'ts-expect-error': 'allow-with-description',
  'ts-ignore': true,
  'ts-nocheck': true,
}

// Two of the rules with banned suppressions, and three with suppressions allowed: ban-ts-comment runs
// either way, with different options.
const SUPPRESSION_RULES_BANNED = [
  onItsEngine('@typescript-eslint/ban-ts-comment', [BAN_TS_COMMENTS_OUTRIGHT]),
  onItsEngine('house/no-suppressions', []),
]
const SUPPRESSION_RULES_ALLOWED = [
  onItsEngine('@typescript-eslint/ban-ts-comment', [BAN_TS_COMMENTS_BUT_A_DESCRIBED_EXPECT_ERROR]),
  onItsEngine('react-hooks/rule-suppression', []),
  onItsEngine('unicorn/no-abusive-eslint-disable', []),
]

/**
 * Every shipped rule allowSuppressions does not decide, on its routed engine with its shipped
 * options, as every ruleset listed runs them: but each rule covered by another, which every ruleset
 * listed turns on (S; spec-core.md C2).
 */
function shippedRulesBesidesTheSuppressionRules(): RuleOnEngine[] {
  return [...catalog.rules.values()].flatMap((rule) =>
    rule.shipped === null || SUPPRESSION_RULE_IDS.has(rule.id) || isCoveredByAShippedRule(rule)
      ? []
      : [{ id: rule.id, engine: rule.engine, options: rule.shipped.options }],
  )
}

/** Whether the catalog records a shipped rule covering the rule: none before this round's data lands. */
function isCoveredByAShippedRule({ shipped }: RuleRoute): boolean {
  if (shipped === null || typeof shipped.coveredBy !== 'string') return false
  const cover = catalog.rules.get(shipped.coveredBy)
  if (cover === undefined) throw new Error(`${shipped.coveredBy}: a cover the catalog does not hold`)
  return cover.shipped !== null
}

describe.each([
  {
    config: 'every ruleset listed, nothing overridden, suppressions banned as by default',
    lintRules: buildEveryRulesetLintRules(EMPTY_TSCONFIG_ROOT_DIR),
    expected: sortedById([...shippedRulesBesidesTheSuppressionRules(), ...SUPPRESSION_RULES_BANNED]),
  },
  {
    config: 'every ruleset listed, nothing overridden, allowSuppressions: true',
    lintRules: buildEveryRulesetLintRules(EMPTY_TSCONFIG_ROOT_DIR, { allowSuppressions: true }),
    expected: sortedById([...shippedRulesBesidesTheSuppressionRules(), ...SUPPRESSION_RULES_ALLOWED]),
  },
  {
    config: 'every ruleset listed in the agent set and none in the editor set, nothing overridden',
    lintRules: buildConsumerLintRules(EMPTY_TSCONFIG_ROOT_DIR, { agentRulesets: EVERY_RULESET }),
    expected: sortedById([...shippedRulesBesidesTheSuppressionRules(), ...SUPPRESSION_RULES_BANNED]),
  },
  // The agent build reads the agent set only.
  {
    config: 'every ruleset listed in the editor set and none in the agent set, nothing overridden',
    lintRules: buildConsumerLintRules(EMPTY_TSCONFIG_ROOT_DIR, { editorRulesets: EVERY_RULESET }),
    expected: sortedById(SUPPRESSION_RULES_BANNED),
  },
  {
    config: 'no ruleset listed, nothing overridden, suppressions banned as by default',
    lintRules: buildConsumerLintRules(EMPTY_TSCONFIG_ROOT_DIR, {}),
    expected: sortedById(SUPPRESSION_RULES_BANNED),
  },
  {
    config: 'no ruleset listed, nothing overridden, allowSuppressions: true',
    lintRules: buildConsumerLintRules(EMPTY_TSCONFIG_ROOT_DIR, {}, { allowSuppressions: true }),
    expected: sortedById(SUPPRESSION_RULES_ALLOWED),
  },
])('$config', ({ lintRules, expected }) => {
  const agentConfigs = agentConfigsOf(defineLintRules(lintRules))
  const onInOxlint = uniqueById(rulesOnInOxlint(agentConfigs.oxlint))
  const onInEslint = uniqueById(rulesOnInEslint(agentConfigs.eslint))

  it('runs exactly these rules, each on its routed engine, with its options', () => {
    expect(uniqueById([...onInOxlint, ...onInEslint])).toStrictEqual(expected)
  })

  it('runs no rule in both engines', () => {
    const eslintIds = new Set(onInEslint.map((rule) => rule.id))

    expect(onInOxlint.filter((rule) => eslintIds.has(rule.id)).map((rule) => rule.id)).toStrictEqual([])
  })
})
