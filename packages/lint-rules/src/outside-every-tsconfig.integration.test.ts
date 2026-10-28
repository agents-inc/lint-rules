import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { catalog } from '@workspace/rule-data'
import { describe, expect, it } from 'vitest'
import { eslintBlocksMatchingNoFile } from './__tests__/blocks-matching-no-file.ts'
import { AGENT_BUILD, type EngineRun, setUpEngineRun } from './__tests__/engine-run.ts'
import { buildEditorBuild } from './__tests__/factories/engine-build-factories.ts'
import { buildEveryRulesetLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOthers, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { buildTsconfig, type Tsconfig } from './__tests__/factories/tsconfig-factories.ts'
import { BUILT_DIST_DIR, type ProjectFiles, setUpTempProjects } from './__tests__/temp-projects.ts'
import { defineLintRules } from './index.ts'

// A TS file no tsconfig takes in gets no typed rule, so no fatal parse error, and every untyped rule
// still runs on it. The fixture holds one source inside the tsconfig, outside it, and outside it in a
// folder named with glob syntax.

const FIXTURES_DIR = fileURLToPath(new URL('../test-fixtures/outside-every-tsconfig', import.meta.url))
const INSIDE_THE_TSCONFIG = 'src/sample.ts'
const OUTSIDE_EVERY_TSCONFIG = ['stray/sample.ts', 'app/[id]/sample.ts']
const UNTYPED_SENTINEL = 'house/no-section-banner'
const TYPED_SENTINEL = '@typescript-eslint/no-floating-promises'
const SENTINELS: ReadonlySet<string> = new Set([UNTYPED_SENTINEL, TYPED_SENTINEL])
const WRITTEN_FILES = { 'tsconfig.json': JSON.stringify(buildTsconfig({ include: ['src'] })) }

/** How a project lays out its TS files outside every tsconfig: its tsconfig, and the files beside them. */
type StrayLayout = { readonly layout: string; readonly tsconfig: Tsconfig; readonly filesFor: (index: number) => ProjectFiles }

/** The merge in a process of its own: how long it took, or null where it was stopped at the ceiling. */
type MergeTiming = { readonly mergeMs: number | null }

const MERGE_TIMING_PROCESS = fileURLToPath(new URL('./__tests__/merge-timing-process.ts', import.meta.url))
const STRAY_COUNT = 1000
// The target is a merge under 2 s at a thousand such files; the ceiling is ten times that, so a merge
// that scales passes on a loaded machine. One that did not took 22 s at a quarter of them (measured).
const MERGE_CEILING_MS = 20_000
// The process also loads the built ESLint entry, seconds under a loaded parallel run, before it
// times the merge.
const PROCESS_CEILING_MS = 90_000
const MERGE_TEST_TIMEOUT_MS = 180_000
const CLEAN_MODULE = 'export const total = 1\n'
const STRAY_LAYOUTS: readonly StrayLayout[] = [
  {
    layout: 'all in one folder the tsconfig leaves out',
    tsconfig: buildTsconfig({ include: ['src'] }),
    filesFor(index) { return { [`out/f${String(index)}.ts`]: CLEAN_MODULE } },
  },
  {
    layout: 'each beside a file the tsconfig includes, left out by its exclude, as test files often are',
    tsconfig: buildTsconfig({ include: ['src'], exclude: ['**/*.test.ts'] }),
    filesFor(index) { return { [`src/m${String(index)}/a.ts`]: CLEAN_MODULE, [`src/m${String(index)}/a.test.ts`]: CLEAN_MODULE } },
  },
]

function isTypedRule(ruleId: string): boolean {
  const route = catalog.rules.get(ruleId)
  if (route === undefined) throw new Error(`ESLint ran ${ruleId}, which is not in the catalog`)
  return route.typed
}

function isSentinel(ruleId: string | null): ruleId is string {
  return ruleId !== null && SENTINELS.has(ruleId)
}

function sentinelsReportedOn(run: EngineRun, file: string): string[] {
  return [...new Set(run.eslintRuleIdsOn(file).filter(isSentinel))].toSorted()
}

/** The same cases for each build: the files outside every tsconfig linted as the file inside is, typed rules aside. */
function itLintsTheFilesOutsideEveryTsconfig(run: EngineRun): void {
  it('reports no fatal message on any file', () => {
    expect(run.eslintFatalMessages()).toStrictEqual([])
  })

  it('runs on each file outside every tsconfig every untyped rule it runs inside it, and no typed rule', () => {
    const insideUntyped = run.eslintRulesRunOn(INSIDE_THE_TSCONFIG).filter((ruleId) => !isTypedRule(ruleId))
    const byFile = OUTSIDE_EVERY_TSCONFIG.map((file) => {
      const runOnFile = run.eslintRulesRunOn(file)
      return {
        file,
        untypedNotRun: insideUntyped.filter((ruleId) => !runOnFile.includes(ruleId)),
        typedRun: runOnFile.filter(isTypedRule),
      }
    })

    expect(byFile).toStrictEqual(OUTSIDE_EVERY_TSCONFIG.map((file) => ({ file, untypedNotRun: [], typedRun: [] })))
  })

  it('reports the untyped sentinel on every copy and the typed one only inside the tsconfig', () => {
    expect(
      Object.fromEntries([INSIDE_THE_TSCONFIG, ...OUTSIDE_EVERY_TSCONFIG].map((file) => [file, sentinelsReportedOn(run, file)])),
    ).toStrictEqual({
      [INSIDE_THE_TSCONFIG]: [TYPED_SENTINEL, UNTYPED_SENTINEL],
      ...Object.fromEntries(OUTSIDE_EVERY_TSCONFIG.map((file) => [file, [UNTYPED_SENTINEL]])),
    })
  })
}

describe('the agent build, given TS files outside every tsconfig', () => {
  const run = setUpEngineRun(FIXTURES_DIR, (projectDir) => defineLintRules(buildEveryRulesetLintRules(projectDir)), WRITTEN_FILES, AGENT_BUILD)

  itLintsTheFilesOutsideEveryTsconfig(run)
})

describe('mergeEslintConfig, with a team config giving no type information, given TS files outside every tsconfig', () => {
  const run = setUpEngineRun(
    FIXTURES_DIR,
    (projectDir) => defineLintRules(buildEveryRulesetLintRules(projectDir)),
    WRITTEN_FILES,
    buildEditorBuild(),
  )

  itLintsTheFilesOutsideEveryTsconfig(run)

  // A block no path can match changes nothing, so the merge should never write one.
  it('writes no block whose files no path can match', () => {
    expect(eslintBlocksMatchingNoFile(run.emittedEslintConfig())).toStrictEqual([])
  })
})

function timedMerge(projectDir: string): MergeTiming {
  const lintRulesJson = JSON.stringify(buildEveryRulesetLintRules(projectDir))
  const { status, stdout, stderr, signal } = spawnSync(process.execPath, [MERGE_TIMING_PROCESS, BUILT_DIST_DIR, lintRulesJson], {
    encoding: 'utf8',
    timeout: PROCESS_CEILING_MS,
  })
  if (signal !== null) return { mergeMs: null }
  if (status !== 0) throw new Error(`the timed merge failed (exit ${String(status)}): ${stderr}`)
  // Parse boundary: the timing process prints its own JSON.
  return JSON.parse(stdout) as MergeTiming
}

// Without oxlint, every TS file outside every tsconfig is left out of our typed blocks, which must not
// make the merge's cost grow with their number. The merge runs in a process of its own, stopped at the
// process ceiling, so one that never finishes fails rather than hanging the suite.
describe('mergeEslintConfig, without oxlint, in a project with a thousand TS files outside every tsconfig', () => {
  const tempProjects = setUpTempProjects()

  function projectWith({ tsconfig, filesFor }: StrayLayout): string {
    const strays = Array.from({ length: STRAY_COUNT }, (_, index) => Object.entries(filesFor(index))).flat()
    return tempProjects.create({
      files: {
        'package.json': packageJsonText(buildPackageJsonListingOthers()),
        'tsconfig.json': JSON.stringify(tsconfig),
        'src/index.ts': CLEAN_MODULE,
        ...Object.fromEntries(strays),
      },
    })
  }

  it.each(STRAY_LAYOUTS)(
    'finishes within the ceiling with every ruleset listed, where they are $layout',
    { timeout: MERGE_TEST_TIMEOUT_MS },
    (layout) => {
      const { mergeMs } = timedMerge(projectWith(layout))

      expect(mergeMs, `the merge was stopped at the process ceiling, ${String(PROCESS_CEILING_MS)} ms`).not.toBeNull()
      expect(mergeMs).toBeLessThan(MERGE_CEILING_MS)
    },
  )
})
