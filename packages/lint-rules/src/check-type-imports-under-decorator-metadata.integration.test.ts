import { describe, expect, it } from 'vitest'
import {
  DECORATED_SERVICE,
  DECORATOR_METADATA,
  DECORATORS_ALONE,
  SERVICE_IMPORTS,
  UNDECORATED_SERVICE,
} from './__tests__/cases/accepted-1011-check-sources.ts'
import { autofixedFilesIn, findingsIn } from './__tests__/check-output.ts'
import { type CliRun, EXIT, runCheck } from './__tests__/cli-runs.ts'
import { checkedPackageFiles } from './__tests__/factories/check-factories.ts'
import { jsonFileText } from './__tests__/factories/team-config-file-factories.ts'
import { buildBundlerTsconfig } from './__tests__/factories/tsconfig-factories.ts'
import { createGitProject } from './__tests__/git-projects.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { type TempProjects, textsOf } from './__tests__/temp-projects.ts'

// Under emitDecoratorMetadata the emitted design:paramtypes reads a decorated class's constructor parameter types at run time.

allowEveryTestForParallelLoad()

const CONVENTIONS = { quality: ['conventions'] } as const
const SERVICES = [DECORATED_SERVICE, UNDECORATED_SERVICE]
const SERVICE_FILES = SERVICES.map(({ file }) => file)

type CheckOfTheServices = { readonly run: CliRun; readonly texts: Readonly<Record<string, string>> }

/** A committed project checking conventions under the compiler options given, holding what the services import; the services then written, so check takes them alone as changed. */
function checkOfTheServicesUnder(tempProjects: TempProjects, compilerOptions: Readonly<Record<string, unknown>>): CheckOfTheServices {
  const project = createGitProject(tempProjects, {
    repo: 'committed',
    files: {
      ...checkedPackageFiles(CONVENTIONS),
      'tsconfig.json': jsonFileText(buildBundlerTsconfig(compilerOptions)),
      ...SERVICE_IMPORTS,
    },
  })
  for (const { file, source } of SERVICES) project.write(file, source)
  const run = runCheck(project.dir)
  return { run, texts: textsOf(project.dir, SERVICE_FILES) }
}

describe('check on a decorated and an undecorated service, each importing its constructor parameter type, under emitDecoratorMetadata', () => {
  const check = setUpRunsBeforeTheSuite((tempProjects) => checkOfTheServicesUnder(tempProjects, DECORATOR_METADATA))

  it("leaves the decorated service as written, and turns the undecorated service's import into a type import", () => {
    const { texts } = check()

    expect(SERVICE_FILES.map((file) => texts[file])).toStrictEqual([DECORATED_SERVICE.source, UNDECORATED_SERVICE.fixed])
  })

  it('names the undecorated service alone in the autofixed line, reports nothing and exits clean', () => {
    const { run } = check()

    expect({ exitCode: run.exitCode, findings: findingsIn(run.stdout), autofixed: autofixedFilesIn(run.stdout) }).toStrictEqual({
      exitCode: EXIT.clean,
      findings: [],
      autofixed: [UNDECORATED_SERVICE.file],
    })
  })
})

describe('check on the same services, their decorators emitting no metadata', () => {
  const check = setUpRunsBeforeTheSuite((tempProjects) => checkOfTheServicesUnder(tempProjects, DECORATORS_ALONE))

  it("turns each service's import into a type import", () => {
    const { texts } = check()

    expect(SERVICE_FILES.map((file) => texts[file])).toStrictEqual([DECORATED_SERVICE.fixed, UNDECORATED_SERVICE.fixed])
  })

  it('names both services in the autofixed line, reports nothing and exits clean', () => {
    const { run } = check()

    expect({ exitCode: run.exitCode, findings: findingsIn(run.stdout), autofixed: autofixedFilesIn(run.stdout) }).toStrictEqual({
      exitCode: EXIT.clean,
      findings: [],
      autofixed: SERVICE_FILES.toSorted(),
    })
  })
})
