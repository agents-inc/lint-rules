import { describe, expect, it } from 'vitest'

import type { Catalog, RuleRoute } from '../catalog.ts'
import type { CaseFile } from './rule-case-runs.ts'
import { buildEslintRoute, buildOxlintRoute } from './factories/inventory-factories.ts'
import { buildShippedRule } from './factories/shipped-rule-factories.ts'
import { ruleCaseTitleOf, setUpRuleCaseOutcomes } from './rule-case-outcomes.ts'

const ENGINES_TIMEOUT_MS = 120_000
const STAND_IN = 'unicorn/no-constant-zero-expression'

const DEBUGGER_FILE: CaseFile = { path: 'src/debugger.js', source: 'debugger\n' }
const QUIET_FILE: CaseFile = { path: 'src/quiet.js', source: 'export const value = 1\n' }
const UNPARSABLE_FILE: CaseFile = { path: 'src/unparsable.js', source: 'export const = 1\n' }
const EMPTY_BLOCK_FILE: CaseFile = { path: 'src/empty-block.js', source: 'export function run(ready) {\n  if (ready) {}\n}\n' }
const FILLED_BLOCK_FILE: CaseFile = { path: 'src/filled-block.js', source: 'export function run(ready, use) {\n  if (ready) {\n    use()\n  }\n}\n' }
const AWAITED_NUMBER_FILE: CaseFile = { path: 'src/awaited-number.ts', source: 'export async function run(): Promise<number> {\n  return await 1\n}\n' }
const AWAITED_PROMISE_FILE: CaseFile = {
  path: 'src/awaited-promise.ts',
  source: 'export async function run(load: () => Promise<number>): Promise<number> {\n  return await load()\n}\n',
}
const IMPORTS_THE_CASES_PACKAGE: CaseFile = { path: 'src/imports-stubbed.js', source: "import { value } from 'stubbed'\nexport const doubled = value * 2\n" }
const IMPORTS_A_PROJECT_STUB: CaseFile = { path: 'src/imports-vite.js', source: "import { defineConfig } from 'vite'\nexport default defineConfig({})\n" }
const USES_NODES_TYPES: CaseFile = { path: 'src/node-types.ts', source: 'export const here: string = process.cwd()\n' }
const USES_VITESTS_TYPES: CaseFile = { path: 'src/vitest-types.ts', source: "import { expect } from 'vitest'\nexpect(1).toBe(1)\n" }
const CALLS_AN_UNDECLARED_FUNCTION: CaseFile = { path: 'src/undeclared.ts', source: 'export const value: unknown = undeclared()\n' }
const TIMES_ZERO_FILE: CaseFile = { path: 'src/times-zero.js', source: 'export const zero = (x) => x * 0\n' }
const TIMES_ONE_FILE: CaseFile = { path: 'src/times-one.js', source: 'export const same = (x) => x * 1\n' }
const STUBBED_PACKAGE = { name: 'stubbed', declarations: 'export declare const value: number\n', module: 'export const value = 1\n' }

function shippedOxlintRule(id: string, oxlintPlugin: string): RuleRoute {
  return buildOxlintRoute(id, { oxlintName: id, oxlintPlugin, eslintAliases: [], oxlintSpellings: [id], shipped: buildShippedRule('correctness') })
}

function shippedUntypedEslintRule(id: string): RuleRoute {
  return buildEslintRoute(id, { typed: false, oxlintSpellings: [], shipped: buildShippedRule('correctness') })
}

function shippedTypedEslintRule(id: string): RuleRoute {
  return buildEslintRoute(id, { typed: true, oxlintSpellings: [], shipped: buildShippedRule('correctness') })
}

const ROUTES: readonly RuleRoute[] = [
  shippedOxlintRule('no-debugger', 'eslint'),
  shippedOxlintRule('oxc/erasing-op', 'oxc'),
  shippedOxlintRule('oxc/const-comparisons', 'oxc'),
  shippedUntypedEslintRule('no-empty'),
  shippedUntypedEslintRule('import-x/no-unresolved'),
  shippedTypedEslintRule('@typescript-eslint/await-thenable'),
  shippedTypedEslintRule('@typescript-eslint/no-unsafe-call'),
  buildEslintRoute('no-unused-labels', { typed: false, oxlintSpellings: [], shipped: null }),
  buildEslintRoute(STAND_IN, { typed: false, oxlintSpellings: [], shipped: null }),
]

// no-debugger's stand-in reports nothing it does: a stand-in that misses.
const CATALOG_PARTS: Pick<Catalog, 'rules' | 'coreRuleExtensions' | 'eslintStandIns'> = {
  rules: new Map(ROUTES.map((route) => [route.id, route])),
  coreRuleExtensions: new Map(),
  eslintStandIns: new Map([
    ['oxc/erasing-op', STAND_IN],
    ['no-debugger', 'no-empty'],
  ]),
}

describe('ruleCaseTitleOf', () => {
  it('names the rule, and what the case covers where it says', () => {
    expect([ruleCaseTitleOf({ rule: 'no-debugger', silentIn: [], reportedIn: [] }), ruleCaseTitleOf({ rule: 'no-debugger', subject: 'a test file', silentIn: [], reportedIn: [] })]).toStrictEqual([
      'no-debugger',
      'no-debugger, for a test file,',
    ])
  })
})

describe("a rule's cases, run on the installed engines with its shipped settings", () => {
  const { outcomesOfCase, outcomesOfStandInCase } = setUpRuleCaseOutcomes(CATALOG_PARTS)

  it(
    'runs a rule oxlint runs on oxlint and on ESLint, which runs it without oxlint, each owing silence and a report, every file in the case folder',
    async () => {
      const outcomes = await outcomesOfCase('oxlint-rule', { rule: 'no-debugger', silentIn: [QUIET_FILE], reportedIn: [DEBUGGER_FILE] })

      const held = { 'oxlint-rule/src/quiet.js': 'silent', 'oxlint-rule/src/debugger.js': 'reports' }
      expect(outcomes).toStrictEqual({ actual: { oxlint: held, eslint: held }, expected: { oxlint: held, eslint: held } })
    },
    ENGINES_TIMEOUT_MS,
  )

  it(
    'runs a rule ESLint runs on ESLint alone',
    async () => {
      const outcomes = await outcomesOfCase('eslint-rule', { rule: 'no-empty', silentIn: [FILLED_BLOCK_FILE], reportedIn: [EMPTY_BLOCK_FILE] })

      const held = { 'eslint-rule/src/filled-block.js': 'silent', 'eslint-rule/src/empty-block.js': 'reports' }
      expect(outcomes).toStrictEqual({ actual: { eslint: held }, expected: { eslint: held } })
    },
    ENGINES_TIMEOUT_MS,
  )

  it(
    'runs a case naming its engines on those alone, and gives a file one engine alone reads to that engine alone',
    async () => {
      const [named, readByOne] = await Promise.all([
        outcomesOfCase('named-engines', { rule: 'no-debugger', engines: ['oxlint'], silentIn: [QUIET_FILE], reportedIn: [DEBUGGER_FILE] }),
        outcomesOfCase('read-by-one', { rule: 'no-debugger', silentIn: [{ ...QUIET_FILE, onlyIn: 'eslint' }], reportedIn: [DEBUGGER_FILE] }),
      ])

      const namedHeld = { 'named-engines/src/quiet.js': 'silent', 'named-engines/src/debugger.js': 'reports' }
      const oxlintHeld = { 'read-by-one/src/debugger.js': 'reports' }
      const eslintHeld = { 'read-by-one/src/quiet.js': 'silent', 'read-by-one/src/debugger.js': 'reports' }
      expect([named, readByOne]).toStrictEqual([
        { actual: { oxlint: namedHeld }, expected: { oxlint: namedHeld } },
        { actual: { oxlint: oxlintHeld, eslint: eslintHeld }, expected: { oxlint: oxlintHeld, eslint: eslintHeld } },
      ])
    },
    ENGINES_TIMEOUT_MS,
  )

  it(
    'runs a typed rule with the type information of the project the cases are written into',
    async () => {
      const outcomes = await outcomesOfCase('typed', { rule: '@typescript-eslint/await-thenable', silentIn: [AWAITED_PROMISE_FILE], reportedIn: [AWAITED_NUMBER_FILE] })

      const held = { 'typed/src/awaited-promise.ts': 'silent', 'typed/src/awaited-number.ts': 'reports' }
      expect(outcomes).toStrictEqual({ actual: { eslint: held }, expected: { eslint: held } })
    },
    ENGINES_TIMEOUT_MS,
  )

  // no-unsafe-call reports a call of a value whose type does not resolve, so each type file is silent only
  // where the project's node_modules holds that package.
  it(
    "gives every case Node's and Vitest's types",
    async () => {
      const outcomes = await outcomesOfCase('linked-types', {
        rule: '@typescript-eslint/no-unsafe-call',
        silentIn: [USES_NODES_TYPES, USES_VITESTS_TYPES],
        reportedIn: [CALLS_AN_UNDECLARED_FUNCTION],
      })

      const held = { 'linked-types/src/node-types.ts': 'silent', 'linked-types/src/vitest-types.ts': 'silent', 'linked-types/src/undeclared.ts': 'reports' }
      expect(outcomes).toStrictEqual({ actual: { eslint: held }, expected: { eslint: held } })
    },
    ENGINES_TIMEOUT_MS,
  )

  it(
    "resolves the project's stub packages from every case, and a case's own packages from its folder alone",
    async () => {
      const ownPackages = await outcomesOfCase('own-packages', {
        rule: 'import-x/no-unresolved',
        silentIn: [IMPORTS_THE_CASES_PACKAGE, IMPORTS_A_PROJECT_STUB],
        reportedIn: [],
        packages: [STUBBED_PACKAGE],
      })
      const otherFolder = await outcomesOfCase('other-folder', { rule: 'import-x/no-unresolved', silentIn: [], reportedIn: [IMPORTS_THE_CASES_PACKAGE] })

      const ownHeld = { 'own-packages/src/imports-stubbed.js': 'silent', 'own-packages/src/imports-vite.js': 'silent' }
      const otherHeld = { 'other-folder/src/imports-stubbed.js': 'reports' }
      expect([ownPackages, otherFolder]).toStrictEqual([
        { actual: { eslint: ownHeld }, expected: { eslint: ownHeld } },
        { actual: { eslint: otherHeld }, expected: { eslint: otherHeld } },
      ])
    },
    ENGINES_TIMEOUT_MS,
  )

  it(
    'gives what each engine made of a case that does not hold beside what it owes: a fixture that does not fire, one meant to stay silent that reports, one no engine can parse',
    async () => {
      const outcomes = await outcomesOfCase('does-not-hold', { rule: 'no-debugger', silentIn: [DEBUGGER_FILE, UNPARSABLE_FILE], reportedIn: [QUIET_FILE] })

      const made = { 'does-not-hold/src/debugger.js': 'reports', 'does-not-hold/src/unparsable.js': 'not linted', 'does-not-hold/src/quiet.js': 'silent' }
      const owed = { 'does-not-hold/src/debugger.js': 'silent', 'does-not-hold/src/unparsable.js': 'silent', 'does-not-hold/src/quiet.js': 'reports' }
      expect(outcomes).toStrictEqual({ actual: { oxlint: made, eslint: made }, expected: { oxlint: owed, eslint: owed } })
    },
    ENGINES_TIMEOUT_MS,
  )

  it('throws for a rule that is no RuleId, one we do not ship, and an engine the rule is not routed to, naming the rule', async () => {
    await expect(outcomesOfCase('unknown', { rule: 'zod/no-coerce-boolean', silentIn: [], reportedIn: [QUIET_FILE] })).rejects.toThrow(/unknown rule ID "zod\/no-coerce-boolean"/u)
    await expect(outcomesOfCase('unshipped', { rule: 'no-unused-labels', silentIn: [], reportedIn: [QUIET_FILE] })).rejects.toThrow(/no-unused-labels is not shipped/u)
    await expect(outcomesOfCase('not-routed', { rule: 'no-empty', engines: ['oxlint'], silentIn: [], reportedIn: [EMPTY_BLOCK_FILE] })).rejects.toThrow(/no-empty is not routed to oxlint/u)
  })

  it(
    'runs an oxlint rule in oxlint and its stand-in in ESLint on the same files, each owing what the case says',
    async () => {
      const [holds, misses] = await Promise.all([
        outcomesOfStandInCase('stand-in-holds', { oxlintRule: 'oxc/erasing-op', silentIn: [TIMES_ONE_FILE], reportedIn: [TIMES_ZERO_FILE] }),
        outcomesOfStandInCase('stand-in-misses', { oxlintRule: 'no-debugger', silentIn: [QUIET_FILE], reportedIn: [DEBUGGER_FILE] }),
      ])

      const heldByBoth = { 'stand-in-holds/src/times-one.js': 'silent', 'stand-in-holds/src/times-zero.js': 'reports' }
      const owed = { 'stand-in-misses/src/quiet.js': 'silent', 'stand-in-misses/src/debugger.js': 'reports' }
      expect([holds, misses]).toStrictEqual([
        { actual: { 'oxc/erasing-op': heldByBoth, [STAND_IN]: heldByBoth }, expected: { 'oxc/erasing-op': heldByBoth, [STAND_IN]: heldByBoth } },
        {
          actual: { 'no-debugger': owed, 'no-empty': { 'stand-in-misses/src/quiet.js': 'silent', 'stand-in-misses/src/debugger.js': 'silent' } },
          expected: { 'no-debugger': owed, 'no-empty': owed },
        },
      ])
    },
    ENGINES_TIMEOUT_MS,
  )

  it('throws for an oxlint rule no stand-in is recorded for, naming it', async () => {
    await expect(outcomesOfStandInCase('no-stand-in', { oxlintRule: 'oxc/const-comparisons', silentIn: [], reportedIn: [QUIET_FILE] })).rejects.toThrow(
      /no ESLint stand-in is recorded for oxc\/const-comparisons/u,
    )
  })
})
