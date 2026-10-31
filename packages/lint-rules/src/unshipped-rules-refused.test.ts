import { catalog } from '@workspace/rule-data'
import { describe, expect, it } from 'vitest'
import { agentConfigsOf } from './__tests__/agent-configs.ts'
import {
  ENTRY_GLOBS,
  NO_RULE_IN_THE_CATALOG,
  SHIPPED_RUN_BY_ESLINT,
  SHIPPED_RUN_BY_OXLINT,
  UNSHIPPED_RUN_BY_ESLINT,
  UNSHIPPED_RUN_BY_OXLINT,
  unshippedRuleRefusal,
} from './__tests__/cases/rules-we-do-not-ship.ts'
import { buildConsumerLintRules, emptyTsconfigRootDir } from './__tests__/factories/lint-rules-factories.ts'
import { defineLintRules } from './index.ts'

// Owner, q-lint-unshipped-rules-channel: our rules list accepts only rules we ship; naming any other rule there stops
// with a message pointing to the team's own ESLint or oxlint config. Any setting counts as naming it, off included.

type RouteHeld = { readonly id: string; readonly engine: 'oxlint' | 'eslint'; readonly shipped: boolean } | { readonly id: string; readonly route: 'none' }

function routeHeldFor(id: string): RouteHeld {
  const route = catalog.rules.get(id)
  return route === undefined ? { id, route: 'none' } : { id, engine: route.engine, shipped: route.shipped !== null }
}

/** Each ESLint block's setting of the rule, in the agent build check makes. */
function eslintSettingsOf(id: string, defined: ReturnType<typeof defineLintRules>): unknown[] {
  return agentConfigsOf(defined).eslint.flatMap(({ rules }) => (rules !== undefined && Object.hasOwn(rules, id) ? [rules[id]] : []))
}

// A rule shipped later would turn a refusal below into an accepted rule; this names that cause first.
describe('the rules this file names', () => {
  it('are two we do not ship, one per engine, two we ship, one per engine, and one name the catalog has no route for', () => {
    expect([UNSHIPPED_RUN_BY_OXLINT, UNSHIPPED_RUN_BY_ESLINT, SHIPPED_RUN_BY_OXLINT, SHIPPED_RUN_BY_ESLINT, NO_RULE_IN_THE_CATALOG].map(routeHeldFor)).toStrictEqual([
      { id: 'no-console', engine: 'oxlint', shipped: false },
      { id: 'functional/no-loop-statements', engine: 'eslint', shipped: false },
      { id: 'no-debugger', engine: 'oxlint', shipped: true },
      { id: 'eqeqeq', engine: 'eslint', shipped: true },
      { id: 'not-a/rule', route: 'none' },
    ])
  })
})

describe('a rule we do not ship, named in the top-level rules of agents-inc.lint.mts', () => {
  it('is refused where oxlint has a version of it, naming the file, the key and the rule, and pointing to the team\'s own configs', () => {
    const lintRules = buildConsumerLintRules(emptyTsconfigRootDir(), {}, { rules: { [UNSHIPPED_RUN_BY_OXLINT]: 'error' } })

    expect(() => defineLintRules(lintRules)).toThrow(new Error(unshippedRuleRefusal('rules', UNSHIPPED_RUN_BY_OXLINT)))
  })

  it('is refused where ESLint alone runs it', () => {
    const lintRules = buildConsumerLintRules(emptyTsconfigRootDir(), {}, { rules: { [UNSHIPPED_RUN_BY_ESLINT]: 'warn' } })

    expect(() => defineLintRules(lintRules)).toThrow(new Error(unshippedRuleRefusal('rules', UNSHIPPED_RUN_BY_ESLINT)))
  })

  it('is refused set off: naming it is what stops, whatever it is set to', () => {
    const lintRules = buildConsumerLintRules(emptyTsconfigRootDir(), {}, { rules: { [UNSHIPPED_RUN_BY_OXLINT]: 'off' } })

    expect(() => defineLintRules(lintRules)).toThrow(new Error(unshippedRuleRefusal('rules', UNSHIPPED_RUN_BY_OXLINT)))
  })

  it('is refused with options after its severity', () => {
    const lintRules = buildConsumerLintRules(emptyTsconfigRootDir(), {}, { rules: { [UNSHIPPED_RUN_BY_OXLINT]: ['error', { allow: ['warn'] }] } })

    expect(() => defineLintRules(lintRules)).toThrow(new Error(unshippedRuleRefusal('rules', UNSHIPPED_RUN_BY_OXLINT)))
  })

  it('is refused after a rule we ship, named first', () => {
    const lintRules = buildConsumerLintRules(emptyTsconfigRootDir(), {}, { rules: { [SHIPPED_RUN_BY_OXLINT]: 'error', [UNSHIPPED_RUN_BY_ESLINT]: 'error' } })

    expect(() => defineLintRules(lintRules)).toThrow(new Error(unshippedRuleRefusal('rules', UNSHIPPED_RUN_BY_ESLINT)))
  })
})

describe('a rule we do not ship, named in the rules of a file override', () => {
  it('is refused, naming the entry by its place in fileOverrides', () => {
    const lintRules = buildConsumerLintRules(emptyTsconfigRootDir(), {}, { fileOverrides: [{ files: ENTRY_GLOBS, rules: { [UNSHIPPED_RUN_BY_OXLINT]: 'off' } }] })

    expect(() => defineLintRules(lintRules)).toThrow(new Error(unshippedRuleRefusal('fileOverrides[0].rules', UNSHIPPED_RUN_BY_OXLINT)))
  })

  it('is refused in the second entry, after an entry naming only a rule we ship', () => {
    const lintRules = buildConsumerLintRules(
      emptyTsconfigRootDir(),
      {},
      {
        fileOverrides: [
          { files: ENTRY_GLOBS, rules: { [SHIPPED_RUN_BY_ESLINT]: 'off' } },
          { files: ENTRY_GLOBS, rules: { [UNSHIPPED_RUN_BY_ESLINT]: 'error' } },
        ],
      },
    )

    expect(() => defineLintRules(lintRules)).toThrow(new Error(unshippedRuleRefusal('fileOverrides[1].rules', UNSHIPPED_RUN_BY_ESLINT)))
  })
})

describe('a rule we ship, named in the rules of agents-inc.lint.mts', () => {
  it('is accepted and run by oxlint where no listed ruleset has it', () => {
    const defined = defineLintRules(buildConsumerLintRules(emptyTsconfigRootDir(), {}, { rules: { [SHIPPED_RUN_BY_OXLINT]: 'error' } }))

    expect(agentConfigsOf(defined).oxlint.rules).toHaveProperty([SHIPPED_RUN_BY_OXLINT], ['error'])
  })

  it('is accepted and run by ESLint at the options given', () => {
    const defined = defineLintRules(buildConsumerLintRules(emptyTsconfigRootDir(), {}, { rules: { [SHIPPED_RUN_BY_ESLINT]: ['error', 'always'] } }))

    expect(eslintSettingsOf(SHIPPED_RUN_BY_ESLINT, defined)).toStrictEqual([['error', 'always']])
  })

  it('is accepted set off', () => {
    const lintRules = buildConsumerLintRules(emptyTsconfigRootDir(), {}, { rules: { [SHIPPED_RUN_BY_OXLINT]: 'off' } })

    expect(() => defineLintRules(lintRules)).not.toThrow()
  })

  it('is accepted in a file override', () => {
    const lintRules = buildConsumerLintRules(emptyTsconfigRootDir(), {}, { fileOverrides: [{ files: ENTRY_GLOBS, rules: { [SHIPPED_RUN_BY_ESLINT]: 'off' } }] })

    expect(() => defineLintRules(lintRules)).not.toThrow()
  })
})
