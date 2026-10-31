import { describe, expect, it } from 'vitest'
import { AN_HTML_READ, HTML_READ_SOURCE_FILE, HTML_READ_TEST_FILES } from './__tests__/cases/html-read-sources.ts'
import { autofixedFilesIn, findingsInFile } from './__tests__/check-output.ts'
import { runCheck } from './__tests__/cli-runs.ts'
import { checkedPackageFiles, moduleText } from './__tests__/factories/check-factories.ts'
import { createGitProject } from './__tests__/git-projects.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { textsOf } from './__tests__/temp-projects.ts'

// jsdom has no getHTML(), so the fix that writes it turns a passing jsdom test into a failing one, whether the read
// is in a test or in a source file a test imports: check runs the rule in neither.

allowEveryTestForParallelLoad()

const IN_THE_BROWSER = { runtimes: ['browser'] } as const
const WRITTEN = moduleText(AN_HTML_READ)
const EVERY_FILE_WRITTEN = [HTML_READ_SOURCE_FILE, ...HTML_READ_TEST_FILES]

describe('check on an innerHTML read an agent wrote into a source file and into each form of test file', () => {
  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(IN_THE_BROWSER) })
    for (const file of EVERY_FILE_WRITTEN) project.write(file, WRITTEN)
    const result = runCheck(project.dir)
    return { result, after: textsOf(project.dir, EVERY_FILE_WRITTEN) }
  })

  it('leaves the read in the source file byte for byte, reports nothing there, and does not name it in the autofixed line', () => {
    const { result, after } = run()

    expect({
      text: after[HTML_READ_SOURCE_FILE],
      findings: findingsInFile(result.stdout, HTML_READ_SOURCE_FILE),
      autofixed: autofixedFilesIn(result.stdout).includes(HTML_READ_SOURCE_FILE),
    }).toStrictEqual({ text: WRITTEN, findings: [], autofixed: false })
  })

  it.each(HTML_READ_TEST_FILES.map((file) => ({ file })))('leaves the read in $file byte for byte, reports nothing there, and does not name it in the autofixed line', ({ file }) => {
    const { result, after } = run()

    expect({ text: after[file], findings: findingsInFile(result.stdout, file), autofixed: autofixedFilesIn(result.stdout).includes(file) }).toStrictEqual({
      text: WRITTEN,
      findings: [],
      autofixed: false,
    })
  })
})
