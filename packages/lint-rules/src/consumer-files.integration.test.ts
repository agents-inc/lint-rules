import { fileURLToPath } from 'node:url'
import { catalog } from '@workspace/rule-data'
import { describe, expect, it } from 'vitest'
import { fatalMessagesIn } from './__tests__/engine-clis.ts'
import { agentOxlintOf, ruleIdsOn, rulesRunOn, setUpEslintRunsInItsOwnProcess } from './__tests__/eslint-in-its-own-process.ts'
import { buildEveryRulesetLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildTsconfig } from './__tests__/factories/tsconfig-factories.ts'
import { INSTALLED_OXLINT } from './__tests__/temp-projects.ts'

// test-fixtures/consumer-files holds the agents-inc.lint.mts, oxlint.config.mts and eslint.config.mjs
// a consumer writes, and in src/ a copy of each under another name, a floating promise and a
// debugger statement. Each suite writes the tsconfig.json beside them. Linted here by the agent build,
// ESLint in a process of its own: typescript-eslint keeps one project service per process, set up by
// the first config it parses (spec-core.md C9).
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
// A .mts file the tsconfig of either shape takes in, as the project service parses it.
const MTS_FILE_IN_SRC = 'src/copy-of-oxlint-config.mts'
const TSCONFIG_FILE = 'tsconfig.json'

// Both flagged plan.md's own text in the real run: `export default …(…)` is a top-level side
// effect, and the config's keys are in the order plan.md explains them rather than sorted.
const RULES_THE_TEMPLATES_BREAK = ['perfectionist/sort-objects', 'unicorn/no-top-level-side-effects']
// Those two, and n/no-unpublished-import, which reported each file's import of our package in a
// package npm may publish (spec-answers2.md, item 4): each ships ignoring the three files. This
// fixture's package is private, so the third reports nothing in src/ either.
const RULES_WHOSE_IGNORES_NAME_THEM = ['n/no-unpublished-import', ...RULES_THE_TEMPLATES_BREAK]
const A_TYPED_RULE = '@typescript-eslint/no-floating-promises'

// typed-config-files (spec-core.md C9): the type information is ours here, so the consumer's TS
// files get the typed rules where the tsconfig takes them in, and neither shape may make them a
// fatal parse error. KNOWN GAP: where the tsconfig leaves them out of the project, they get no typed
// rule, though typed-config-files owes them the typed rules there too. typescript-eslint's default
// project, which gave them the rules, is set up once per process, and one process linting several
// projects then failed some with a fatal parse error (review option (a), Must Fix 1; see
// typed-config-files.integration.test.ts). Pinned with it.fails until the owner decides.
const TSCONFIGS = [
  { includes: 'only src/', tsconfig: buildTsconfig({ include: ['src'] }), takesInTheTwo: false },
  { includes: 'every TS file, as TypeScript does with no include', tsconfig: buildTsconfig(), takesInTheTwo: true },
]

function isTypedRule(ruleId: string): boolean {
  const route = catalog.rules.get(ruleId)
  if (route === undefined) throw new Error(`${ruleId} is not in the catalog`)
  return route.typed
}

describe.each(TSCONFIGS)('the files a consumer writes for us, beside a tsconfig that includes $includes', ({ tsconfig, takesInTheTwo }) => {
  const runs = setUpEslintRunsInItsOwnProcess({
    project: { fixturesDir: CONSUMER_FILES_DIR, files: { [TSCONFIG_FILE]: JSON.stringify(tsconfig) }, linkedPackages: [INSTALLED_OXLINT] },
    tsconfigRootDir: '.',
    lintRulesFor: (projectDir) => buildEveryRulesetLintRules(projectDir),
    // The fixture's package.json lists oxlint.
    teamOxlintConfig: {},
    runsTheAgentOxlintConfig: true,
  })
  // A run that failed before the suite throws in every other test here, which no it.fails hides.
  const itWhereTheTsconfigTakesThemIn = takesInTheTwo ? it : it.fails

  /** The template rules reported on the file, once each; a parse error, whose rule ID is null, as null. */
  function parseErrorsAndTemplateRulesReportedOn(file: string): (string | null)[] {
    const reported = ruleIdsOn(runs(), 'agent', file)
    return [...new Set(reported.filter((id) => id === null || RULES_THE_TEMPLATES_BREAK.includes(id)))].toSorted()
  }

  function untypedRulesRunOn(file: string): string[] {
    return rulesRunOn(runs(), 'agent', file).filter((id) => !isTypedRule(id))
  }

  function typedRulesRunOn(file: string): string[] {
    return rulesRunOn(runs(), 'agent', file).filter(isTypedRule)
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
    const { eslint, rootDir } = runs()

    expect(fatalMessagesIn(eslint.agent, rootDir)).toStrictEqual([])
  })

  it.each(TS_FILES_WE_HAVE_A_CONSUMER_WRITE)(
    'run on %s every untyped rule the same text gets in src/, but the three whose ignores name it',
    (file) => {
      const runOnTheFile = untypedRulesRunOn(file)

      expect(untypedRulesRunOn(SAME_TEXT_UNDER_ANOTHER_NAME).filter((id) => !runOnTheFile.includes(id))).toStrictEqual(
        RULES_WHOSE_IGNORES_NAME_THEM,
      )
    },
  )

  itWhereTheTsconfigTakesThemIn.each(TS_FILES_WE_HAVE_A_CONSUMER_WRITE)('run on %s every typed rule a .mts file in src/ gets', (file) => {
    expect(typedRulesRunOn(file)).toStrictEqual(typedRulesRunOn(MTS_FILE_IN_SRC))
  })

  it('fire a typed rule on a file in src/, which the project service parses', () => {
    expect(ruleIdsOn(runs(), 'agent', FLOATING_PROMISE_IN_SRC)).toContain(A_TYPED_RULE)
  })

  it('are loaded by oxlint beside them: exits 0 or 1 and prints a JSON report', () => {
    const oxlint = agentOxlintOf(runs())
    if (oxlint.outcome === 'refused') throw new Error(`oxlint printed no JSON report: ${oxlint.output}`)

    expect([0, 1]).toContain(oxlint.run.exitCode)
  })
})
