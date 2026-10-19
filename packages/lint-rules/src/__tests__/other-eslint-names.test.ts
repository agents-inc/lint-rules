import { buildShippedRule } from '@workspace/rule-data/test-support/shipped-rule-factories'
import { describe, expect, it } from 'vitest'
import { buildCatalog, buildEslintRoute, buildOxlintRoute, buildQualityRuleset } from './factories/catalog-factories.ts'
import {
  eslintNamesOf,
  sameModuleNamesOf,
  sameModuleNamesOfEach,
  sameRuleNamesOf,
  sameRuleNamesOfEach,
  twinPairsOf,
  typescriptEslintTwinsOf,
  withTheTeamsPrefixes,
} from './other-eslint-names.ts'

// A wrong oracle here would keep a team's copy of our rule running, turn off names no ESLint plugin defines,
// or turn off a rule of the team's.

const QUALITY = buildQualityRuleset('quality')

const catalog = buildCatalog({
  rulesets: [QUALITY],
  rules: [
    buildOxlintRoute('import-x/first', {
      oxlintName: 'import/first',
      oxlintPlugin: 'import',
      shipped: buildShippedRule(QUALITY.name),
      eslintAliases: ['import/first'],
      oxlintSpellings: ['eslint-plugin-import-x/first', 'import-x/first', 'import/first'],
    }),
    buildOxlintRoute('n/no-process-exit', {
      oxlintName: 'node/no-process-exit',
      oxlintPlugin: 'node',
      shipped: buildShippedRule(QUALITY.name),
      oxlintSpellings: ['n/no-process-exit', 'node/no-process-exit'],
    }),
    buildEslintRoute('node/no-process-exit', { typed: false, shipped: null }),
    buildOxlintRoute('no-unused-vars', {
      oxlintName: 'no-unused-vars',
      oxlintPlugin: 'eslint',
      shipped: buildShippedRule(QUALITY.name),
      oxlintSpellings: ['@typescript-eslint/no-unused-vars', 'eslint/no-unused-vars', 'no-unused-vars', 'typescript/no-unused-vars'],
    }),
    buildEslintRoute('@typescript-eslint/no-unused-vars', { typed: false, shipped: null }),
    buildEslintRoute('unicorn/no-for-each', {
      typed: false,
      shipped: buildShippedRule(QUALITY.name),
      oxlintSpellings: ['eslint-plugin-unicorn/no-array-for-each', 'unicorn/no-array-for-each'],
    }),
    buildEslintRoute('@typescript-eslint/array-type', {
      typed: false,
      shipped: buildShippedRule(QUALITY.name),
      oxlintSpellings: ['@typescript-eslint/array-type', 'typescript-eslint/array-type', 'typescript/array-type'],
    }),
    buildEslintRoute('@eslint-react/x-no-missing-key', { typed: false, shipped: buildShippedRule(QUALITY.name) }),
  ],
})

// antfu's eslint-config registers typescript-eslint as `ts` and @eslint-react as `react`.
const TEAMS_PREFIXES: ReadonlyMap<string, readonly string[]> = new Map([
  ['@typescript-eslint', ['ts']],
  ['@eslint-react', ['react']],
])

describe('sameRuleNamesOf', () => {
  it("names a rule's ESLint alias", () => {
    expect(sameRuleNamesOf('import-x/first', catalog)).toStrictEqual(['import/first'])
  })

  it('names a spelling that is a rule ID of the catalog, and no spelling only oxlint reads', () => {
    expect(sameRuleNamesOf('n/no-process-exit', catalog)).toStrictEqual(['node/no-process-exit'])
  })

  it("names no twin, though oxlint spells it as the rule itself: typescript-eslint's no-unused-vars beside no-unused-vars", () => {
    expect(sameRuleNamesOf('no-unused-vars', catalog)).toStrictEqual([])
  })

  it("names a spelling under the rule's own plugin prefix: a renamed rule's old name", () => {
    expect(sameRuleNamesOf('unicorn/no-for-each', catalog)).toStrictEqual(['unicorn/no-array-for-each'])
  })

  it('names none for a rule whose spellings are its ID and forms only oxlint reads', () => {
    expect(sameRuleNamesOf('@typescript-eslint/array-type', catalog)).toStrictEqual([])
  })

  it('throws on an ID the catalog lacks', () => {
    expect(() => sameRuleNamesOf('nobody/rule', catalog)).toThrowError('nobody/rule')
  })
})

describe('sameRuleNamesOfEach', () => {
  it('names the same-rule names of every rule given, once each and sorted', () => {
    expect(sameRuleNamesOfEach(['unicorn/no-for-each', 'import-x/first', 'no-unused-vars'], catalog)).toStrictEqual([
      'import/first',
      'unicorn/no-array-for-each',
    ])
  })
})

describe('typescriptEslintTwinsOf, read from the installed typescript-eslint', () => {
  it('names, of a core rule, the typescript-eslint rule that extends it under another name', () => {
    expect(typescriptEslintTwinsOf('no-throw-literal')).toStrictEqual(['@typescript-eslint/only-throw-error'])
  })

  it('names, of a core rule, the typescript-eslint rule that extends it under its own name', () => {
    expect(typescriptEslintTwinsOf('no-unused-vars')).toStrictEqual(['@typescript-eslint/no-unused-vars'])
  })

  it('names, of a typescript-eslint rule, the core rule it extends', () => {
    expect(typescriptEslintTwinsOf('@typescript-eslint/no-invalid-this')).toStrictEqual(['no-invalid-this'])
  })

  it('names no extension deprecated in favour of its core rule, from either side', () => {
    expect({
      ofTheCoreRule: typescriptEslintTwinsOf('no-loop-func'),
      ofTheExtension: typescriptEslintTwinsOf('@typescript-eslint/no-loop-func'),
    }).toStrictEqual({ ofTheCoreRule: [], ofTheExtension: [] })
  })

  it('names none for a rule that extends no core rule and that no rule extends', () => {
    expect({
      typescriptEslintOnly: typescriptEslintTwinsOf('@typescript-eslint/array-type'),
      coreOnly: typescriptEslintTwinsOf('eqeqeq'),
    }).toStrictEqual({ typescriptEslintOnly: [], coreOnly: [] })
  })
})

describe('sameModuleNamesOf, read from the installed plugins', () => {
  it("names, of each of @eslint-react's two names of one module, the other", () => {
    expect({
      ofThePrefixedName: sameModuleNamesOf('@eslint-react/x-no-missing-key'),
      ofThePlainName: sameModuleNamesOf('@eslint-react/no-missing-key'),
    }).toStrictEqual({
      ofThePrefixedName: ['@eslint-react/no-missing-key'],
      ofThePlainName: ['@eslint-react/x-no-missing-key'],
    })
  })

  it('names none for a rule its plugin binds to a module of its own, a core rule, or a rule under a prefix no plugin of ours is installed under', () => {
    expect({
      ownModule: sameModuleNamesOf('@eslint-react/dom-no-missing-button-type'),
      coreRule: sameModuleNamesOf('eqeqeq'),
      notInstalled: sameModuleNamesOf('jsx-a11y/alt-text'),
    }).toStrictEqual({ ownModule: [], coreRule: [], notInstalled: [] })
  })
})

describe('sameModuleNamesOfEach', () => {
  it('names the same-module names of every rule given, once each and sorted', () => {
    expect(
      sameModuleNamesOfEach(['@eslint-react/x-no-missing-key', 'eqeqeq', '@eslint-react/no-unused-state', '@eslint-react/x-no-missing-key']),
    ).toStrictEqual(['@eslint-react/no-missing-key', '@eslint-react/x-no-unused-state'])
  })
})

describe('twinPairsOf', () => {
  it('pairs each rule given with each of its twins, in both directions, and leaves out a rule with none', () => {
    expect(twinPairsOf(['prefer-promise-reject-errors', 'eqeqeq', '@typescript-eslint/consistent-return'])).toStrictEqual([
      { ours: 'prefer-promise-reject-errors', theirs: '@typescript-eslint/prefer-promise-reject-errors' },
      { ours: '@typescript-eslint/consistent-return', theirs: 'consistent-return' },
    ])
  })
})

describe('eslintNamesOf', () => {
  it("names a rule's own ID beside its alias, and beside its renamed rule's old name, sorted", () => {
    expect({ alias: eslintNamesOf('import-x/first', catalog), oldName: eslintNamesOf('unicorn/no-for-each', catalog) }).toStrictEqual({
      alias: ['import-x/first', 'import/first'],
      oldName: ['unicorn/no-array-for-each', 'unicorn/no-for-each'],
    })
  })

  it('names the other name its plugin binds its module to, read from the installed plugin', () => {
    expect(eslintNamesOf('@eslint-react/x-no-missing-key', catalog)).toStrictEqual(['@eslint-react/no-missing-key', '@eslint-react/x-no-missing-key'])
  })

  it('names the rule alone where it has no other name, and no twin of it', () => {
    expect({ noOtherName: eslintNamesOf('@typescript-eslint/array-type', catalog), twinned: eslintNamesOf('no-unused-vars', catalog) }).toStrictEqual({
      noOtherName: ['@typescript-eslint/array-type'],
      twinned: ['no-unused-vars'],
    })
  })
})

describe('withTheTeamsPrefixes', () => {
  it("adds each name under a prefix of ours under every prefix the team registers that plugin under, sorted", () => {
    expect(withTheTeamsPrefixes(['@typescript-eslint/array-type', '@eslint-react/no-missing-key'], TEAMS_PREFIXES)).toStrictEqual([
      '@eslint-react/no-missing-key',
      '@typescript-eslint/array-type',
      'react/no-missing-key',
      'ts/array-type',
    ])
  })

  it("adds nothing for a core rule, or a name under a prefix the team registers no plugin of ours under", () => {
    expect(withTheTeamsPrefixes(['no-unused-vars', 'unicorn/no-for-each'], TEAMS_PREFIXES)).toStrictEqual(['no-unused-vars', 'unicorn/no-for-each'])
  })
})
