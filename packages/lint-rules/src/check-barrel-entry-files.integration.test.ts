import { describe, expect, it } from 'vitest'
import {
  BARREL_RULE,
  buildPackageJsonNamingItsMainEntry,
  MAIN_ENTRY_BARREL,
  MAIN_ENTRY_FILE,
  OTHER_BARREL,
  OTHER_BARREL_FILE,
  RE_EXPORTED_FILE,
  RE_EXPORTED_MODULE,
} from './__tests__/cases/barrel-sources.ts'
import { autofixedFilesIn, findingsInFile } from './__tests__/check-output.ts'
import { runCheck } from './__tests__/cli-runs.ts'
import { checkedPackageFiles, moduleText, PACKAGE_JSON_FILE } from './__tests__/factories/check-factories.ts'
import { packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { createGitProject } from './__tests__/git-projects.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { textsOf } from './__tests__/temp-projects.ts'

allowEveryTestForParallelLoad()

const IN_THE_MODULES_RULESET = { quality: ['modules'] } as const
const WRITTEN: Readonly<Record<string, string>> = {
  [RE_EXPORTED_FILE]: moduleText(RE_EXPORTED_MODULE),
  [MAIN_ENTRY_FILE]: moduleText(MAIN_ENTRY_BARREL),
  [OTHER_BARREL_FILE]: moduleText(OTHER_BARREL),
}

describe("check on a package's main entry and another barrel an agent wrote, each a file that only re-exports", () => {
  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, {
      repo: 'committed',
      files: { ...checkedPackageFiles(IN_THE_MODULES_RULESET), [PACKAGE_JSON_FILE]: packageJsonText(buildPackageJsonNamingItsMainEntry()) },
    })
    for (const [file, text] of Object.entries(WRITTEN)) project.write(file, text)
    const result = runCheck(project.dir)
    return { result, after: textsOf(project.dir, Object.keys(WRITTEN)) }
  })

  it('reports nothing in the src/index file its package.json names as the main entry', () => {
    expect(findingsInFile(run().result.stdout, MAIN_ENTRY_FILE)).toStrictEqual([])
  })

  it('still reports the barrel elsewhere in src, on its first line', () => {
    expect(findingsInFile(run().result.stdout, OTHER_BARREL_FILE)).toStrictEqual([`${OTHER_BARREL_FILE}:1 ${BARREL_RULE}`])
  })

  it('rewrites nothing: every file stays byte for byte and none is named in an autofixed line', () => {
    const { result, after } = run()

    expect({ after, autofixed: autofixedFilesIn(result.stdout) }).toStrictEqual({ after: WRITTEN, autofixed: [] })
  })
})
