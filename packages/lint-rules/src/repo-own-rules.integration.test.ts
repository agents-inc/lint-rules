import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { catalog, routeOf } from '@workspace/rule-data'
import { pluginPrefixOf, ruleNameOf } from '@workspace/rule-data/rule-id-parts'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'
import { severityOfCalculatedEntry } from './__tests__/calculated-rule-severity.ts'
import { LINE_OF_THE_THROWING_DEFAULT, SWITCH_ENDING_IN_A_NEVER_DEFAULT, SWITCH_ENDING_IN_A_THROWING_DEFAULT } from './__tests__/cases/repo-own-switches.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { isRecord } from './core/is-record.ts'

// This repo lints itself through eslint.config.mjs, which loads dist: run `bun run build` first.

allowEveryTestForParallelLoad()

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const DIST_DIR = fileURLToPath(new URL('../dist', import.meta.url))
const BUILT_MODULE = /\.mjs$/u
const REPO_OWN_PREFIX = 'house-repo'
const REPO_OWN_RULE_NAME = 'no-throwing-default-in-exhaustive-switch'
const REPO_OWN_RULE = `${REPO_OWN_PREFIX}/${REPO_OWN_RULE_NAME}`
// The typed blocks give types to a file a tsconfig takes in on disk, so the text is linted as this file.
const A_TYPED_SOURCE_FILE = 'packages/lint-rules/src/index.ts'
// No tsconfig takes in the root's lint config, so ESLint lints it without types.
const A_FILE_WITHOUT_TYPES = 'agents-inc.lint.mts'
const A_SHIPPED_HOUSE_RULE_NAME = 'no-classic-loops'
const A_SHIPPED_HOUSE_RULE = `house/${A_SHIPPED_HOUSE_RULE_NAME}`

/** A report of the repo's own rule, or a fatal message, by line. */
type RepoOwnFinding = { readonly ruleId: string | null; readonly line: number }

async function repoOwnFindingsIn(eslint: ESLint, text: string, filePath: string): Promise<RepoOwnFinding[]> {
  const results = await eslint.lintText(text, { filePath })
  return results.flatMap(({ messages }) => messages.filter(({ ruleId, fatal }) => ruleId === REPO_OWN_RULE || fatal === true).map(({ ruleId, line }) => ({ ruleId, line })))
}

function builtModulesHolding(text: string): string[] {
  return readdirSync(DIST_DIR)
    .filter((file) => BUILT_MODULE.test(file))
    .filter((file) => readFileSync(join(DIST_DIR, file), 'utf8').includes(text))
}

describe("the rule this repo holds its own switches to, in this repo's eslint.config.mjs", () => {
  it('is on at error for a source file', async () => {
    const calculated: unknown = await new ESLint({ cwd: REPO_ROOT }).calculateConfigForFile(A_TYPED_SOURCE_FILE)
    if (!isRecord(calculated) || !isRecord(calculated.rules)) throw new Error(`ESLint calculated no rules for ${A_TYPED_SOURCE_FILE}`)

    expect(severityOfCalculatedEntry(calculated.rules[REPO_OWN_RULE])).toBe('error')
  })

  it('reports a throwing default after every case of a union, and not a never default, where the file has types', async () => {
    const eslint = new ESLint({ cwd: REPO_ROOT })

    expect({
      throwingDefault: await repoOwnFindingsIn(eslint, SWITCH_ENDING_IN_A_THROWING_DEFAULT, A_TYPED_SOURCE_FILE),
      neverDefault: await repoOwnFindingsIn(eslint, SWITCH_ENDING_IN_A_NEVER_DEFAULT, A_TYPED_SOURCE_FILE),
    }).toStrictEqual({ throwingDefault: [{ ruleId: REPO_OWN_RULE, line: LINE_OF_THE_THROWING_DEFAULT }], neverDefault: [] })
  })

  it('stays silent, and leaves ESLint running, in a TS file no tsconfig takes in', async () => {
    expect(await repoOwnFindingsIn(new ESLint({ cwd: REPO_ROOT }), SWITCH_ENDING_IN_A_THROWING_DEFAULT, A_FILE_WITHOUT_TYPES)).toStrictEqual([])
  })
})

describe('the rule this repo holds its own switches to, in what the package ships', () => {
  // The catalog holds every rule ID a consumer may name, shipped or not.
  it('is in no catalog entry, under its name or its prefix, while a house rule is shipped', () => {
    expect({
      aHouseRuleShipped: routeOf(A_SHIPPED_HOUSE_RULE, catalog).shipped !== null,
      repoOwnIdsInTheCatalog: catalog.rules
        .keys()
        .filter((id) => ruleNameOf(id) === REPO_OWN_RULE_NAME || pluginPrefixOf(id) === REPO_OWN_PREFIX)
        .toArray(),
    }).toStrictEqual({ aHouseRuleShipped: true, repoOwnIdsInTheCatalog: [] })
  })

  it('is in none of the built modules, which carry the house rules', () => {
    expect({ carryAHouseRule: builtModulesHolding(A_SHIPPED_HOUSE_RULE_NAME).length > 0, carryTheRepoOwnRule: builtModulesHolding(REPO_OWN_RULE_NAME) }).toStrictEqual({
      carryAHouseRule: true,
      carryTheRepoOwnRule: [],
    })
  })
})
