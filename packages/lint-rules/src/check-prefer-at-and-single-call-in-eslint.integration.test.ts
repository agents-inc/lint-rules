import { describe, expect, it } from 'vitest'
import { CLASS_LIST, LAST_CELL, LAST_ITEM, OWN_PUSH } from './__tests__/cases/routed-to-eslint-check-sources.ts'
import { autofixedFilesIn, findingsIn } from './__tests__/check-output.ts'
import { EXIT, runCheck } from './__tests__/cli-runs.ts'
import { checkedPackageFiles } from './__tests__/factories/check-factories.ts'
import { createGitProject } from './__tests__/git-projects.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { textsOf } from './__tests__/temp-projects.ts'

// check runs oxlint and ESLint together, so the rule's own engine decides which shapes it reports and rewrites.

allowEveryTestForParallelLoad()

const MODERN_JS_AND_REDUNDANCY = { quality: ['modern-js', 'redundancy'] } as const
const CHECKED_FILES = [LAST_ITEM, LAST_CELL, OWN_PUSH, CLASS_LIST]
const PATHS = CHECKED_FILES.map(({ file }) => file)

describe("check, run twice, on the last item of an array and of a NodeList, two calls to a class's own push and two classList calls", () => {
  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(MODERN_JS_AND_REDUNDANCY) })
    for (const { file, source } of CHECKED_FILES) project.write(file, source)
    const first = runCheck(project.dir)
    const afterFirst = textsOf(project.dir, PATHS)
    const second = runCheck(project.dir)
    const afterSecond = textsOf(project.dir, PATHS)
    return { first, afterFirst, second, afterSecond }
  })

  it('reports the classList calls by prefer-single-call alone, and exits on the finding', () => {
    const { first } = run()

    expect({ exitCode: first.exitCode, findings: findingsIn(first.stdout) }).toStrictEqual({ exitCode: EXIT.findings, findings: [CLASS_LIST.finding] })
  })

  it("applies ESLint's prefer-at fix to the array's last item and names that file alone in the autofixed line", () => {
    const { first, afterFirst } = run()

    expect({ text: afterFirst[LAST_ITEM.file], autofixed: autofixedFilesIn(first.stdout) }).toStrictEqual({ text: LAST_ITEM.fixed, autofixed: [LAST_ITEM.file] })
  })

  it('leaves the classList calls as written, withholding the fix prefer-single-call reports them with', () => {
    const { afterFirst } = run()

    expect(afterFirst[CLASS_LIST.file]).toStrictEqual(CLASS_LIST.source)
  })

  it("leaves the last item of a NodeList and the calls to a class's own push as written", () => {
    const { afterFirst } = run()

    expect({ lastCell: afterFirst[LAST_CELL.file], ownPush: afterFirst[OWN_PUSH.file] }).toStrictEqual({ lastCell: LAST_CELL.source, ownPush: OWN_PUSH.source })
  })

  it('reports the same finding on a second run, fixes nothing and changes no file', () => {
    const { second, afterFirst, afterSecond } = run()

    expect({ exitCode: second.exitCode, findings: findingsIn(second.stdout), autofixed: autofixedFilesIn(second.stdout), texts: afterSecond }).toStrictEqual({
      exitCode: EXIT.findings,
      findings: [CLASS_LIST.finding],
      autofixed: [],
      texts: afterFirst,
    })
  })
})
