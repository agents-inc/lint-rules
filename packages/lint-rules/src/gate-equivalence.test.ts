import { isDeepStrictEqual } from 'node:util'
import { catalog, routeOf } from '@workspace/rule-data'
import type { Linter } from 'eslint'
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
import { isLeftToARuleKeptToSomeFiles, shippedOptionsWithout } from './__tests__/shipped-allowances.ts'
import { isCoveredByAShippedRule, isCoveredInOxlintByAShippedRule } from './__tests__/shipped-covers.ts'
import { defineLintRules } from './index.ts'

// With every ruleset listed in the agent set, the agent build's two configs must run the canonical
// list: each rule once, on its routed engine, with its shipped options less each options entry it leaves to
// a rule run on some files alone; blocks of their own restate it with that entry in the files of that rule.
// allowSuppressions decides the suppression rules whatever is listed, so they are stated here per setting;
// where it bans them, a block of its own gives ban-ts-comment its setting in test files.
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
const TEST_FILE_BAN_BLOCK = 'agents-inc/test-files/@typescript-eslint/ban-ts-comment'
const IN_TEST_FILES_WHILE_BANNED = [onItsEngine('@typescript-eslint/ban-ts-comment', [BAN_TS_COMMENTS_BUT_A_DESCRIBED_EXPECT_ERROR])]

const OPTIONS_IN_FILES_BLOCK = 'agents-inc/options-in-files/'
const FLOATING_PROMISES = '@typescript-eslint/no-floating-promises'
const AWAIT_ASYNC_UTILS = 'testing-library/await-async-utils'
const AWAIT_ASYNC_QUERIES = 'testing-library/await-async-queries'
const AWAIT_ASYNC_EVENTS = 'testing-library/await-async-events'

// no-floating-promises leaves entries to three Testing Library rules run in test and story files alone, of which
// await-async-events skips story files. A block for each set of them keeps the entries left to the set in the
// files every rule of it runs on, the set of all three last. The other two may come in either order: any file both
// reach takes the block of all three after them.
const IN_THE_FILES_OF_TESTING_LIBRARY_RULES = [
  floatingPromisesKeepingTheEntriesLeftTo([AWAIT_ASYNC_EVENTS]),
  floatingPromisesKeepingTheEntriesLeftTo([AWAIT_ASYNC_UTILS, AWAIT_ASYNC_QUERIES]),
  floatingPromisesKeepingTheEntriesLeftTo([AWAIT_ASYNC_UTILS, AWAIT_ASYNC_QUERIES, AWAIT_ASYNC_EVENTS]),
]

/**
 * Every shipped rule allowSuppressions does not decide, on its routed engine with its shipped options less each
 * entry it leaves to a rule run on some files alone, except each one another rule covers, in both engines or, as
 * the agent build always runs oxlint, in oxlint.
 */
function shippedRulesBesidesTheSuppressionRules(): RuleOnEngine[] {
  return catalog.rules
    .values()
    .filter((rule) => rule.shipped !== null && !SUPPRESSION_RULE_IDS.has(rule.id) && !isCoveredByAShippedRule(rule) && !isCoveredInOxlintByAShippedRule(rule))
    .map((rule) => ({ id: rule.id, engine: rule.engine, options: shippedOptionsWithout(rule, isLeftToARuleKeptToSomeFiles) }))
    .toArray()
}

/** Its shipped options less the entries left to the rules run on some files alone, but those left to the rules given. */
function floatingPromisesKeepingTheEntriesLeftTo(rulesRunHere: readonly string[]): RuleOnEngine {
  return onItsEngine(FLOATING_PROMISES, shippedOptionsWithout(routeOf(FLOATING_PROMISES, catalog), (allowance) => isLeftToARuleKeptToSomeFiles(allowance) && !rulesRunHere.includes(allowance.rule)))
}

/** The rules in the order the list gives the same rules, so comparing them with the list asks nothing of the order they came in. */
function inTheOrderOf(list: readonly RuleOnEngine[], rules: readonly RuleOnEngine[]): RuleOnEngine[] {
  return rules.toSorted((rule, other) => positionIn(list, rule) - positionIn(list, other))
}

function positionIn(list: readonly RuleOnEngine[], rule: RuleOnEngine): number {
  return list.findIndex((listed) => isDeepStrictEqual(listed, rule))
}

function isBlockOfOptionsInFiles({ name }: Readonly<Linter.Config>): boolean {
  return name?.startsWith(OPTIONS_IN_FILES_BLOCK) === true
}

/** The blocks that restate a rule in some files, with other options than the rest of the config gives it. */
function isBlockOfItsOwn(block: Readonly<Linter.Config>): boolean {
  return block.name === TEST_FILE_BAN_BLOCK || isBlockOfOptionsInFiles(block)
}

describe.each([
  {
    config: 'every ruleset listed, nothing overridden, suppressions banned as by default',
    lintRules: buildEveryRulesetLintRules(EMPTY_TSCONFIG_ROOT_DIR),
    expected: sortedById([...shippedRulesBesidesTheSuppressionRules(), ...SUPPRESSION_RULES_BANNED]),
    inTestFiles: IN_TEST_FILES_WHILE_BANNED,
    inFilesOfSomeRules: IN_THE_FILES_OF_TESTING_LIBRARY_RULES,
  },
  {
    config: 'every ruleset listed, nothing overridden, allowSuppressions: true',
    lintRules: buildEveryRulesetLintRules(EMPTY_TSCONFIG_ROOT_DIR, { allowSuppressions: true }),
    expected: sortedById([...shippedRulesBesidesTheSuppressionRules(), ...SUPPRESSION_RULES_ALLOWED]),
    inTestFiles: [],
    inFilesOfSomeRules: IN_THE_FILES_OF_TESTING_LIBRARY_RULES,
  },
  {
    config: 'every ruleset listed in the agent set and none in the editor set, nothing overridden',
    lintRules: buildConsumerLintRules(EMPTY_TSCONFIG_ROOT_DIR, { agentRulesets: EVERY_RULESET }),
    expected: sortedById([...shippedRulesBesidesTheSuppressionRules(), ...SUPPRESSION_RULES_BANNED]),
    inTestFiles: IN_TEST_FILES_WHILE_BANNED,
    inFilesOfSomeRules: IN_THE_FILES_OF_TESTING_LIBRARY_RULES,
  },
  // The agent build reads the agent set only.
  {
    config: 'every ruleset listed in the editor set and none in the agent set, nothing overridden',
    lintRules: buildConsumerLintRules(EMPTY_TSCONFIG_ROOT_DIR, { editorRulesets: EVERY_RULESET }),
    expected: sortedById(SUPPRESSION_RULES_BANNED),
    inTestFiles: IN_TEST_FILES_WHILE_BANNED,
    inFilesOfSomeRules: [],
  },
  {
    config: 'no ruleset listed, nothing overridden, suppressions banned as by default',
    lintRules: buildConsumerLintRules(EMPTY_TSCONFIG_ROOT_DIR, {}),
    expected: sortedById(SUPPRESSION_RULES_BANNED),
    inTestFiles: IN_TEST_FILES_WHILE_BANNED,
    inFilesOfSomeRules: [],
  },
  {
    config: 'no ruleset listed, nothing overridden, allowSuppressions: true',
    lintRules: buildConsumerLintRules(EMPTY_TSCONFIG_ROOT_DIR, {}, { allowSuppressions: true }),
    expected: sortedById(SUPPRESSION_RULES_ALLOWED),
    inTestFiles: [],
    inFilesOfSomeRules: [],
  },
])('$config', ({ lintRules, expected, inTestFiles, inFilesOfSomeRules }) => {
  const agentConfigs = agentConfigsOf(defineLintRules(lintRules))
  const onInOxlint = uniqueById(rulesOnInOxlint(agentConfigs.oxlint))
  const onInEslint = uniqueById(rulesOnInEslint(agentConfigs.eslint.filter((block) => !isBlockOfItsOwn(block))))
  const restatedInFilesOfSomeRules = rulesOnInEslint(agentConfigs.eslint.filter(isBlockOfOptionsInFiles))

  it('runs exactly these rules, each on its routed engine, with its options', () => {
    expect(uniqueById([...onInOxlint, ...onInEslint])).toStrictEqual(expected)
  })

  it('runs only ban-ts-comment in the block of its own for test files, as suppressions are set', () => {
    expect(rulesOnInEslint(agentConfigs.eslint.filter(({ name }) => name === TEST_FILE_BAN_BLOCK))).toStrictEqual(inTestFiles)
  })

  it('restates only no-floating-promises in the blocks of its own for the files of some rules, keeping the entries left to them', () => {
    expect(inTheOrderOf(inFilesOfSomeRules, restatedInFilesOfSomeRules)).toStrictEqual(inFilesOfSomeRules)
  })

  it('restates it last keeping the entries left to all of those rules, so the files they all run on keep every entry', () => {
    expect(restatedInFilesOfSomeRules.at(-1)).toStrictEqual(inFilesOfSomeRules.at(-1))
  })

  it('runs no rule in both engines', () => {
    const eslintIds = new Set(onInEslint.map((rule) => rule.id))

    expect(onInOxlint.filter((rule) => eslintIds.has(rule.id)).map((rule) => rule.id)).toStrictEqual([])
  })
})
