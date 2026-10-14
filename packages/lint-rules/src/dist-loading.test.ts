import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildEveryRulesetLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { INSTALLED_OXLINT, setUpTempProjects } from './__tests__/temp-projects.ts'

// The parts are data, so a team's oxlint config, which imports agents-inc.lint.mts and our
// oxlint merge, loads nothing of ESLint's side; only importing the ESLint merge entry loads the
// plugins, which takes seconds. A child process loads the built package and records every module
// it resolves. Reads the build output, so `turbo test` builds this package first.

allowEveryTestForParallelLoad()

type Step = 'oxlint-side' | 'eslint-entry'

const DIST_DIR = fileURLToPath(new URL('../dist', import.meta.url))
const RECORDER = fileURLToPath(new URL('./__tests__/record-resolved-modules.ts', import.meta.url))
const RECORD_FILE = 'resolved-modules.json'
const ESLINT_SIDE_PACKAGE =
  /\/node_modules\/(?:eslint|typescript-eslint|typescript|@typescript-eslint|eslint-plugin-[^/]+|@eslint-react|@eslint|@vitest|globals)\//u
const AN_ESLINT_PLUGIN = '/node_modules/eslint-plugin-unicorn/'
// @vitest/eslint-plugin is one of our ESLint plugins, and typescript is what typescript-eslint parses
// and type-checks with: both are ESLint-side, so the guard names them.
const PACKAGES_THE_GUARD_NAMES_TOO = ['/node_modules/@vitest/eslint-plugin/', '/node_modules/typescript/']
const OXLINT_SIDE_ENTRIES = ['/dist/index.mjs', '/dist/oxlint.mjs']

const tempProjects = setUpTempProjects()
const PROJECT_WITH_OXLINT = tempProjects.create({
  files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()) },
  linkedPackages: [INSTALLED_OXLINT],
})

/** Runs the recorder for the step in a Node process of its own and reads back every URL it resolved. */
function modulesResolvedBy(step: Step): string[] {
  const recordDir = tempProjects.create({})
  const recordFile = join(recordDir, RECORD_FILE)
  const lintRulesJson = JSON.stringify(buildEveryRulesetLintRules(PROJECT_WITH_OXLINT))
  const { status, stderr } = spawnSync(process.execPath, [RECORDER, recordFile, DIST_DIR, step, lintRulesJson], {
    encoding: 'utf8',
  })
  if (status !== 0) throw new Error(`the recorder failed at ${step} (exit ${String(status)}): ${stderr}`)
  // Parse boundary: the recorder's own output.
  return JSON.parse(readFileSync(recordFile, 'utf8')) as string[]
}

describe('loading the built package', () => {
  it("as a team's oxlint config does, defining the lint rules, reading both parts and merging the oxlint one, resolves nothing of ESLint's side", () => {
    const resolved = modulesResolvedBy('oxlint-side')

    expect({
      entriesLoaded: OXLINT_SIDE_ENTRIES.filter((entry) => resolved.some((url) => url.endsWith(entry))),
      eslintSide: resolved.filter((url) => ESLINT_SIDE_PACKAGE.test(url)),
    }).toStrictEqual({ entriesLoaded: OXLINT_SIDE_ENTRIES, eslintSide: [] })
  })

  it('through the ESLint merge entry resolves the ESLint plugins', () => {
    expect(modulesResolvedBy('eslint-entry').some((url) => url.includes(AN_ESLINT_PLUGIN))).toBe(true)
  })

  it('through the ESLint merge entry resolves @vitest/eslint-plugin and typescript, each a package the guard counts as ESLint-side', () => {
    const eslintSide = modulesResolvedBy('eslint-entry').filter((url) => ESLINT_SIDE_PACKAGE.test(url))

    expect(PACKAGES_THE_GUARD_NAMES_TOO.filter((path) => eslintSide.some((url) => url.includes(path)))).toStrictEqual(
      PACKAGES_THE_GUARD_NAMES_TOO,
    )
  })
})
