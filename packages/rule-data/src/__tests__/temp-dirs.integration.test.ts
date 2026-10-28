import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  buildTestFileReadingTheTempDirWhileCollected,
  buildTestFileRecordingTheTempDir,
  buildTestFileSettingUpATempDir,
  buildTestFileThrowingWhileCollected,
  buildVitestConfig,
  buildVitestConfigUnderTheRunner,
} from './factories/vitest-project-factories.ts'

// Every test file of rule-data and lint-rules runs under temp-dir-per-test-file.ts, and many suites set up
// a folder with temp-dirs.ts: each is checked here by a vitest run of its own, which can be seen ending.

type VitestRun = { readonly exitCode: number | null; readonly output: string }

const RUNNER_PATH = fileURLToPath(new URL('temp-dir-per-test-file.ts', import.meta.url))
const TEMP_DIRS_MODULE = new URL('temp-dirs.ts', import.meta.url).href
const CONFIG_FILE = 'vitest.config.mjs'
const TEST_FILE = 'under-test.test.mjs'
const RECORD_FILE = 'recorded-path'
const PROJECT_PREFIX = 'vitest-project-'
const RECORDS_PREFIX = 'records-'
// The prefix temp-dir-per-test-file.ts names each test file's temp dir with.
const RUNNER_PREFIX = 'lint-rules-test-file-'
const SUITE_PREFIX = 'suite-folder-'
const COLLECT_TIME_MESSAGE = 'thrown while the test file was collected'
const READ_TOO_EARLY_MESSAGE = `the temp dir made from ${SUITE_PREFIX} was read outside the suite that set it up`
const RUN_TIMEOUT_MS = 60_000

/** Where a test file of a project records a path, outside the project, in this test file's temp dir. */
function recordPathOfItsOwn(): string {
  return join(mkdtempSync(join(tmpdir(), RECORDS_PREFIX)), RECORD_FILE)
}

/** A vitest project of its own in this test file's temp dir, holding the config and the one test file given. */
function vitestProjectHolding({ config, testFile }: { readonly config: string; readonly testFile: string }): string {
  const projectDir = mkdtempSync(join(tmpdir(), PROJECT_PREFIX))
  writeFileSync(join(projectDir, CONFIG_FILE), config)
  writeFileSync(join(projectDir, TEST_FILE), testFile)
  return projectDir
}

/** `vitest run` over the project, in a Node process of its own, which has ended once this returns. */
function vitestRunIn(projectDir: string): VitestRun {
  const vitestCli = join(dirname(createRequire(import.meta.url).resolve('vitest/package.json')), 'vitest.mjs')
  const { status, stdout, stderr } = spawnSync(process.execPath, [vitestCli, 'run', '--root', projectDir, '--config', join(projectDir, CONFIG_FILE)], {
    cwd: projectDir,
    encoding: 'utf8',
  })
  return { exitCode: status, output: `${stdout}${stderr}` }
}

describe('temp-dir-per-test-file.ts, the runner every test file here runs under', () => {
  it(
    'gives a test file a temp dir of its own as os.tmpdir(), inside the one the run was given, and removes it once the file has run',
    () => {
      const recordPath = recordPathOfItsOwn()
      const projectDir = vitestProjectHolding({ config: buildVitestConfigUnderTheRunner(RUNNER_PATH), testFile: buildTestFileRecordingTheTempDir(recordPath) })

      expect(vitestRunIn(projectDir).exitCode).toBe(0)
      const given = readFileSync(recordPath, 'utf8')
      expect({ madeIn: dirname(given), named: basename(given).startsWith(RUNNER_PREFIX), left: existsSync(given) }).toStrictEqual({
        madeIn: tmpdir(),
        named: true,
        left: false,
      })
    },
    RUN_TIMEOUT_MS,
  )

  it(
    'removes the temp dir of a test file that throws while it is collected',
    () => {
      const recordPath = recordPathOfItsOwn()
      const projectDir = vitestProjectHolding({
        config: buildVitestConfigUnderTheRunner(RUNNER_PATH),
        testFile: buildTestFileThrowingWhileCollected(recordPath, COLLECT_TIME_MESSAGE),
      })

      const run = vitestRunIn(projectDir)

      expect(run.output).toContain(COLLECT_TIME_MESSAGE)
      expect(run.exitCode).toBe(1)
      const given = readFileSync(recordPath, 'utf8')
      expect({ named: basename(given).startsWith(RUNNER_PREFIX), left: existsSync(given) }).toStrictEqual({ named: true, left: false })
    },
    RUN_TIMEOUT_MS,
  )
})

describe('setUpTempDir', () => {
  it(
    "gives the suite's tests a folder made with the prefix given, and removes it once the suite has run",
    () => {
      const recordPath = recordPathOfItsOwn()
      const projectDir = vitestProjectHolding({ config: buildVitestConfig(), testFile: buildTestFileSettingUpATempDir(TEMP_DIRS_MODULE, SUITE_PREFIX, recordPath) })

      expect(vitestRunIn(projectDir).exitCode).toBe(0)
      const given = readFileSync(recordPath, 'utf8')
      expect({ named: basename(given).startsWith(SUITE_PREFIX), left: existsSync(given) }).toStrictEqual({ named: true, left: false })
    },
    RUN_TIMEOUT_MS,
  )

  it(
    'throws, naming the prefix, where the folder is read before the suite has made it',
    () => {
      const projectDir = vitestProjectHolding({ config: buildVitestConfig(), testFile: buildTestFileReadingTheTempDirWhileCollected(TEMP_DIRS_MODULE, SUITE_PREFIX) })

      const run = vitestRunIn(projectDir)

      expect(run.output).toContain(READ_TOO_EARLY_MESSAGE)
      expect(run.exitCode).toBe(1)
    },
    RUN_TIMEOUT_MS,
  )
})
