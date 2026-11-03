import { catalog } from '@workspace/rule-data'
import type { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import { agentConfigsOf } from './__tests__/agent-configs.ts'
import { severityOfCalculatedEntry } from './__tests__/calculated-rule-severity.ts'
import {
  FILES_JUDGED,
  PLAYWRIGHT_RULE_NOT_ACCEPTED,
  PLAYWRIGHT_RULES_SHIPPED_OFF,
  PLAYWRIGHT_TESTS,
  RULE_RECOMMENDED_NOT_ACCEPTED,
  RULES_SHIPPED_OFF,
} from './__tests__/cases/rules-shipped-off.ts'
import { unshippedRuleRefusal } from './__tests__/cases/rules-we-do-not-ship.ts'
import { ourEditorEslintPartMergedInto } from './__tests__/editor-merges-read-by-eslint.ts'
import { NOT_LINTED, setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import { buildConsumerLintRules, emptyTsconfigRootDir, EVERY_RULESET } from './__tests__/factories/lint-rules-factories.ts'
import { defineLintRules, type LintRules } from './index.ts'

const oracle = setUpEslintConfigOracle()

type FileKind = keyof typeof FILES_JUDGED

/** Each rule's severity in each kind of file, in check's ESLint config and in the editor's: unset is off. */
type SeverityByFile = Readonly<Record<FileKind, Linter.StringSeverity>>
type Severities = Readonly<Record<string, { readonly check: SeverityByFile; readonly editor: SeverityByFile }>>

const EVERY_RULESET_IN_BOTH_SETS = { agentRulesets: EVERY_RULESET, editorRulesets: EVERY_RULESET }

function everyRulesetListedNamingNone(): LintRules {
  return buildConsumerLintRules(emptyTsconfigRootDir(), EVERY_RULESET_IN_BOTH_SETS)
}

/** The Playwright rules turned on for the Playwright tests, as the example init writes does, and the others everywhere. */
function everyRulesetListedNamingEach(): LintRules {
  return buildConsumerLintRules(emptyTsconfigRootDir(), EVERY_RULESET_IN_BOTH_SETS, {
    rules: Object.fromEntries(RULES_SHIPPED_OFF.filter((id) => !isPlaywrightRule(id)).map((id) => [id, 'error'] as const)),
    fileOverrides: [{ files: PLAYWRIGHT_TESTS, rules: Object.fromEntries(PLAYWRIGHT_RULES_SHIPPED_OFF.map((id) => [id, 'error'] as const)) }],
  })
}

async function severitiesIn(lintRules: LintRules): Promise<Severities> {
  const check = await severitiesByRuleIn(agentConfigsOf(defineLintRules(lintRules)).eslint)
  const editor = await severitiesByRuleIn(ourEditorEslintPartMergedInto([], lintRules))
  return Object.fromEntries(RULES_SHIPPED_OFF.map((id) => [id, { check: check(id), editor: editor(id) }]))
}

/** ESLint calculates each judged file once per config: one calculation per rule outlasts the timeout under a full run. */
async function severitiesByRuleIn(config: readonly Linter.Config[]): Promise<(id: string) => SeverityByFile> {
  const rulesByFile = await oracle.calculatedRulesOfEach(config, Object.values(FILES_JUDGED))
  function severityIn(kind: FileKind, id: string): Linter.StringSeverity {
    const rules = rulesByFile[FILES_JUDGED[kind]]
    if (rules === undefined || rules === NOT_LINTED) throw new Error(`ESLint does not lint ${FILES_JUDGED[kind]}`)
    // A rule no block sets does not run, which is what off means.
    return severityOfCalculatedEntry(rules[id]) ?? 'off'
  }
  return (id) => ({ playwrightTest: severityIn('playwrightTest', id), unitTest: severityIn('unitTest', id), source: severityIn('source', id) })
}

function severitiesExpected(severityOf: (id: string, kind: FileKind) => Linter.StringSeverity): Severities {
  return Object.fromEntries(
    RULES_SHIPPED_OFF.map((id) => {
      const byFile: SeverityByFile = { playwrightTest: severityOf(id, 'playwrightTest'), unitTest: severityOf(id, 'unitTest'), source: severityOf(id, 'source') }
      return [id, { check: byFile, editor: byFile }]
    }),
  )
}

const PLAYWRIGHT_RULES: ReadonlySet<string> = new Set(PLAYWRIGHT_RULES_SHIPPED_OFF)

function isPlaywrightRule(id: string): boolean {
  return PLAYWRIGHT_RULES.has(id)
}

// A rule renamed or rerouted upstream would turn a test below red for that reason; this names it first.
describe('the rules this file names', () => {
  it('are each a RuleId run by ESLint, the two controls ones we do not ship', () => {
    const routes = [...RULES_SHIPPED_OFF, PLAYWRIGHT_RULE_NOT_ACCEPTED, RULE_RECOMMENDED_NOT_ACCEPTED].map((id) => {
      const route = catalog.rules.get(id)
      return route === undefined ? { id, route: 'none' } : { id, engine: route.engine }
    })

    expect(routes).toStrictEqual([
      ...[...RULES_SHIPPED_OFF, PLAYWRIGHT_RULE_NOT_ACCEPTED].map((id) => ({ id, engine: 'eslint' })),
      { id: RULE_RECOMMENDED_NOT_ACCEPTED, engine: 'oxlint' },
    ])
  })
})

describe('a rule we ship off by default, named in agents-inc.lint.mts', () => {
  it.each(RULES_SHIPPED_OFF.map((id) => ({ id })))('is accepted in the top-level rules: $id', ({ id }) => {
    const lintRules = buildConsumerLintRules(emptyTsconfigRootDir(), {}, { rules: { [id]: 'error' } })

    expect(() => defineLintRules(lintRules)).not.toThrow()
  })

  it.each(RULES_SHIPPED_OFF.map((id) => ({ id })))('is accepted in the rules of a file override: $id', ({ id }) => {
    const lintRules = buildConsumerLintRules(emptyTsconfigRootDir(), {}, { fileOverrides: [{ files: PLAYWRIGHT_TESTS, rules: { [id]: 'error' } }] })

    expect(() => defineLintRules(lintRules)).not.toThrow()
  })
})

describe('a rule we do not ship, beside them', () => {
  it('is refused where nobody accepted it, a Playwright rule among them', () => {
    const lintRules = buildConsumerLintRules(emptyTsconfigRootDir(), {}, { fileOverrides: [{ files: PLAYWRIGHT_TESTS, rules: { [PLAYWRIGHT_RULE_NOT_ACCEPTED]: 'error' } }] })

    expect(() => defineLintRules(lintRules)).toThrow(new Error(unshippedRuleRefusal('fileOverrides[0].rules', PLAYWRIGHT_RULE_NOT_ACCEPTED)))
  })

  it('is refused where a sweep recommended it and the owner has not accepted it', () => {
    const lintRules = buildConsumerLintRules(emptyTsconfigRootDir(), {}, { rules: { [RULE_RECOMMENDED_NOT_ACCEPTED]: 'error' } })

    expect(() => defineLintRules(lintRules)).toThrow(new Error(unshippedRuleRefusal('rules', RULE_RECOMMENDED_NOT_ACCEPTED)))
  })
})

describe('where a rule we ship off by default runs, as ESLint calculates it for a Playwright test, a Vitest test and a source file', () => {
  it('runs in none of them, in check or in the editor, where every ruleset is listed in both sets and no rule is named', async () => {
    expect(await severitiesIn(everyRulesetListedNamingNone())).toStrictEqual(severitiesExpected(() => 'off'))
  })

  it('runs where a team names it, in check and in the editor alike: a Playwright rule in the Playwright tests its file override names alone, any other its top-level rules name in every file', async () => {
    expect(await severitiesIn(everyRulesetListedNamingEach())).toStrictEqual(
      severitiesExpected((id, kind) => (kind !== 'playwrightTest' && isPlaywrightRule(id) ? 'off' : 'error')),
    )
  })
})
