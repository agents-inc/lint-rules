import type { OxlintConfig } from 'oxlint'
import { describe, expect, it } from 'vitest'
import { isIgnoredByOxlintConfig, oxlintConfigForFile, oxlintEntryOfRuleFor, oxlintSeverityFor, severityOfOxlintEntry } from './oxlint-config-oracle.ts'

const OFF = 0
const WARN = 1
const ERROR = 2

const config: OxlintConfig = {
  env: { builtin: true, node: true, browser: true },
  rules: { eqeqeq: ['error', 'always'], 'no-debugger': ['error'] },
  overrides: [
    { files: ['apps/**'], env: { browser: false }, rules: { 'no-debugger': 'off' } },
    { files: ['apps/web/**'], env: { browser: true, node: false }, rules: { 'no-debugger': ['warn'] } },
    { files: ['apps/**'], excludeFiles: ['**/*.test.ts'], rules: { eqeqeq: ['warn', 'smart'] } },
  ],
}

describe('oxlintConfigForFile', () => {
  it('applies the top-level rules and env to a file no override matches', () => {
    expect(oxlintConfigForFile(config, 'libs/a.ts')).toStrictEqual({
      env: { builtin: true, node: true, browser: true },
      rules: { eqeqeq: ['error', 'always'], 'no-debugger': ['error'] },
    })
  })

  it('applies every override matching the file in order, so the later one wins, and merges env per key', () => {
    expect(oxlintConfigForFile(config, 'apps/web/a.ts')).toStrictEqual({
      env: { builtin: true, node: false, browser: true },
      rules: { eqeqeq: ['warn', 'smart'], 'no-debugger': ['warn'] },
    })
  })

  it('skips an override whose excludeFiles match the file', () => {
    expect(oxlintConfigForFile(config, 'apps/api/a.test.ts')).toStrictEqual({
      env: { builtin: true, node: true, browser: false },
      rules: { eqeqeq: ['error', 'always'], 'no-debugger': 'off' },
    })
  })
})

// oxlint matches a glob with no slash against the file's name, at any depth, and reads `./` as the
// config's folder (measured, oxlint 1.87; oxlint-config-oracle.integration.test.ts).
describe('oxlintConfigForFile, given override globs written as a file name or from the config folder', () => {
  const byName: OxlintConfig = {
    overrides: [
      { files: ['a.js'], rules: { 'no-debugger': 'error' } },
      { files: ['*.ts'], excludeFiles: ['b.ts'], rules: { eqeqeq: 'error' } },
      { files: ['./src/**'], rules: { 'no-console': 'error' } },
    ],
  }

  it('applies a glob with no slash to a file of that name in any folder, and a ./ glob to the files under it', () => {
    expect(['a.js', 'src/a.js', 'src/deep/a.ts', 'lib/b.ts', 'src/b.ts'].map((file) => oxlintConfigForFile(byName, file).rules)).toStrictEqual([
      { 'no-debugger': 'error' },
      { 'no-debugger': 'error', 'no-console': 'error' },
      { eqeqeq: 'error', 'no-console': 'error' },
      {},
      { 'no-console': 'error' },
    ])
  })
})

// Each config extended as an object merges into the one extending it, the overrides of the
// extended configs first (Oxlintrc::merge, oxlint 1.87). An extended config's root env reaches no
// file, while the env of its overrides does (measured, oxlint 1.87; oxlint-config-oracle.integration.test.ts).
const extending: OxlintConfig = {
  env: { node: true },
  rules: { eqeqeq: ['error', 'always'] },
  extends: [
    {
      env: { browser: true },
      rules: { eqeqeq: ['warn', 'smart'], 'no-debugger': 'warn' },
      overrides: [{ files: ['apps/**'], rules: { 'no-debugger': 'off' } }],
    },
    {
      rules: { 'no-debugger': 'error' },
      extends: [
        {
          env: { vitest: true },
          rules: { 'no-console': 'warn' },
          overrides: [{ files: ['apps/**'], env: { jest: true }, rules: { 'no-console': 'off' } }],
        },
      ],
    },
  ],
  overrides: [{ files: ['apps/**'], rules: { 'no-debugger': ['warn'] } }],
}

describe('oxlintConfigForFile, given a config extending others as objects', () => {
  it("merges the top-level rules of each, a later config's over an earlier's, under the config's own, and takes the env of the config's own root alone", () => {
    expect(oxlintConfigForFile(extending, 'libs/a.ts')).toStrictEqual({
      env: { node: true },
      rules: { eqeqeq: ['error', 'always'], 'no-debugger': 'error', 'no-console': 'warn' },
    })
  })

  it("applies the env an extended config's override sets, in the override's files", () => {
    expect(oxlintConfigForFile(extending, 'apps/a.ts').env).toStrictEqual({ node: true, jest: true })
  })

  it("applies the overrides of each, at any depth and in order, before the config's own", () => {
    expect(oxlintConfigForFile(extending, 'apps/a.ts').rules).toStrictEqual({
      eqeqeq: ['error', 'always'],
      'no-debugger': ['warn'],
      'no-console': 'off',
    })
  })

  it('reads a config extended by path as out of sight', () => {
    // Parse boundary: a .oxlintrc.json, whose `extends` holds paths.
    const extendingByPath = JSON.parse('{ "extends": ["./base.json"], "rules": { "no-debugger": "error" } }') as OxlintConfig

    expect(oxlintConfigForFile(extendingByPath, 'libs/a.ts')).toStrictEqual({ env: {}, rules: { 'no-debugger': 'error' } })
  })
})

// oxlint reads every spelling of a rule as that rule, so the last statement of it under any
// spelling decides it (parse_rule_key, rules.rs, oxlint 1.87).
describe('oxlintEntryOfRuleFor', () => {
  const ARRAY_TYPE_SPELLINGS = ['typescript/array-type', '@typescript-eslint/array-type']
  const spelledTwice: OxlintConfig = {
    rules: { 'typescript/array-type': 'error' },
    overrides: [
      { files: ['src/**'], rules: { '@typescript-eslint/array-type': 'off' } },
      { files: ['src/keep/**'], rules: { 'typescript/array-type': ['warn', { default: 'generic' }] } },
    ],
  }

  it('gives the last statement of the rule that applies to the file, under any of its spellings', () => {
    expect(['lib/a.ts', 'src/a.ts', 'src/keep/a.ts'].map((file) => oxlintEntryOfRuleFor(spelledTwice, file, ARRAY_TYPE_SPELLINGS))).toStrictEqual([
      'error',
      'off',
      ['warn', { default: 'generic' }],
    ])
  })

  it('gives undefined where no statement of the rule applies', () => {
    expect(oxlintEntryOfRuleFor(spelledTwice, 'src/a.ts', ['no-debugger', 'eslint/no-debugger'])).toBeUndefined()
  })
})

describe('oxlintSeverityFor', () => {
  it('names the severity oxlint applies to the rule in the file', () => {
    expect(['libs/a.ts', 'apps/api/a.ts', 'apps/web/a.ts'].map((file) => oxlintSeverityFor(config, file, 'no-debugger'))).toStrictEqual(
      ['error', 'off', 'warn'],
    )
  })

  it('reads a rule no layer sets as absent rather than off', () => {
    expect(oxlintSeverityFor(config, 'apps/web/a.ts', 'no-console')).toBeUndefined()
  })
})

describe('isIgnoredByOxlintConfig', () => {
  const ignoring: OxlintConfig = { ignorePatterns: ['**/node_modules/**', 'dist/**'] }

  it('reads a file a pattern matches as ignored, at any depth the pattern reaches', () => {
    expect(['dist/a.ts', 'dist/deep/a.ts', 'apps/node_modules/x/a.js'].map((file) => isIgnoredByOxlintConfig(ignoring, file))).toStrictEqual([
      true,
      true,
      true,
    ])
  })

  it('reads a file no pattern matches, or a config with no patterns, as linted', () => {
    expect([isIgnoredByOxlintConfig(ignoring, 'src/dist.ts'), isIgnoredByOxlintConfig(config, 'dist/a.ts')]).toStrictEqual([false, false])
  })

  // oxlint reads `ignorePatterns` as .gitignore lines (measured, oxlint 1.87;
  // oxlint-config-oracle.integration.test.ts): a pattern with no slash but a last one matches a
  // folder or file of that name in any folder, a last slash matches folders only, and a folder
  // matched leaves out every file under it. A slash before the end ties the pattern to the config's folder.
  it.each([
    { pattern: 'generated', ignored: ['generated/a.js', 'src/generated/a.js'], linted: ['generated.js', 'src/a.js'] },
    { pattern: 'legacy/', ignored: ['legacy/a.js', 'src/legacy/deep/a.js'], linted: ['src/legacy.js', 'legacy.js'] },
    { pattern: '**/gen', ignored: ['gen/a.js', 'src/gen/a.js'], linted: ['src/generated/a.js', 'src/gen.js'] },
    { pattern: 'vendor/**', ignored: ['vendor/a.js', 'vendor/deep/a.js'], linted: ['src/vendor/a.js', 'vendor.js'] },
    { pattern: 'a.js', ignored: ['a.js', 'src/deep/a.js'], linted: ['b.js', 'src/a.jsx'] },
    { pattern: 'a.js/', ignored: ['src/a.js/b.js'], linted: ['a.js', 'src/deep/a.js'] },
  ])('reads $pattern as a .gitignore line: $ignored ignored, $linted linted', ({ pattern, ignored, linted }) => {
    const ignoringOne: OxlintConfig = { ignorePatterns: [pattern] }

    expect([...ignored, ...linted].filter((file) => isIgnoredByOxlintConfig(ignoringOne, file))).toStrictEqual(ignored)
  })

  it('refuses a negated pattern, which the oracle does not model', () => {
    expect(() => isIgnoredByOxlintConfig({ ignorePatterns: ['dist/**', '!dist/keep.ts'] }, 'dist/a.ts')).toThrowError(
      new Error('the oracle reads no negated ignore pattern, and was given !dist/keep.ts'),
    )
  })
})

describe('severityOfOxlintEntry', () => {
  it('reads every severity spelling oxlint accepts, bare or leading options', () => {
    expect(
      ['off', 'allow', OFF, 'warn', WARN, 'error', 'deny', ERROR, ['warn', { max: 1 }], [ERROR]].map((entry) =>
        severityOfOxlintEntry(entry),
      ),
    ).toStrictEqual(['off', 'off', 'off', 'warn', 'warn', 'error', 'error', 'error', 'warn', 'error'])
  })

  it('refuses an entry oxlint would not read as a severity', () => {
    expect(() => severityOfOxlintEntry('warning')).toThrowError(
      new Error('oxlint reads a rule entry as a severity or [severity, ...options], not "warning"'),
    )
  })
})
