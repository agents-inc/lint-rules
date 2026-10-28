import { describe, expect, it, vi } from 'vitest'

import {
  buildOxlintManifest,
  buildOxlintRuleListing,
  buildOxlintRuleListingWith,
  buildPrintedRuleList,
} from '../__tests__/factories/installed-oxlint-factories.ts'
import { readInstalledEngines } from './read-installed.ts'

// readInstalledEngines reads oxlint's rules from what its CLI prints, and its version and CLI from its package.json.
// Here each test gives both: what the CLI prints through execFile, oxlint's package.json through readFile.

const oxlint = vi.hoisted(() => ({
  printsRuleList: vi.fn<() => Promise<{ readonly stdout: string; readonly stderr: string }>>(),
  manifestHolds: vi.fn<() => Promise<string>>(),
  manifestPathEnd: '/node_modules/oxlint/package.json',
}))

vi.mock('node:child_process', async (importOriginal) => {
  const childProcess = await importOriginal<typeof import('node:child_process')>()
  const { promisify } = await import('node:util')
  // read-installed.ts calls execFile only promisified, so only the promisified form is given.
  return { ...childProcess, execFile: Object.assign(vi.fn(), { [promisify.custom]: oxlint.printsRuleList }) }
})

vi.mock('node:fs/promises', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...fs,
    async readFile(path: string, encoding: BufferEncoding): Promise<string> {
      return path.endsWith(oxlint.manifestPathEnd) ? oxlint.manifestHolds() : fs.readFile(path, encoding)
    },
  }
})

const RULE_LIST_REFUSED = 'oxlint --rules --format=json printed something other than a rule list'
const NO_BIN = "oxlint's package.json has no bin.oxlint"
const NO_VERSION = "oxlint's package.json has no version"
const NOT_AN_OBJECT = "oxlint's package.json is not an object"
const A_VERSION = '9.9.9'
const A_BIN = { oxlint: 'bin/oxlint' }

/** What execFile gives for a run printing the text given. */
function printedOnStdout(text: string): { readonly stdout: string; readonly stderr: string } {
  return { stdout: text, stderr: '' }
}

/** An entry of the rule list that is a rule, as oxlint lists one. */
function aListedRule(): Readonly<Record<string, unknown>> {
  return buildOxlintRuleListing('eslint', 'no-debugger', { typeAware: false, category: 'correctness' })
}

/** oxlint's package.json as an installed oxlint has it: a version, and the CLI under bin. */
function anOxlintManifest(): string {
  return buildOxlintManifest({ version: A_VERSION, bin: A_BIN })
}

describe("readInstalledEngines, on the rule list oxlint's CLI prints", () => {
  it('reads each rule listed: its oxlint name, bare for a core rule, whether it needs types, and its category', async () => {
    oxlint.manifestHolds.mockResolvedValue(anOxlintManifest())
    oxlint.printsRuleList.mockResolvedValue(
      printedOnStdout(buildPrintedRuleList([aListedRule(), buildOxlintRuleListing('typescript', 'no-floating-promises', { typeAware: true, category: 'pedantic' })])),
    )

    expect((await readInstalledEngines()).oxlintRules).toStrictEqual([
      { oxlintName: 'no-debugger', typeAware: false, category: 'correctness' },
      { oxlintName: 'typescript/no-floating-promises', typeAware: true, category: 'pedantic' },
    ])
  })

  it('refuses a printed list that is no array', async () => {
    oxlint.manifestHolds.mockResolvedValue(anOxlintManifest())
    oxlint.printsRuleList.mockResolvedValue(printedOnStdout(buildPrintedRuleList({ rules: [] })))

    await expect(readInstalledEngines()).rejects.toThrow(new Error(RULE_LIST_REFUSED))
  })

  it('refuses an entry that is no object, listed after one that is a rule', async () => {
    oxlint.manifestHolds.mockResolvedValue(anOxlintManifest())
    oxlint.printsRuleList.mockResolvedValue(printedOnStdout(buildPrintedRuleList([aListedRule(), 'no-debugger'])))

    await expect(readInstalledEngines()).rejects.toThrow(new Error(RULE_LIST_REFUSED))
  })

  it.each([
    { field: 'scope', wrong: 'left out', value: undefined },
    { field: 'scope', wrong: 'a number', value: 1 },
    { field: 'value', wrong: 'left out', value: undefined },
    { field: 'value', wrong: 'a number', value: 1 },
    { field: 'type_aware', wrong: 'left out', value: undefined },
    { field: 'type_aware', wrong: 'a string', value: 'false' },
    { field: 'category', wrong: 'left out', value: undefined },
    { field: 'category', wrong: 'a number', value: 1 },
  ])('refuses an entry whose $field is $wrong, listed after one that is a rule', async ({ field, value }) => {
    oxlint.manifestHolds.mockResolvedValue(anOxlintManifest())
    oxlint.printsRuleList.mockResolvedValue(printedOnStdout(buildPrintedRuleList([aListedRule(), buildOxlintRuleListingWith(field, value)])))

    await expect(readInstalledEngines()).rejects.toThrow(new Error(RULE_LIST_REFUSED))
  })
})

describe("readInstalledEngines, on oxlint's package.json", () => {
  it('reads the version it gives, and runs the CLI its bin names', async () => {
    oxlint.manifestHolds.mockResolvedValue(anOxlintManifest())
    oxlint.printsRuleList.mockResolvedValue(printedOnStdout(buildPrintedRuleList([aListedRule()])))

    const installed = await readInstalledEngines()

    expect({ version: installed.versions.oxlint, rules: installed.oxlintRules }).toStrictEqual({
      version: A_VERSION,
      rules: [{ oxlintName: 'no-debugger', typeAware: false, category: 'correctness' }],
    })
  })

  it.each([
    { bin: 'left out', fields: { version: A_VERSION } },
    { bin: 'a path, not an object of commands', fields: { version: A_VERSION, bin: 'bin/oxlint' } },
    { bin: 'an object without oxlint', fields: { version: A_VERSION, bin: {} } },
    { bin: 'an object whose oxlint is no path', fields: { version: A_VERSION, bin: { oxlint: 1 } } },
  ])('refuses a package.json whose bin is $bin', async ({ fields }) => {
    oxlint.manifestHolds.mockResolvedValue(buildOxlintManifest(fields))
    oxlint.printsRuleList.mockResolvedValue(printedOnStdout(buildPrintedRuleList([aListedRule()])))

    await expect(readInstalledEngines()).rejects.toThrow(new Error(NO_BIN))
  })

  it.each([
    { version: 'left out', fields: { bin: A_BIN } },
    { version: 'a number', fields: { version: 9, bin: A_BIN } },
  ])('refuses a package.json whose version is $version', async ({ fields }) => {
    oxlint.manifestHolds.mockResolvedValue(buildOxlintManifest(fields))
    oxlint.printsRuleList.mockResolvedValue(printedOnStdout(buildPrintedRuleList([aListedRule()])))

    await expect(readInstalledEngines()).rejects.toThrow(new Error(NO_VERSION))
  })

  it('refuses a package.json that is no object', async () => {
    oxlint.manifestHolds.mockResolvedValue(buildOxlintManifest('oxlint'))
    oxlint.printsRuleList.mockResolvedValue(printedOnStdout(buildPrintedRuleList([aListedRule()])))

    await expect(readInstalledEngines()).rejects.toThrow(new Error(NOT_AN_OBJECT))
  })
})
