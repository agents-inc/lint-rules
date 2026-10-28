// The files of a vitest project run in a process of its own, for the tests of the temp-dir helpers every
// suite here runs under. Its test files use vitest's globals and node's own modules alone, so they load
// from a folder outside the repo; temp-dirs.ts, named by its URL, finds vitest from where it lies.

const TEST_FILES = '*.test.mjs'

/** A vitest config running the test files beside it under the runner given, by its path. */
export function buildVitestConfigUnderTheRunner(runnerPath: string): string {
  return `export default { test: { include: [${JSON.stringify(TEST_FILES)}], globals: true, runner: ${JSON.stringify(runnerPath)} } }\n`
}

/** A vitest config running the test files beside it under vitest's own runner. */
export function buildVitestConfig(): string {
  return `export default { test: { include: [${JSON.stringify(TEST_FILES)}], globals: true } }\n`
}

/** A test file whose one test finds os.tmpdir() there and writes its path into the file given. */
export function buildTestFileRecordingTheTempDir(recordPath: string): string {
  return [
    "import { existsSync, writeFileSync } from 'node:fs'",
    "import { tmpdir } from 'node:os'",
    '',
    "it('records the temp dir it is given', () => {",
    '  expect(existsSync(tmpdir())).toBe(true)',
    `  writeFileSync(${JSON.stringify(recordPath)}, tmpdir())`,
    '})',
    '',
  ].join('\n')
}

/** A test file that writes the path of os.tmpdir() into the file given, then throws while it is collected. */
export function buildTestFileThrowingWhileCollected(recordPath: string, message: string): string {
  return [
    "import { writeFileSync } from 'node:fs'",
    "import { tmpdir } from 'node:os'",
    '',
    `writeFileSync(${JSON.stringify(recordPath)}, tmpdir())`,
    `throw new Error(${JSON.stringify(message)})`,
    '',
  ].join('\n')
}

/** A test file whose suite sets up a temp folder with setUpTempDir; its test finds the folder there and writes its path into the file given. */
export function buildTestFileSettingUpATempDir(tempDirsModule: string, prefix: string, recordPath: string): string {
  return [
    "import { existsSync, writeFileSync } from 'node:fs'",
    '',
    `const { setUpTempDir } = await import(${JSON.stringify(tempDirsModule)})`,
    '',
    "describe('a suite with a temp folder', () => {",
    `  const tempDir = setUpTempDir(${JSON.stringify(prefix)})`,
    '',
    "  it('records the folder it is given', () => {",
    '    expect(existsSync(tempDir())).toBe(true)',
    `    writeFileSync(${JSON.stringify(recordPath)}, tempDir())`,
    '  })',
    '})',
    '',
  ].join('\n')
}

/** A test file whose suite reads the folder setUpTempDir gives while vitest collects it, before any hook has run. */
export function buildTestFileReadingTheTempDirWhileCollected(tempDirsModule: string, prefix: string): string {
  return [
    `const { setUpTempDir } = await import(${JSON.stringify(tempDirsModule)})`,
    '',
    "describe('a suite reading its temp folder too early', () => {",
    `  const tempDir = setUpTempDir(${JSON.stringify(prefix)})`,
    '  tempDir()',
    '',
    "  it('never runs', () => {})",
    '})',
    '',
  ].join('\n')
}
