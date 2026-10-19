import { describe, expect, it } from 'vitest'
import { A_DEPRECATED_CONSTANT_PASSED_ON, A_TYPE_PASSED_ON_AS_A_VALUE, RE_EXPORTING_ITSELF, SHAPE_PASSED_ON_AS_A_TYPE } from './__tests__/cases/check-sources.ts'
import { findingsIn, notCheckedIn } from './__tests__/check-output.ts'
import { EXIT, runCheck } from './__tests__/cli-runs.ts'
import { checkedPackageFiles, moduleText, packageTsconfigText, TAKING_IN_SRC } from './__tests__/factories/check-factories.ts'
import { createGitProject, type GitProject } from './__tests__/git-projects.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import type { ProjectFiles, TempProjects } from './__tests__/temp-projects.ts'

// typescript-eslint's no-deprecated and consistent-type-exports follow re-exports with no record of where they have been
// (8.71): over a re-export cycle, the first held check for good, the second overflowed its stack.

// modern-js ships no-deprecated; a team turns consistent-type-exports on.
const MODERN_JS = { quality: ['modern-js'] } as const
const NO_RULESET = { quality: [] } as const
const TYPE_EXPORTS_TURNED_ON = { rules: { '@typescript-eslint/consistent-type-exports': 'error' } } as const

/** A committed project of the package files given and a tsconfig taking in src, then src/cycle.ts and the files beside it written. */
function projectWithACycleBeside(tempProjects: TempProjects, packageFiles: ProjectFiles, beside: Readonly<Record<string, readonly string[]>>): GitProject {
  const project = createGitProject(tempProjects, { repo: 'committed', files: { ...packageFiles, 'tsconfig.json': packageTsconfigText(TAKING_IN_SRC) } })
  Object.entries({ [RE_EXPORTING_ITSELF.file]: RE_EXPORTING_ITSELF.lines, ...beside }).forEach(([file, lines]) => project.write(file, moduleText(...lines)))
  return project
}

describe('check on a file re-exporting a name from itself, beside a deprecated name passed on, with no-deprecated on', () => {
  const runs = setUpRunsBeforeTheSuite((tempProjects) => runCheck(projectWithACycleBeside(tempProjects, checkedPackageFiles(MODERN_JS), A_DEPRECATED_CONSTANT_PASSED_ON).dir))

  it('ends, every file checked, and exits 1', () => {
    const { exitCode, signal, stdout } = runs()

    expect({ exitCode, signal, notChecked: notCheckedIn(stdout) }).toStrictEqual({ exitCode: EXIT.findings, signal: null, notChecked: [] })
  })

  it('reports the deprecated name where it is passed on and where it is read, and nothing in the file re-exporting from itself', () => {
    expect(findingsIn(runs().stdout)).toStrictEqual(['src/passed-on.ts:1 @typescript-eslint/no-deprecated', 'src/read.ts:3 @typescript-eslint/no-deprecated'])
  })
})

describe('check on a file re-exporting a name from itself, beside a type passed on as a value, with consistent-type-exports turned on', () => {
  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = projectWithACycleBeside(tempProjects, checkedPackageFiles(NO_RULESET, TYPE_EXPORTS_TURNED_ON), A_TYPE_PASSED_ON_AS_A_VALUE)
    return { result: runCheck(project.dir), shapePassedOn: project.read(SHAPE_PASSED_ON_AS_A_TYPE.file) }
  })

  it('checks every file, reports nothing, and exits 0', () => {
    const { exitCode, signal, stdout } = runs().result

    expect({ exitCode, signal, notChecked: notCheckedIn(stdout), findings: findingsIn(stdout) }).toStrictEqual({ exitCode: EXIT.clean, signal: null, notChecked: [], findings: [] })
  })

  it('fixes the type passed on as a value to a type re-export', () => {
    expect(runs().shapePassedOn).toBe(moduleText(...SHAPE_PASSED_ON_AS_A_TYPE.lines))
  })
})
