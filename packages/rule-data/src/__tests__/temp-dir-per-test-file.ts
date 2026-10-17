import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type RunnerTestFile, TestRunner } from 'vitest'

const TEST_FILE_TEMP_DIR_PREFIX = 'lint-rules-test-file-'
// The variable os.tmpdir() reads on Linux and macOS, and every process a test starts inherits.
const TEMP_DIR_VARIABLE = 'TMPDIR'

/**
 * Gives each test file a temp dir of its own, removed however the file ends: a suite's `afterAll` runs
 * only where the suite runs, so a file that failed to load or was skipped (as Stryker runs each mutant)
 * left its folder behind. Needs a worker per test file, vitest's default: under `--no-isolate` the next
 * file is collected in the dir just removed. Default-exported: vitest loads a runner that way.
 */
export default class TempDirPerTestFileRunner extends TestRunner {
  #testFileTempDir: string | undefined

  onBeforeCollect(): void {
    this.#testFileTempDir = mkdtempSync(join(tmpdir(), TEST_FILE_TEMP_DIR_PREFIX))
    process.env[TEMP_DIR_VARIABLE] = this.#testFileTempDir
  }

  override onAfterRunFiles(files: RunnerTestFile[]): void {
    super.onAfterRunFiles(files)
    if (this.#testFileTempDir === undefined) throw new Error('the test file finished without the temp dir given it before it was collected')
    rmSync(this.#testFileTempDir, { recursive: true })
  }
}
