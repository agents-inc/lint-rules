import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type RunnerTestFile, TestRunner } from 'vitest'

const TEST_FILE_TEMP_DIR_PREFIX = 'lint-rules-test-file-'
// The variable os.tmpdir() reads on Linux and macOS, and every process a test starts inherits.
const TEMP_DIR_VARIABLE = 'TMPDIR'

/**
 * Vitest's runner, giving each test file a temp dir of its own and removing it once the file
 * finishes, however it ends. Vitest runs a suite's `afterAll` only where the suite runs, so a folder
 * made while a file is collected outlived a file that failed to load, and a suite that a name filter
 * or a bail skipped, as Stryker runs each mutant.
 *
 * It needs a worker for each test file, vitest's default: with `--no-isolate` the next file in a
 * worker is collected in the dir just removed, and fails to load.
 *
 * The package's vitest config names this module: vitest loads a runner by its default export.
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
