import { describe, expect, it } from 'vitest'
import {
  A_MUTABLE_PICK,
  A_READONLY_PICK,
  A_READONLY_REQUIRED,
  B_MUTABLE_PICK,
  B_MUTABLE_REQUIRED,
  B_READONLY_PICK,
  BOTH_PICKS_IN_ONE_FILE,
  NODE_ENV_OUTSIDE_TESTS,
  type ParameterSource,
} from './__tests__/cases/pick-parameter-sources.ts'
import { findingsIn } from './__tests__/check-output.ts'
import { type CliRun, EXIT, runCheck } from './__tests__/cli-runs.ts'
import { checkedPackageFiles, moduleText, packageTsconfigText, TAKING_IN_SRC } from './__tests__/factories/check-factories.ts'
import { createGitProject } from './__tests__/git-projects.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import type { TempProjects } from './__tests__/temp-projects.ts'

// functional/prefer-immutable-types, in declarative, asks is-immutable-type how far each parameter can be overwritten.
// It kept each answer for the whole process under a key every instantiation of one generic shares (5.0.4), so in one
// check run the first Pick parameter answered decided every later one.

const DECLARATIVE = { quality: ['declarative'] } as const

/** A committed project checking declarative, the sources given then written, so check takes them as changed. */
function checkOfChanged(tempProjects: TempProjects, sources: readonly ParameterSource[]): CliRun {
  const project = createGitProject(tempProjects, { repo: 'committed', files: { ...checkedPackageFiles(DECLARATIVE), 'tsconfig.json': packageTsconfigText(TAKING_IN_SRC) } })
  for (const { file, lines } of sources) project.write(file, moduleText(...lines))
  return runCheck(project.dir, { env: NODE_ENV_OUTSIDE_TESTS })
}

function findingsAndExitOf({ exitCode, stdout }: CliRun): { readonly exitCode: number | null; readonly findings: readonly string[] } {
  return { exitCode, findings: findingsIn(stdout) }
}

describe('check on an overwritable Pick parameter, the only file changed', () => {
  const run = setUpRunsBeforeTheSuite((tempProjects) => checkOfChanged(tempProjects, [B_MUTABLE_PICK]))

  it('reports it and exits 1', () => {
    expect(findingsAndExitOf(run())).toStrictEqual({ exitCode: EXIT.findings, findings: ['src/b-mutable-pick.ts:3 functional/prefer-immutable-types'] })
  })
})

describe('check on an overwritable Pick parameter, changed beside a read-only one checked before it', () => {
  const run = setUpRunsBeforeTheSuite((tempProjects) => checkOfChanged(tempProjects, [A_READONLY_PICK, B_MUTABLE_PICK]))

  it('reports the overwritable one, and nothing else, and exits 1', () => {
    expect(findingsAndExitOf(run())).toStrictEqual({ exitCode: EXIT.findings, findings: ['src/b-mutable-pick.ts:3 functional/prefer-immutable-types'] })
  })
})

describe('check on a read-only Pick parameter, changed beside an overwritable one checked before it', () => {
  const run = setUpRunsBeforeTheSuite((tempProjects) => checkOfChanged(tempProjects, [A_MUTABLE_PICK, B_READONLY_PICK]))

  it('reports the overwritable one, and not the read-only one, and exits 1', () => {
    expect(findingsAndExitOf(run())).toStrictEqual({ exitCode: EXIT.findings, findings: ['src/a-mutable-pick.ts:3 functional/prefer-immutable-types'] })
  })
})

describe('check on one changed file holding a read-only Pick parameter, then an overwritable one', () => {
  const run = setUpRunsBeforeTheSuite((tempProjects) => checkOfChanged(tempProjects, [BOTH_PICKS_IN_ONE_FILE]))

  it('reports the overwritable one, and nothing else, and exits 1', () => {
    expect(findingsAndExitOf(run())).toStrictEqual({ exitCode: EXIT.findings, findings: ['src/c-both-in-one-file.ts:8 functional/prefer-immutable-types'] })
  })
})

describe('check on an overwritable Required parameter, changed beside a read-only one checked before it', () => {
  const run = setUpRunsBeforeTheSuite((tempProjects) => checkOfChanged(tempProjects, [A_READONLY_REQUIRED, B_MUTABLE_REQUIRED]))

  it('reports the overwritable one, and nothing else, and exits 1', () => {
    expect(findingsAndExitOf(run())).toStrictEqual({ exitCode: EXIT.findings, findings: ['src/b-mutable-required.ts:3 functional/prefer-immutable-types'] })
  })
})
