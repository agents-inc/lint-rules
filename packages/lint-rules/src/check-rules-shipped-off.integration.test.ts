import { describe, expect, it } from 'vitest'
import {
  NEWEST_LANGUAGE_RULES_SHIPPED_OFF,
  PLAYWRIGHT_RULES_SHIPPED_OFF,
  PLAYWRIGHT_TESTS,
  PLAYWRIGHT_TESTS_REPORTED,
  RULES_SHIPPED_OFF_WITH_THEIR_FIX_WITHHELD,
  SOURCE_A_WITHHELD_SUGGESTION_WOULD_CHANGE,
  SOURCES_A_WITHHELD_FIX_WOULD_CHANGE,
  SOURCES_REPORTED,
  UNIT_TEST_OUTSIDE_THE_PLAYWRIGHT_FOLDER,
} from './__tests__/cases/rules-shipped-off.ts'
import { autofixedFilesIn, findingsIn } from './__tests__/check-output.ts'
import { EXIT, runCheck } from './__tests__/cli-runs.ts'
import { checkedPackageFiles } from './__tests__/factories/check-factories.ts'
import { createGitProject } from './__tests__/git-projects.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { type TempProjects, textsOf } from './__tests__/temp-projects.ts'

// A rule we ship off by default runs in check only where a team names it in agents-inc.lint.mts: a Playwright rule on
// the Playwright tests a file override names, any other everywhere its top-level rules name it. check rewrites none of
// these files: it withholds the fix of web-first and of each rule whose fix writes an API Node 22 or jsdom lacks, and
// never applies a suggestion.

allowEveryTestForParallelLoad()

const FILES_REPORTED = [...PLAYWRIGHT_TESTS_REPORTED, ...SOURCES_REPORTED, ...SOURCES_A_WITHHELD_FIX_WOULD_CHANGE, SOURCE_A_WITHHELD_SUGGESTION_WOULD_CHANGE]
const ADDED_FILES = [...FILES_REPORTED, UNIT_TEST_OUTSIDE_THE_PLAYWRIGHT_FOLDER]
const ADDED_PATHS = ADDED_FILES.map(({ file }) => file)
const AS_WRITTEN = Object.fromEntries(ADDED_FILES.map(({ file, source }) => [file, source]))
// In path order, as check prints them.
const FINDINGS_OF_THE_RULES_NAMED = FILES_REPORTED.map(({ file, line, rule }) => `${file}:${line} ${rule}`).toSorted()

const NAMING_NONE = {}
const NAMING_EACH = {
  rules: Object.fromEntries([...NEWEST_LANGUAGE_RULES_SHIPPED_OFF, ...RULES_SHIPPED_OFF_WITH_THEIR_FIX_WITHHELD].map((id) => [id, 'error'] as const)),
  fileOverrides: [{ files: PLAYWRIGHT_TESTS, rules: Object.fromEntries(PLAYWRIGHT_RULES_SHIPPED_OFF.map((id) => [id, 'error'] as const)) }],
}

/** check's exit code, the findings it printed, the files it autofixed, and the added files' texts once it ran. */
type CheckRun = {
  readonly exitCode: number | null
  readonly findings: readonly string[]
  readonly autofixed: readonly string[]
  readonly texts: Readonly<Record<string, string>>
}

/** check in a package listing no ruleset, its config naming the rules given, once an agent added the files. */
function checkNaming(tempProjects: TempProjects, fields: Parameters<typeof checkedPackageFiles>[1]): CheckRun {
  const project = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles({}, fields) })
  for (const { file, source } of ADDED_FILES) project.write(file, source)
  const check = runCheck(project.dir)
  return { exitCode: check.exitCode, findings: findingsIn(check.stdout), autofixed: autofixedFilesIn(check.stdout), texts: textsOf(project.dir, ADDED_PATHS) }
}

describe('check on Playwright tests, a Vitest test and source files holding what the rules we ship off by default report', () => {
  const runs = setUpRunsBeforeTheSuite((tempProjects) => ({ namingNone: checkNaming(tempProjects, NAMING_NONE), namingEach: checkNaming(tempProjects, NAMING_EACH) }))

  it('reports nothing and leaves each file as written where agents-inc.lint.mts names none of them', () => {
    expect(runs().namingNone).toStrictEqual({ exitCode: EXIT.clean, findings: [], autofixed: [], texts: AS_WRITTEN })
  })

  it('reports each where the team names it, the Playwright rules in the Playwright tests alone and not in the Vitest test beside them, and leaves every file as written', () => {
    expect(runs().namingEach).toStrictEqual({ exitCode: EXIT.findings, findings: FINDINGS_OF_THE_RULES_NAMED, autofixed: [], texts: AS_WRITTEN })
  })
})
