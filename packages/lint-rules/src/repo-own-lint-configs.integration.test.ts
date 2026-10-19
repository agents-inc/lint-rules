import { fileURLToPath } from 'node:url'
import { oxlintCliOutputIn } from '@workspace/rule-data/test-support/oxlint-cli'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

// This repo lints itself through the config files at its root, as a team's are written; run `bun run build` first.
const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const A_SOURCE_FILE = 'packages/lint-rules/src/index.ts'
// In a fixture folder holding no config of its own.
const A_TEST_FIXTURE = 'packages/lint-rules/test-fixtures/engines/floating-promises.ts'
// oxlint prints the files it would lint, one per line, then exits.
const LIST_THE_FILES = '--debug=files'
const LINE_END = '\n'

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
