import { describe, expect, it } from 'vitest'
import {
  RETURNED_USING_RESOURCES,
  THROWN_USING_RESOURCES,
  TSCONFIG_DECLARING_DISPOSABLES,
  USING_RESOURCE_ESCAPE,
  VALUES_RETURNED_IMMEDIATELY_ONCE_FIXED,
} from './__tests__/cases/using-resource-sources.ts'
import { autofixedFilesIn, findingsIn, findingsInFile } from './__tests__/check-output.ts'
import { EXIT, runCheck } from './__tests__/cli-runs.ts'
import { checkedPackageFiles } from './__tests__/factories/check-factories.ts'
import { createGitProject } from './__tests__/git-projects.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { textsOf } from './__tests__/temp-projects.ts'

// sonarjs/prefer-immediate-return ships in redundancy and unicorn/no-using-resource-escape in correctness.

allowEveryTestForParallelLoad()

const CORRECTNESS_AND_REDUNDANCY = { quality: ['correctness', 'redundancy'] } as const
const USING_FILES = RETURNED_USING_RESOURCES.map(({ file }) => file)
const THROWN_USING_FILES = THROWN_USING_RESOURCES.map(({ file }) => file)
const FIXED_FILES = VALUES_RETURNED_IMMEDIATELY_ONCE_FIXED.map(({ file }) => file)
const ALL_FILES = [...RETURNED_USING_RESOURCES, ...THROWN_USING_RESOURCES, ...VALUES_RETURNED_IMMEDIATELY_ONCE_FIXED]

describe('check on a returned or thrown `using` resource, beside a returned and a thrown const', () => {
  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, {
      repo: 'committed',
      files: { ...checkedPackageFiles(CORRECTNESS_AND_REDUNDANCY), 'tsconfig.json': TSCONFIG_DECLARING_DISPOSABLES },
    })
    for (const { file, source } of ALL_FILES) project.write(file, source)
    const check = runCheck(project.dir)
    return { check, after: textsOf(project.dir, [...USING_FILES, ...THROWN_USING_FILES, ...FIXED_FILES]) }
  })

  it('reports the escape of each returned `using` resource on its return line, in TypeScript and JavaScript, and exits on the findings', () => {
    const { check } = run()

    expect({ exitCode: check.exitCode, findings: findingsIn(check.stdout) }).toStrictEqual({
      exitCode: EXIT.findings,
      findings: RETURNED_USING_RESOURCES.map(({ file, line }) => `${file}:${line} ${USING_RESOURCE_ESCAPE}`),
    })
  })

  it('leaves each returned `using` resource byte for byte and names none in the autofixed line', () => {
    const { check, after } = run()

    expect({
      texts: USING_FILES.map((file) => after[file]),
      autofixed: autofixedFilesIn(check.stdout).filter((file) => USING_FILES.includes(file)),
    }).toStrictEqual({ texts: RETURNED_USING_RESOURCES.map(({ source }) => source), autofixed: [] })
  })

  it('leaves each thrown `using` resource byte for byte, reports nothing in it and names none in the autofixed line, in TypeScript and JavaScript', () => {
    const { check, after } = run()

    expect({
      texts: THROWN_USING_FILES.map((file) => after[file]),
      findings: THROWN_USING_FILES.flatMap((file) => findingsInFile(check.stdout, file)),
      autofixed: autofixedFilesIn(check.stdout).filter((file) => THROWN_USING_FILES.includes(file)),
    }).toStrictEqual({ texts: THROWN_USING_RESOURCES.map(({ source }) => source), findings: [], autofixed: [] })
  })

  it('still returns the returned const, the const returned beside a `using` resource and the thrown const immediately, naming each in the autofixed line', () => {
    const { check, after } = run()

    expect({
      texts: FIXED_FILES.map((file) => after[file]),
      autofixed: autofixedFilesIn(check.stdout).filter((file) => FIXED_FILES.includes(file)),
    }).toStrictEqual({
      texts: VALUES_RETURNED_IMMEDIATELY_ONCE_FIXED.map(({ fixed }) => fixed),
      autofixed: FIXED_FILES,
    })
  })
})
