import { fileURLToPath } from 'node:url'
import type { RuleId } from '@workspace/rule-data'
import { oxlintCliOutputIn, parseOxlintJsonReport } from '@workspace/rule-data/test-support/oxlint-cli'
import { ESLint, type Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import { severityOfCalculatedEntry } from './__tests__/calculated-rule-severity.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { isRecord } from './core/is-record.ts'

// What this repo's own lint configs leave out of its own code, by folder and by rule, and what they report in it; run
// `bun run build` first.

allowEveryTestForParallelLoad()

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url))

// ESLint's rule API has a rule mutate what it is handed and return nothing.
const IMMUTABLE_DATA = 'functional/immutable-data' satisfies RuleId
const NO_EXPRESSION_STATEMENTS = 'functional/no-expression-statements' satisfies RuleId
const RULES_THE_RULE_API_BREAKS = [IMMUTABLE_DATA, NO_EXPRESSION_STATEMENTS, 'functional/no-return-void'] as const satisfies readonly RuleId[]
const A_HOUSE_RULE = 'packages/eslint-plugin-house/src/rules/no-classic-loops.ts'
const A_HOUSE_RULE_TEST = 'packages/eslint-plugin-house/src/rules/no-classic-loops.test.ts'
const A_SHARED_HELPER_OF_THE_HOUSE_RULES = 'packages/eslint-plugin-house/src/shared/callee-name.ts'
const THE_HOUSE_RULE_TESTER = 'packages/eslint-plugin-house/src/__tests__/house-rule-tester.ts'
const A_TEST_HELPER_BESIDE_THE_TESTER = 'packages/eslint-plugin-house/src/__tests__/house-linter.ts'
const A_CORE_SOURCE_FILE = 'packages/lint-rules/src/core/merge-eslint-config.ts'

// A type test asserts in calls made at its top level.
const TOP_LEVEL_SIDE_EFFECTS = 'unicorn/no-top-level-side-effects' satisfies RuleId
const A_TYPE_TEST_OF_LINT_RULES = 'packages/lint-rules/src/define-lint-rules.test-d.ts'
const A_TYPE_TEST_OF_RULE_DATA = 'packages/rule-data/src/catalog.test-d.ts'
const THE_TEST_BESIDE_THAT_TYPE_TEST = 'packages/rule-data/src/catalog.test.ts'
const A_SOURCE_FILE = 'packages/lint-rules/src/index.ts'

// A Stryker config overrides the build it spreads in with `buildCommand: undefined`.
const NO_UNDEFINED_ASSIGNMENT = 'sonarjs/no-undefined-assignment' satisfies RuleId
const THE_RULE_DATA_STRYKER_CONFIG = 'stryker.rule-data.config.mjs'
const THE_HOUSE_STRYKER_CONFIG = 'stryker.eslint-plugin-house.config.mjs'
const ANOTHER_ROOT_CONFIG_FILE = 'eslint.config.mjs'

const THE_RULE_DATA_MUTATION_CONFIG = 'packages/rule-data/vitest.mutation.config.ts'

// The agents-inc CLI writes this folder.
const AGENTS_INC_FOLDER = '.agents-inc/'
const AGENTS_INC_CONFIG_TYPES = '.agents-inc/claude/config-types.ts'
const AGENTS_INC_CONFIG = '.agents-inc/claude/config.ts'
// The gate's flag: the only nested oxlint config in the repo is test data.
const AS_THE_GATE_RUNS_OXLINT = '--disable-nested-config'
// oxlint prints the files it would lint, one per line, then exits.
const LIST_EVERY_FILE_AS_THE_GATE_RUNS = ['--debug=files', AS_THE_GATE_RUNS_OXLINT]
const REPORT_AS_JSON = '--format=json'
const LINE_END = '\n'

const SEVERITIES_THAT_REPORT: ReadonlySet<Linter.StringSeverity | undefined> = new Set(['warn', 'error'])

/** A message ESLint gives a file: `ruleId` null for a parse error, or the warning that the file is ignored. */
type EslintMessage = { readonly ruleId: string | null; readonly line: number }

/** Each file given, with those of the rules given that ESLint runs on it under this repo's eslint.config.mjs. */
async function rulesOnByFile(files: readonly string[], rules: readonly RuleId[]): Promise<Record<string, RuleId[]>> {
  const eslint = new ESLint({ cwd: REPO_ROOT })
  const entries = await Promise.all(
    files.map(async (file) => {
      const calculated: unknown = await eslint.calculateConfigForFile(file)
      if (!isRecord(calculated) || !isRecord(calculated.rules)) throw new Error(`ESLint calculated no rules for ${file}`)
      const calculatedRules = calculated.rules
      return [file, rules.filter((rule) => SEVERITIES_THAT_REPORT.has(severityOfCalculatedEntry(calculatedRules[rule])))] as const
    }),
  )
  return Object.fromEntries(entries)
}

/** Every message ESLint gives the file under this repo's eslint.config.mjs, those of no rule included. */
async function eslintMessagesIn(file: string): Promise<EslintMessage[]> {
  const results = await new ESLint({ cwd: REPO_ROOT }).lintFiles([file])
  return results.flatMap(({ messages }) => messages.map(({ ruleId, line }) => ({ ruleId, line })))
}

describe("the rules ESLint's rule API makes a house rule break, in this repo's eslint.config.mjs", () => {
  it('are off in a house rule and in a shared helper of the house rules, and on in core source', async () => {
    expect(await rulesOnByFile([A_HOUSE_RULE, A_SHARED_HELPER_OF_THE_HOUSE_RULES, A_CORE_SOURCE_FILE], RULES_THE_RULE_API_BREAKS)).toStrictEqual({
      [A_HOUSE_RULE]: [],
      [A_SHARED_HELPER_OF_THE_HOUSE_RULES]: [],
      [A_CORE_SOURCE_FILE]: [...RULES_THE_RULE_API_BREAKS],
    })
  })

  // The shipped ruleset runs no-expression-statements and no-return-void in no test file or test helper.
  it('are off in the house rule tester, while immutable-data stays on in a house rule test and in the test helper beside the tester', async () => {
    expect(await rulesOnByFile([THE_HOUSE_RULE_TESTER, A_HOUSE_RULE_TEST, A_TEST_HELPER_BESIDE_THE_TESTER], RULES_THE_RULE_API_BREAKS)).toStrictEqual({
      [THE_HOUSE_RULE_TESTER]: [],
      [A_HOUSE_RULE_TEST]: [IMMUTABLE_DATA],
      [A_TEST_HELPER_BESIDE_THE_TESTER]: [IMMUTABLE_DATA],
    })
  })
})

describe("the rule a type test's top-level assertions break, in this repo's eslint.config.mjs", () => {
  it('is off in a type test of each package holding one, and on in the test beside one and in a source file', async () => {
    expect(await rulesOnByFile([A_TYPE_TEST_OF_LINT_RULES, A_TYPE_TEST_OF_RULE_DATA, THE_TEST_BESIDE_THAT_TYPE_TEST, A_SOURCE_FILE], [TOP_LEVEL_SIDE_EFFECTS])).toStrictEqual({
      [A_TYPE_TEST_OF_LINT_RULES]: [],
      [A_TYPE_TEST_OF_RULE_DATA]: [],
      [THE_TEST_BESIDE_THAT_TYPE_TEST]: [TOP_LEVEL_SIDE_EFFECTS],
      [A_SOURCE_FILE]: [TOP_LEVEL_SIDE_EFFECTS],
    })
  })
})

describe("the rule a Stryker config's build override breaks, in this repo's eslint.config.mjs", () => {
  it('is off in each Stryker config overriding the build, and on in another root config file and in a source file', async () => {
    expect(await rulesOnByFile([THE_RULE_DATA_STRYKER_CONFIG, THE_HOUSE_STRYKER_CONFIG, ANOTHER_ROOT_CONFIG_FILE, A_SOURCE_FILE], [NO_UNDEFINED_ASSIGNMENT])).toStrictEqual({
      [THE_RULE_DATA_STRYKER_CONFIG]: [],
      [THE_HOUSE_STRYKER_CONFIG]: [],
      [ANOTHER_ROOT_CONFIG_FILE]: [NO_UNDEFINED_ASSIGNMENT],
      [A_SOURCE_FILE]: [NO_UNDEFINED_ASSIGNMENT],
    })
  })
})

describe("rule-data's mutation config, in this repo's own lint configs", () => {
  it('draws no message from ESLint and no diagnostic from oxlint run as the gate runs it, while ESLint still runs no-expression-statements in it', async () => {
    const oxlintReport = parseOxlintJsonReport(oxlintCliOutputIn(REPO_ROOT, [AS_THE_GATE_RUNS_OXLINT, REPORT_AS_JSON, THE_RULE_DATA_MUTATION_CONFIG]).stdout)

    expect({
      eslint: await eslintMessagesIn(THE_RULE_DATA_MUTATION_CONFIG),
      oxlint: { files: oxlintReport.number_of_files, diagnostics: oxlintReport.diagnostics },
      rulesOn: await rulesOnByFile([THE_RULE_DATA_MUTATION_CONFIG], [NO_EXPRESSION_STATEMENTS]),
    }).toStrictEqual({
      eslint: [],
      oxlint: { files: 1, diagnostics: [] },
      rulesOn: { [THE_RULE_DATA_MUTATION_CONFIG]: [NO_EXPRESSION_STATEMENTS] },
    })
  })
})

describe("the folder the agents-inc CLI writes, in this repo's own lint configs", () => {
  it('ESLint leaves each file in it out, and lints a source file', async () => {
    const eslint = new ESLint({ cwd: REPO_ROOT })
    const ignoredByFile = await Promise.all([AGENTS_INC_CONFIG_TYPES, AGENTS_INC_CONFIG, A_SOURCE_FILE].map(async (file) => [file, await eslint.isPathIgnored(file)] as const))

    expect(Object.fromEntries(ignoredByFile)).toStrictEqual({ [AGENTS_INC_CONFIG_TYPES]: true, [AGENTS_INC_CONFIG]: true, [A_SOURCE_FILE]: false })
  })

  it('oxlint, run over the whole repo as the gate runs it, lists no file in it, and lists a source file', () => {
    const { exitCode, stdout } = oxlintCliOutputIn(REPO_ROOT, LIST_EVERY_FILE_AS_THE_GATE_RUNS)
    const listed = stdout.split(LINE_END)

    expect({
      exitCode,
      inTheFolder: listed.filter((file) => file.startsWith(AGENTS_INC_FOLDER)),
      listsASourceFile: listed.includes(A_SOURCE_FILE),
    }).toStrictEqual({ exitCode: 0, inTheFolder: [], listsASourceFile: true })
  })
})
