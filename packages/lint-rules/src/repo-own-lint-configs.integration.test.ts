import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { oxlintCliOutputIn } from '@workspace/rule-data/test-support/oxlint-cli'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'
import { findingsInFile } from './__tests__/check-output.ts'
import { EXIT, runCheck } from './__tests__/cli-runs.ts'
import { CONFIG_FILE, DEBUGGER_STATEMENT, exportedConstant, moduleText } from './__tests__/factories/check-factories.ts'
import { buildPackageJson, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { createGitProject } from './__tests__/git-projects.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { PACKAGE_JSON } from './core/package-json-files.ts'

// This repo lints itself through the config files at its root, as a team's are written; run `bun run build` first.

allowEveryTestForParallelLoad()

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const A_SOURCE_FILE = 'packages/lint-rules/src/index.ts'
// In a fixture folder holding no config of its own.
const A_TEST_FIXTURE = 'packages/lint-rules/test-fixtures/engines/floating-promises.ts'
// oxlint prints the files it would lint, one per line, then exits.
const LIST_THE_FILES = '--debug=files'
const LINE_END = '\n'
// In the folder the agents-inc CLI writes.
const A_FILE_THE_AGENTS_INC_CLI_WRITES = '.agents-inc/claude/config.ts'
const A_PROJECT_SOURCE_FILE = 'src/a.ts'
// A module, and the line the agent adds to it, which no-debugger reports.
const A_MODULE = moduleText(exportedConstant('value'))
const A_DEBUGGER_STATEMENT = moduleText(DEBUGGER_STATEMENT)

describe("this repo's own lint configs, read from its root", () => {
  it('ESLint finds eslint.config.mjs: it lints a source file and leaves the test fixtures out', async () => {
    const eslint = new ESLint({ cwd: REPO_ROOT })

    expect({ source: await eslint.isPathIgnored(A_SOURCE_FILE), fixture: await eslint.isPathIgnored(A_TEST_FIXTURE) }).toStrictEqual({ source: false, fixture: true })
  })

  it('oxlint finds oxlint.config.mts: it lints a source file and leaves the test fixtures out', () => {
    const { exitCode, stdout } = oxlintCliOutputIn(REPO_ROOT, [LIST_THE_FILES, A_SOURCE_FILE, A_TEST_FIXTURE])

    expect({ exitCode, files: stdout.split(LINE_END).filter((line) => line !== '') }).toStrictEqual({ exitCode: 0, files: [A_SOURCE_FILE] })
  })
})

// `check` runs the agent set, which reads the ignores of agents-inc.lint.mts alone, so it runs from a project holding a copy.
describe("check, under a copy of this repo's own agents-inc.lint.mts", () => {
  const checkRun = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, {
      repo: 'committed',
      files: {
        [PACKAGE_JSON]: packageJsonText(buildPackageJson()),
        [CONFIG_FILE]: readFileSync(join(REPO_ROOT, CONFIG_FILE), 'utf8'),
        [A_FILE_THE_AGENTS_INC_CLI_WRITES]: A_MODULE,
        [A_PROJECT_SOURCE_FILE]: A_MODULE,
      },
    })
    project.append(A_FILE_THE_AGENTS_INC_CLI_WRITES, A_DEBUGGER_STATEMENT)
    project.append(A_PROJECT_SOURCE_FILE, A_DEBUGGER_STATEMENT)
    return runCheck(project.dir)
  })

  it('leaves a changed line in the folder the agents-inc CLI writes unchecked, and reports one in a source file', () => {
    const { exitCode, stdout } = checkRun()

    expect({
      exitCode,
      inTheFolder: findingsInFile(stdout, A_FILE_THE_AGENTS_INC_CLI_WRITES),
      inTheSource: findingsInFile(stdout, A_PROJECT_SOURCE_FILE),
    }).toStrictEqual({ exitCode: EXIT.findings, inTheFolder: [], inTheSource: [`${A_PROJECT_SOURCE_FILE}:2 no-debugger`] })
  })
})
