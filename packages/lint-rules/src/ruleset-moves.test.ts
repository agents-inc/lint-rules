import { describe, expect, it } from 'vitest'
import { agentConfigsOf } from './__tests__/agent-configs.ts'
import { RULESET_MOVES, RULESET_STAYS, STOPPED_SHIPPING } from './__tests__/cases/ruleset-moves.ts'
import { unshippedRuleRefusal } from './__tests__/cases/rules-we-do-not-ship.ts'
import { buildConsumerLintRules, emptyTsconfigRootDir, EVERY_RULESET } from './__tests__/factories/lint-rules-factories.ts'
import { rulesOnInEslint, rulesOnInOxlint } from './__tests__/rules-on-engines.ts'
import { defineLintRules, type LintRules } from './index.ts'

type Rulesets = Partial<LintRules['agentRulesets']>

const STILL_SHIPPED_FROM_THE_SAME_RULESET = 'unicorn/prefer-add-event-listener'

/** In the agent build check makes, with these rulesets alone listed in both sets. */
function isOnWhereListed(rule: string, rulesets: Rulesets): boolean {
  const { oxlint, eslint } = agentConfigsOf(defineLintRules(buildConsumerLintRules(emptyTsconfigRootDir(), { agentRulesets: rulesets, editorRulesets: rulesets })))
  return [...rulesOnInOxlint(oxlint), ...rulesOnInEslint(eslint)].some(({ id }) => id === rule)
}

function namingItIn(rule: string): () => unknown {
  return () => defineLintRules(buildConsumerLintRules(emptyTsconfigRootDir(), {}, { rules: { [rule]: 'error' } }))
}

describe('a rule the owner moved to another ruleset', () => {
  it.each(RULESET_MOVES)('$rule runs where its new ruleset is listed, and not where only its old one is', ({ rule, from, to }) => {
    expect({ whereItsNewRulesetIsListed: isOnWhereListed(rule, to), whereOnlyItsOldOneIs: isOnWhereListed(rule, from) }).toStrictEqual({
      whereItsNewRulesetIsListed: true,
      whereOnlyItsOldOneIs: false,
    })
  })
})

describe('a rule the owner left in its ruleset', () => {
  it.each(RULESET_STAYS)('$rule runs where its ruleset is listed, and not where none is', ({ rule, in: rulesets }) => {
    expect({ whereItsRulesetIsListed: isOnWhereListed(rule, rulesets), whereNoneIs: isOnWhereListed(rule, {}) }).toStrictEqual({
      whereItsRulesetIsListed: true,
      whereNoneIs: false,
    })
  })
})

describe('a rule the owner stopped shipping', () => {
  it.each(STOPPED_SHIPPING)('%s runs nowhere, whatever rulesets are listed', (rule) => {
    expect(isOnWhereListed(rule, EVERY_RULESET)).toBe(false)
  })

  it.each(STOPPED_SHIPPING)('%s is refused when named in the rules of agents-inc.lint.mts, as any rule we do not ship', (rule) => {
    expect(namingItIn(rule)).toThrow(new Error(unshippedRuleRefusal('rules', rule)))
  })

  it('leaves a rule we still ship accepted when named there, one the owner moved out of the same ruleset', () => {
    expect(namingItIn(STILL_SHIPPED_FROM_THE_SAME_RULESET)).not.toThrow()
  })
})
