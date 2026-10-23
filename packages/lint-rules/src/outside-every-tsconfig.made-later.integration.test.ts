import { cpSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { setTimeout as waitFor } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import { describe, expect, it, vi } from 'vitest'
import { fatalMessagesIn } from './__tests__/engine-clis.ts'
import { buildEveryRulesetLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildTsconfig } from './__tests__/factories/tsconfig-factories.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { NO_TEAM_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { mergeEslintConfig } from './eslint.ts'
import { defineLintRules } from './index.ts'

// An editor merges once, as it loads eslint.config.mjs, and keeps linting with that config. Whether a tsconfig
// takes a TS file in is asked as ESLint lints it, so a file made after the merge is read as the disk then holds it.

/** What one ESLint, made before the two files were, reports on each of them. */
type MadeLaterRun = {
  readonly projectDir: string
  readonly inside: readonly ESLint.LintResult[]
  readonly outside: readonly ESLint.LintResult[]
}

const FIXTURES_DIR = fileURLToPath(new URL('../test-fixtures/outside-every-tsconfig', import.meta.url))
const INSIDE_THE_TSCONFIG = 'src/sample.ts'
const MADE_LATER_INSIDE = 'src/made-later.ts'
const MADE_LATER_OUTSIDE = 'stray/made-later.ts'
const UNTYPED_SENTINEL = 'house/no-section-banner'
const TYPED_SENTINEL = '@typescript-eslint/no-floating-promises'
const SENTINELS: ReadonlySet<string> = new Set([UNTYPED_SENTINEL, TYPED_SENTINEL])
const WRITTEN_FILES = { 'tsconfig.json': JSON.stringify(buildTsconfig({ include: ['src'] })) }
// typescript-eslint re-reads its projects for a file it finds in none at most every 250 ms (RELOAD_THROTTLE_MS,
// useProgramFromProjectService.js, 8.71), and only outside a single run, as in an editor.
const PROJECT_RELOAD_THROTTLE_MS = 250
const SINGLE_RUN = 'TSESTREE_SINGLE_RUN'
const NOT_A_SINGLE_RUN = 'false'

function isSentinel(ruleId: string | null): ruleId is string {
  return ruleId !== null && SENTINELS.has(ruleId)
}

function sentinelsIn(results: readonly ESLint.LintResult[]): string[] {
  return [...new Set(results.flatMap(({ messages }) => messages.map(({ ruleId }) => ruleId)).filter(isSentinel))].toSorted()
}

function copyOfTheSample(projectDir: string, file: string): void {
  mkdirSync(dirname(join(projectDir, file)), { recursive: true })
  cpSync(join(projectDir, INSIDE_THE_TSCONFIG), join(projectDir, file))
}

describe('mergeEslintConfig, with a team config giving no type information, given TS files made after one ESLint loaded the merge and linted a file', () => {
  const run = setUpRunsBeforeTheSuite(async (tempProjects): Promise<MadeLaterRun> => {
    vi.stubEnv(SINGLE_RUN, NOT_A_SINGLE_RUN)
    try {
      const projectDir = tempProjects.create({ fixturesDir: FIXTURES_DIR, files: WRITTEN_FILES })
      const { eslint } = defineLintRules(buildEveryRulesetLintRules(projectDir)).editorRulesets
      const engine = new ESLint({ cwd: projectDir, overrideConfigFile: true, overrideConfig: mergeEslintConfig([], eslint, NO_TEAM_OXLINT_CONFIG) })
      await engine.lintFiles([INSIDE_THE_TSCONFIG])
      copyOfTheSample(projectDir, MADE_LATER_INSIDE)
      copyOfTheSample(projectDir, MADE_LATER_OUTSIDE)
      await waitFor(PROJECT_RELOAD_THROTTLE_MS)
      const inside = await engine.lintFiles([MADE_LATER_INSIDE])
      return { projectDir, inside, outside: await engine.lintFiles([MADE_LATER_OUTSIDE]) }
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('reports no fatal message on the one outside every tsconfig, and the untyped sentinel alone', () => {
    const { projectDir, outside } = run()

    expect({ fatal: fatalMessagesIn(outside, projectDir), sentinels: sentinelsIn(outside) }).toStrictEqual({ fatal: [], sentinels: [UNTYPED_SENTINEL] })
  })

  it('reports the typed sentinel beside the untyped one on the one inside the tsconfig', () => {
    const { projectDir, inside } = run()

    expect({ fatal: fatalMessagesIn(inside, projectDir), sentinels: sentinelsIn(inside) }).toStrictEqual({ fatal: [], sentinels: [TYPED_SENTINEL, UNTYPED_SENTINEL] })
  })
})
