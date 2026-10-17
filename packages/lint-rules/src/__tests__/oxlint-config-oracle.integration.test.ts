import type { OxlintConfig } from 'oxlint'
import { describe, expect, it } from 'vitest'
import { FOLDER_LAYOUT_FILES, FOLDER_LAYOUT_JS_FILES, folderLayoutSourceFiles } from './cases/oxlint-folder-layout.ts'
import { oxlintFindingsIn, runOxlintCli, writeOxlintConfigFile } from './engine-clis.ts'
import { buildTeamOxlintConfig } from './factories/team-config-factories.ts'
import { isIgnoredByOxlintConfig, oxlintConfigForFile, oxlintSeverityFor } from './oxlint-config-oracle.ts'
import { allowEveryTestForParallelLoad } from './parallel-load.ts'
import { INSTALLED_OXLINT, setUpTempProjects } from './temp-projects.ts'

// The oracle the merge specs read configs through, against the real oxlint CLI: a reading oxlint does not share
// would let a merge defect through.

const NO_DEBUGGER = 'no-debugger'
const NO_DEBUGGER_CODE = 'eslint(no-debugger)'
const NO_UNDEF_CODE = 'eslint(no-undef)'
const EVERY_CATEGORY_OFF = { correctness: 'off' } as const satisfies OxlintConfig['categories']

const PROJECT = setUpTempProjects().create({ files: folderLayoutSourceFiles, linkedPackages: [INSTALLED_OXLINT] })

allowEveryTestForParallelLoad()

function filesOxlintReports(file: string, config: OxlintConfig, code: string): string[] {
  writeOxlintConfigFile(PROJECT, file, config)
  const findings = oxlintFindingsIn(runOxlintCli(PROJECT, file).report).filter(({ rule }) => rule === code)
  return [...new Set(findings.map((finding) => finding.file))].toSorted()
}

function ignoringConfig(pattern: string): OxlintConfig {
  return buildTeamOxlintConfig({ categories: EVERY_CATEGORY_OFF, ignorePatterns: [pattern], rules: { [NO_DEBUGGER]: 'error' } })
}

function overrideConfig(override: Omit<NonNullable<OxlintConfig['overrides']>[number], 'rules'>): OxlintConfig {
  return buildTeamOxlintConfig({ categories: EVERY_CATEGORY_OFF, overrides: [{ ...override, rules: { [NO_DEBUGGER]: 'error' } }] })
}

function noUndefConfig(fields: OxlintConfig): OxlintConfig {
  return buildTeamOxlintConfig({ categories: EVERY_CATEGORY_OFF, rules: { 'no-undef': 'error' }, ...fields })
}

function nameOf(text: string): string {
  return text.replaceAll(/[^a-z0-9]+/giu, '-')
}

describe("isIgnoredByOxlintConfig, against the files the real oxlint CLI lints with a config's ignorePatterns", () => {
  it.each(['generated', 'legacy/', '**/gen', 'vendor/**', 'a.js', 'a.js/', 'dist/**'])('reads %s as oxlint does', (pattern) => {
    const config = ignoringConfig(pattern)

    expect(FOLDER_LAYOUT_FILES.filter((file) => !isIgnoredByOxlintConfig(config, file))).toStrictEqual(
      filesOxlintReports(`ignore-${nameOf(pattern)}.config.mjs`, config, NO_DEBUGGER_CODE),
    )
  })
})

describe("oxlintConfigForFile, against the files the real oxlint CLI applies an override's globs to", () => {
  it.each([
    { how: 'files a.js', override: { files: ['a.js'] } },
    { how: 'files *.ts', override: { files: ['*.ts'] } },
    { how: 'files src/*.js', override: { files: ['src/*.js'] } },
    { how: 'files ./src/**', override: { files: ['./src/**'] } },
    { how: 'files generated', override: { files: ['generated'] } },
    { how: 'files gen*/**', override: { files: ['gen*/**'] } },
    { how: 'files **/gen/**', override: { files: ['**/gen/**'] } },
    { how: 'every file but a.js', override: { files: ['**/*'], excludeFiles: ['a.js'] } },
    { how: 'every file but legacy/', override: { files: ['**/*'], excludeFiles: ['legacy/'] } },
    { how: 'every file but vendor/**', override: { files: ['**/*'], excludeFiles: ['vendor/**'] } },
  ])('reads $how as oxlint does', ({ how, override }) => {
    const config = overrideConfig(override)

    expect(FOLDER_LAYOUT_FILES.filter((file) => oxlintSeverityFor(config, file, NO_DEBUGGER) === 'error')).toStrictEqual(
      filesOxlintReports(`override-${nameOf(how)}.config.mjs`, config, NO_DEBUGGER_CODE),
    )
  })
})

// An extended config's root env reaches no file; the env of its overrides does (measured, oxlint 1.87).
describe('oxlintConfigForFile, against the env the real oxlint CLI gives a file, by where a config sets it', () => {
  it.each([
    { where: 'at its own root', config: noUndefConfig({ env: { browser: true } }) },
    { where: 'at the root of a config it extends', config: noUndefConfig({ extends: [{ env: { browser: true } }] }) },
    { where: 'in an override of its own', config: noUndefConfig({ overrides: [{ files: ['src/**'], env: { browser: true } }] }) },
    {
      where: 'in an override of a config it extends',
      config: noUndefConfig({ extends: [{ overrides: [{ files: ['src/**'], env: { browser: true } }] }] }),
    },
  ])('reads the browser env set $where as oxlint does: no-undef reports window where it is not set', ({ where, config }) => {
    expect(FOLDER_LAYOUT_JS_FILES.filter((file) => oxlintConfigForFile(config, file).env['browser'] !== true).toSorted()).toStrictEqual(
      filesOxlintReports(`env-${nameOf(where)}.config.mjs`, config, NO_UNDEF_CODE),
    )
  })
})
