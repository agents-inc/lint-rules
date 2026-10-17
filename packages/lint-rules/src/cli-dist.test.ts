import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { findingsIn } from './__tests__/check-output.ts'
import { CLI_FILE, EXIT, setUpCheckAfterTheAgent } from './__tests__/cli-runs.ts'
import { checkedPackageFiles, DEBUGGER_STATEMENT, exportedConstant, moduleText, REDUNDANCY } from './__tests__/factories/check-factories.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'

// Reads the build output, so `turbo test` builds this package first.

allowEveryTestForParallelLoad()

const PACKAGE_DIR = fileURLToPath(new URL('..', import.meta.url))
const SHEBANG = '#!/usr/bin/env node'

type BinManifest = { readonly bin?: unknown }

function readManifest(): BinManifest {
  // Parse boundary: this package's own manifest.
  return JSON.parse(readFileSync(join(PACKAGE_DIR, 'package.json'), 'utf8')) as BinManifest
}

describe('the bin entry', () => {
  it('is agents-inc-lint, and only it, pointing at dist/cli.mjs (M-1)', () => {
    expect(readManifest().bin).toStrictEqual({ 'agents-inc-lint': './dist/cli.mjs' })
  })

  it('is built, and starts with the line that has a shell run it with Node (M-1)', () => {
    expect({ built: existsSync(CLI_FILE), firstLine: existsSync(CLI_FILE) ? readFileSync(CLI_FILE, 'utf8').split('\n')[0] : null }).toStrictEqual({
      built: true,
      firstLine: SHEBANG,
    })
  })
})

describe('the bin entry and the package entry a config imports (K-21)', () => {
  const run = setUpCheckAfterTheAgent(checkedPackageFiles(REDUNDANCY), (project) => {
    project.write('src/a.ts', moduleText(exportedConstant('a'), DEBUGGER_STATEMENT))
  })

  // agents-inc.lint.mts imports dist/index.mjs, whose defineLintRules records the agent settings; the
  // bin reads them back by the part the file exports, so both must share the one registry module.
  it('share one registry: check finds the agent settings of a config dist/index.mjs defined, and lints with them', () => {
    const { exitCode, stdout, stderr } = run()

    expect({ exitCode, findings: findingsIn(stdout), stderr }).toStrictEqual({ exitCode: EXIT.findings, findings: ['src/a.ts:2 no-debugger'], stderr: '' })
  })
})
