import { describe, expect, it } from 'vitest'
import { EXIT, runCheck } from './__tests__/cli-runs.ts'
import { CONFIG_FILE, checkConfigTextHanding, PACKAGE_JSON_FILE } from './__tests__/factories/check-factories.ts'
import { buildConsumerSettings, GLOBS_GIVEN_FOR_SUPPRESSIONS } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJson, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { createGitProject } from './__tests__/git-projects.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import type { TempProjects } from './__tests__/temp-projects.ts'

/** Committed, so check has nothing changed to lint once the config loads. */
function projectAllowingSuppressionsAs(tempProjects: TempProjects, allowSuppressions: unknown): string {
  const settings = { ...buildConsumerSettings({}), allowSuppressions }
  const files = { [PACKAGE_JSON_FILE]: packageJsonText(buildPackageJson()), [CONFIG_FILE]: checkConfigTextHanding(settings) }
  return createGitProject(tempProjects, { repo: 'committed', files }).dir
}

describe('check, given an allowSuppressions in agents-inc.lint.mts', () => {
  const runs = setUpRunsBeforeTheSuite((tempProjects) => ({
    anObject: runCheck(projectAllowingSuppressionsAs(tempProjects, GLOBS_GIVEN_FOR_SUPPRESSIONS)),
    allowing: runCheck(projectAllowingSuppressionsAs(tempProjects, true)),
  }))

  it('exits 2 where it is an object, printing an error that describes it as one', () => {
    expect(runs().anObject).toStrictEqual({
      exitCode: EXIT.couldNotRun,
      signal: null,
      stdout: '',
      stderr: 'check: could not run: agents-inc.lint.mts: allowSuppressions: an object is not true or false\n',
    })
  })

  it('loads the config where it is true', () => {
    const { exitCode, stderr } = runs().allowing

    expect({ exitCode, stderr }).toStrictEqual({ exitCode: EXIT.clean, stderr: '' })
  })
})
