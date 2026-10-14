import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NOT_LINTED, setUpEslintConfigOracle } from './eslint-config-oracle.ts'
import { buildFakePlugin } from './factories/catalog-factories.ts'
import { buildTeamEslintBlock } from './factories/team-config-factories.ts'
import { setUpTempProjects } from './temp-projects.ts'

// The reading of ESLint's cache key the plugin-identity specs rest on: one that confused two
// namespaces, or dropped a plugin without a name, would let a stale cache entry pass. And the
// reading from a project's own directory the absolute-path specs rest on.

const { calculatedConfigInProjectFor, calculatedRulesOfEach, ruleIdsReportedInProjectByFile, ruleSeverityInProjectFor, serializedPluginsFor } =
  setUpEslintConfigOracle()

const tempProjects = setUpTempProjects()
const PROJECT = tempProjects.create({})

describe('ruleSeverityInProjectFor', () => {
  it("reads a file from the project's directory, so a block whose basePath is an absolute path into it applies there and nowhere else", async () => {
    const config = [
      buildTeamEslintBlock('everywhere', { rules: { 'no-debugger': 'error' } }),
      buildTeamEslintBlock('under-a', { basePath: join(PROJECT, 'packages/a'), rules: { 'no-console': 'warn' } }),
    ]

    expect({
      under: await ruleSeverityInProjectFor(PROJECT, config, 'packages/a/x.js', 'no-console'),
      outside: await ruleSeverityInProjectFor(PROJECT, config, 'packages/b/x.js', 'no-console'),
    }).toStrictEqual({ under: 'warn', outside: undefined })
  })
})

describe('serializedPluginsFor', () => {
  it("gives each namespace its plugin's name and version, the namespace alone for a plugin without a name, and ESLint's own namespace", async () => {
    const config = [
      buildTeamEslintBlock('plugins', {
        files: ['**/*.ts'],
        plugins: {
          react: buildFakePlugin(['jsx-key']),
          'react-hooks': buildFakePlugin(['rules-of-hooks'], { meta: { name: 'hooks-plugin', version: '1.2.3' } }),
        },
      }),
    ]

    expect(await serializedPluginsFor(config, 'src/a.ts')).toStrictEqual({
      '@': '@',
      react: 'react',
      'react-hooks': 'react-hooks:hooks-plugin@1.2.3',
    })
  })
})

// The differential reads every entry through this: a file read as linted with no rule where ESLint
// lints none, or the other way round, would hide our global ignores silencing a team's rules.
describe('calculatedRulesOfEach', () => {
  it('gives each file its entries, options filled in; none where no block that applies sets a rule; and NOT_LINTED where a global ignore matches', async () => {
    const config = [
      buildTeamEslintBlock('ignored', { ignores: ['vendor/**'] }),
      buildTeamEslintBlock('every-ts-file', { files: ['**/*.ts'] }),
      buildTeamEslintBlock('legacy', { files: ['legacy/**'], rules: { 'no-console': ['error', { allow: ['warn'] }], curly: 'off' } }),
    ]

    expect(await calculatedRulesOfEach(config, ['legacy/a.ts', 'src/a.ts', 'vendor/a.ts'])).toStrictEqual({
      'legacy/a.ts': { 'no-console': [2, { allow: ['warn'] }], curly: [0, 'all'] },
      'src/a.ts': {},
      'vendor/a.ts': NOT_LINTED,
    })
  })
})

describe('calculatedConfigInProjectFor', () => {
  it("reads a file from the project's directory, so a block whose basePath is an absolute path into it applies there and nowhere else", async () => {
    const config = [buildTeamEslintBlock('under-a', { basePath: join(PROJECT, 'packages/a'), files: ['**/*.js'], rules: { 'no-console': 'warn' } })]

    expect({
      under: (await calculatedConfigInProjectFor(PROJECT, config, 'packages/a/x.js'))?.rules?.['no-console'],
      outside: (await calculatedConfigInProjectFor(PROJECT, config, 'packages/b/x.js'))?.rules?.['no-console'],
    }).toStrictEqual({ under: [1, {}], outside: undefined })
  })
})

// The folder-style ignores and typed-takeover specs read what ESLint reports on a project's own
// files: one that listed a file a global ignore matches, or dropped a parse error, would hide our
// rules running where the agent build lets none run, or a typed rule ending the run.
describe('ruleIdsReportedInProjectByFile', () => {
  const projectDir = tempProjects.create({
    files: { 'src/a.js': 'debugger\n', 'src/b.js': 'const = 1\n', 'vendor/a.js': 'debugger\n', 'src/notes.md': 'debugger\n' },
  })

  it("gives each file ESLint lints in the project its rule IDs, null for a parse error, and leaves out a file a global ignore matches and one no block's files match", async () => {
    const config = [
      buildTeamEslintBlock('ignored', { ignores: ['vendor/**'] }),
      buildTeamEslintBlock('every-js-file', { files: ['**/*.js'], rules: { 'no-debugger': 'error' } }),
    ]

    expect(await ruleIdsReportedInProjectByFile(projectDir, config)).toStrictEqual({ 'src/a.js': ['no-debugger'], 'src/b.js': [null] })
  })
})
