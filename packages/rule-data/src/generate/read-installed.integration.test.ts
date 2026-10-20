import { spawnSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { buildOxlintConfigModuleThrowing } from '../__tests__/factories/oxlint-config-factories.ts'
import { setUpTempDir } from '../__tests__/temp-dirs.ts'
import { readInstalledEngines } from './read-installed.ts'

type NodeRun = { readonly exitCode: number | null; readonly stdout: string; readonly stderr: string }

const READ_INSTALLED_MODULE = new URL('./read-installed.ts', import.meta.url).href
// A name oxlint looks for in the folder it runs from and in each folder above it (measured, oxlint 1.87).
const OXLINT_CONFIG_FILE = 'oxlint.config.mts'
const FOLDER_BELOW_THE_CONFIG = 'below'
// Prints the oxlint rules the module named in its one argument reads, as JSON.
const PRINT_THE_OXLINT_RULES_READ = 'const { readInstalledEngines } = await import(process.argv[1]); console.log(JSON.stringify((await readInstalledEngines()).oxlintRules))'
// Node 23 warns on stderr that type stripping is experimental; the read is under test, not that notice.
const NO_EXPERIMENTAL_WARNING = '--disable-warning=ExperimentalWarning'
const READ_TIMEOUT_MS = 120_000

/** A folder inside the one given, which holds an oxlint config that throws when loaded. */
async function folderBelowAnOxlintConfigThatCannotLoad(dir: string): Promise<string> {
  await writeFile(join(dir, OXLINT_CONFIG_FILE), buildOxlintConfigModuleThrowing('an oxlint config that cannot load was loaded'))
  const folderBelow = join(dir, FOLDER_BELOW_THE_CONFIG)
  await mkdir(folderBelow)
  return folderBelow
}

/** The oxlint rules read in a Node process of its own, run from the folder given, as `generate` reads them wherever it is run. */
function oxlintRulesReadIn(cwd: string): NodeRun {
  const { status, stdout, stderr } = spawnSync(process.execPath, [NO_EXPERIMENTAL_WARNING, '--input-type=module', '--eval', PRINT_THE_OXLINT_RULES_READ, READ_INSTALLED_MODULE], {
    cwd,
    encoding: 'utf8',
  })
  return { exitCode: status, stdout, stderr }
}

// `oxlint --rules` loads the nearest oxlint config it finds, and exits 1 where that config cannot load: this
// repo's own imports lint-rules' dist, which a build rewrites while rule-data's tests run.
describe('the oxlint rules read below a folder holding an oxlint config that cannot load', () => {
  const tempDir = setUpTempDir('rule-data-read-installed-')

  it(
    'are the rules read from this package, that config left unread',
    async () => {
      const folderBelow = await folderBelowAnOxlintConfigThatCannotLoad(tempDir())
      const readFromThisPackage = (await readInstalledEngines()).oxlintRules

      expect(oxlintRulesReadIn(folderBelow)).toStrictEqual({ exitCode: 0, stdout: `${JSON.stringify(readFromThisPackage)}\n`, stderr: '' })
    },
    READ_TIMEOUT_MS,
  )
})
