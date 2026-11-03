import { describe, expect, it } from 'vitest'
import { eslintLintedFilesOf, setUpConsumerEslintCliRun } from './consumer-cli-runs.ts'
import { CONSUMER_CONFIG_FILES, EMPTY_TEAM_ESLINT_MODULE_FILE, projectMergingOurEslintPartText } from './factories/consumer-project-factories.ts'
import { moduleThrowingAStringText } from './factories/failing-config-module-factories.ts'
import { buildConsumerSettings, CORRECTNESS_IN_BOTH_SETS } from './factories/lint-rules-factories.ts'
import { buildPackageJson, packageJsonText } from './factories/package-json-factories.ts'
import { allowEveryTestForParallelLoad } from './parallel-load.ts'

allowEveryTestForParallelLoad()

const FILES = {
  module: 'src/one.js',
  nestedModule: 'src/nested/two.mjs',
  markdown: 'notes.md',
  json: 'src/data.json',
} as const

const sources = {
  [FILES.module]: 'export const one = 1\n',
  [FILES.nestedModule]: 'export const two = 2\n',
  [FILES.markdown]: '# Notes\n',
  [FILES.json]: '{}\n',
}

const CONFIG_LOAD_FAILURE = 'the ESLint config could not be loaded'

describe('a project of two JS modules, a Markdown file and a JSON file, our correctness ruleset merged into an empty team ESLint config, linted by the ESLint CLI through the built package', () => {
  const run = setUpConsumerEslintCliRun({
    'package.json': packageJsonText(buildPackageJson()),
    ...projectMergingOurEslintPartText({
      settings: buildConsumerSettings(CORRECTNESS_IN_BOTH_SETS),
      team: EMPTY_TEAM_ESLINT_MODULE_FILE,
      teamOxlint: 'setting no rule',
    }),
    ...sources,
  })

  it('lists each file the CLI linted by its path in the project, the configs included, and no Markdown or JSON file', () => {
    expect(eslintLintedFilesOf(run())).toStrictEqual(
      [CONSUMER_CONFIG_FILES.lintRules, CONSUMER_CONFIG_FILES.eslint, EMPTY_TEAM_ESLINT_MODULE_FILE.file, FILES.module, FILES.nestedModule].toSorted(),
    )
  })
})

describe('a project whose ESLint config throws as it loads, linted by the ESLint CLI', () => {
  const run = setUpConsumerEslintCliRun({
    'package.json': packageJsonText(buildPackageJson()),
    [CONSUMER_CONFIG_FILES.eslint]: moduleThrowingAStringText(CONFIG_LOAD_FAILURE),
    [FILES.module]: sources[FILES.module],
  })

  it('throws where its linted files are read, naming the project, rather than listing none', () => {
    expect(() => eslintLintedFilesOf(run())).toThrow(`ESLint could not run on ${run().projectDir}: `)
  })
})
