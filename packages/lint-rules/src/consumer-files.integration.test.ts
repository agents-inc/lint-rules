import { fileURLToPath } from 'node:url'
import { catalog } from '@workspace/rule-data'
import { describe, expect, it } from 'vitest'
import { setUpEngineRun } from './__tests__/engine-run.ts'
import { buildEveryRulesetLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildTsconfig } from './__tests__/factories/tsconfig-factories.ts'
import { defineLintRules } from './index.ts'

// test-fixtures/consumer-files holds the agents-inc.lint.mts, oxlint.config.mts and eslint.config.mjs
// a consumer writes, and in src/ a copy of each under another name, a floating promise and a
// debugger statement. Each suite writes the tsconfig.json beside them. Linted here by the agent build.
const CONSUMER_FILES_DIR = fileURLToPath(new URL('../test-fixtures/consumer-files', import.meta.url))

const FILES_WE_HAVE_A_CONSUMER_WRITE = ['agents-inc.lint.mts', 'oxlint.config.mts', 'eslint.config.mjs']
const TS_FILES_WE_HAVE_A_CONSUMER_WRITE = ['agents-inc.lint.mts', 'oxlint.config.mts']
const SAME_TEXT_UNDER_ANOTHER_NAME = 'src/copy-of-agents-inc-lint.ts'

// Each copy, under a name no ignores list, draws the findings the ignores keep off its template.
const TEMPLATE_COPIES = [
  { template: 'agents-inc.lint.mts', copy: SAME_TEXT_UNDER_ANOTHER_NAME, rules: ['perfectionist/sort-objects'] },
  { template: 'eslint.config.mjs', copy: 'src/copy-of-eslint-config.mjs', rules: ['unicorn/no-top-level-side-effects'] },
  { template: 'oxlint.config.mts', copy: 'src/copy-of-oxlint-config.mts', rules: ['unicorn/no-top-level-side-effects'] },
]
const FLOATING_PROMISE_IN_SRC = 'src/floating-promise.ts'
const TSCONFIG_FILE = 'tsconfig.json'

// Both flagged plan.md's own text in the real run: `export default …(…)` is a top-level side
// effect, and the config's keys are in the order plan.md explains them rather than sorted.
const RULES_THE_TEMPLATES_BREAK = ['perfectionist/sort-objects', 'unicorn/no-top-level-side-effects']
const A_TYPED_RULE = '@typescript-eslint/no-floating-promises'

// The consumer files get no project service, so neither shape can make them a fatal parse error:
// one leaves them out of the project, and the other takes them in.
const TSCONFIGS = [
  { includes: 'only src/', tsconfig: buildTsconfig({ include: ['src'] }) },
  { includes: 'every TS file, as TypeScript does with no include', tsconfig: buildTsconfig() },
]

function isTypedRule(ruleId: string): boolean {
  const route = catalog.rules.get(ruleId)
  if (route === undefined) throw new Error(`${ruleId} is not in the catalog`)
  return route.typed
}

describe.each(TSCONFIGS)('the files a consumer writes for us, beside a tsconfig that includes $includes', ({ tsconfig }) => {
  const consumerProject = setUpEngineRun(
    CONSUMER_FILES_DIR,
    (projectDir) => defineLintRules(buildEveryRulesetLintRules(projectDir)),
    { [TSCONFIG_FILE]: JSON.stringify(tsconfig) },
  )

  /** The template rules reported on the file, once each; a parse error, whose rule ID is null, as null. */
  function parseErrorsAndTemplateRulesReportedOn(file: string): (string | null)[] {
    const reported = consumerProject.eslintRuleIdsOn(file)
    return [...new Set(reported.filter((id) => id === null || RULES_THE_TEMPLATES_BREAK.includes(id)))].toSorted()
  }

  function untypedRulesRunOn(file: string): string[] {
    return consumerProject.eslintRulesRunOn(file).filter((id) => !isTypedRule(id))
  }

  // A parse error stops every rule, so a file that fails to parse would pass vacuously without it.
  it.each(FILES_WE_HAVE_A_CONSUMER_WRITE)(
    'leave %s free of parse errors and of the findings its plan.md text drew',
    (file) => {
      expect(parseErrorsAndTemplateRulesReportedOn(file)).toStrictEqual([])
    },
  )

  it.each(TEMPLATE_COPIES)('still report the findings of $template on the same text in another file', ({ copy, rules }) => {
    expect(parseErrorsAndTemplateRulesReportedOn(copy)).toStrictEqual(rules)
  })

  it('raise no fatal error on any file', () => {
    expect(consumerProject.eslintFatalMessages()).toStrictEqual([])
  })

  it.each(TS_FILES_WE_HAVE_A_CONSUMER_WRITE)(
    'run on %s every untyped rule the same text gets in src/, but the two whose ignores name it',
    (file) => {
      const runOnTheFile = untypedRulesRunOn(file)

      expect(untypedRulesRunOn(SAME_TEXT_UNDER_ANOTHER_NAME).filter((id) => !runOnTheFile.includes(id))).toStrictEqual(
        RULES_THE_TEMPLATES_BREAK,
      )
    },
  )

  it.each(TS_FILES_WE_HAVE_A_CONSUMER_WRITE)('run no typed rule on %s, which gets no project service', (file) => {
    expect(consumerProject.eslintRulesRunOn(file).filter(isTypedRule)).toStrictEqual([])
  })

  it('fire a typed rule on a file in src/, which the project service parses', () => {
    expect(consumerProject.eslintRuleIdsOn(FLOATING_PROMISE_IN_SRC)).toContain(A_TYPED_RULE)
  })

  it('are loaded by oxlint beside them: exits 0 or 1 and prints a JSON report', () => {
    expect([0, 1]).toContain(consumerProject.oxlintLint().exitCode)
    expect(() => consumerProject.oxlintReport()).not.toThrow()
  })
})
