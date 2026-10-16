import type { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import type { Catalog, ShippedRule } from '@workspace/rule-data'
import {
  buildAlwaysOnShippedRule,
  buildCatalog,
  buildEslintRoute,
  buildLibsRuleset,
  buildOxlintRoute,
  buildPluginRegistry,
  buildQualityRuleset,
  buildRuntimeRuleset,
  buildShippedRule,
  buildSuppressionModeShippedRule,
} from '../__tests__/factories/catalog-factories.ts'
import { buildFileOverride, buildLintRules } from '../__tests__/factories/lint-rules-factories.ts'
import { buildProjectFacts } from '../__tests__/factories/project-facts-factories.ts'
import { buildEslintConfig } from './build-eslint-config.ts'
import { buildOxlintConfig } from './build-oxlint-config.ts'
import { type FileOverrideLayer, resolveRuleLayers, type RuleSetting } from './resolve-rule-layers.ts'

const catalog = buildCatalog({
  rulesets: [
    buildQualityRuleset('correctness'),
    buildQualityRuleset('complexity'),
    buildLibsRuleset('storybook', 'testing'),
    buildRuntimeRuleset('node', 'node'),
    buildRuntimeRuleset('browser', 'browser'),
  ],
  rules: [
    buildOxlintRoute('eqeqeq', {
      oxlintName: 'eqeqeq',
      oxlintPlugin: 'eslint',
      shipped: buildShippedRule('correctness', { options: ['always'] }),
    }),
    buildOxlintRoute('no-debugger', {
      oxlintName: 'no-debugger',
      oxlintPlugin: 'eslint',
      shipped: buildShippedRule('correctness', { options: [] }),
    }),
    buildEslintRoute('max-lines', {
      typed: false,
      shipped: buildShippedRule('complexity', {
        options: [{ max: 200 }],
        files: ['**/*.tsx'],
        ignores: ['**/use-*.tsx'],
      }),
    }),
    buildEslintRoute('storybook/default-exports', {
      typed: false,
      shipped: buildShippedRule('storybook', { options: [], files: ['**/*.stories.tsx'] }),
    }),
    buildEslintRoute('n/prefer-global/buffer', {
      typed: false,
      shipped: buildShippedRule('node', { options: ['always'] }),
    }),
    buildEslintRoute('unicorn/prefer-dom-node-append', {
      typed: false,
      shipped: buildShippedRule('browser', { options: [] }),
    }),
    buildOxlintRoute('n/no-exports-assign', {
      oxlintName: 'node/no-exports-assign',
      oxlintPlugin: 'node',
      shipped: null,
    }),
    buildEslintRoute('sonarjs/no-duplicate-string', { typed: false, shipped: null }),
  ],
})

const pluginRegistry = buildPluginRegistry({
  n: ['prefer-global/buffer'],
  sonarjs: ['no-duplicate-string'],
  storybook: ['default-exports'],
  unicorn: ['prefer-dom-node-append'],
})

function blockNamed(config: readonly Linter.Config[], name: string): Linter.Config {
  const block = config.find((candidate) => candidate.name === name)
  if (block === undefined) throw new Error(`no block named ${name}`)
  return block
}

describe('resolveRuleLayers', () => {
  describe('the base', () => {
    it('holds every rule of every listed ruleset, at error with its shipped options and file scope', () => {
      const lintRules = buildLintRules({ quality: ['correctness', 'complexity'], runtimes: ['node'] })

      expect(resolveRuleLayers(lintRules, catalog).rules).toStrictEqual({
        eqeqeq: { severity: 'error', options: ['always'], files: null, ignores: null },
        'no-debugger': { severity: 'error', options: [], files: null, ignores: null },
        'max-lines': {
          severity: 'error',
          options: [{ max: 200 }],
          files: ['**/*.tsx'],
          ignores: ['**/use-*.tsx'],
        },
        'n/prefer-global/buffer': { severity: 'error', options: ['always'], files: null, ignores: null },
      })
    })

    it('holds no rule of a ruleset that is not listed', () => {
      const lintRules = buildLintRules({ quality: ['correctness'], runtimes: ['browser'] })

      expect(resolveRuleLayers(lintRules, catalog).rules).toStrictEqual({
        eqeqeq: { severity: 'error', options: ['always'], files: null, ignores: null },
        'no-debugger': { severity: 'error', options: [], files: null, ignores: null },
        'unicorn/prefer-dom-node-append': { severity: 'error', options: [], files: null, ignores: null },
      })
    })

    it('takes the env of every listed runtime', () => {
      const lintRules = buildLintRules({ runtimes: ['node', 'browser'] })

      expect(resolveRuleLayers(lintRules, catalog).env).toStrictEqual(['node', 'browser'])
    })

    it('has no file override layer when the config gives none', () => {
      const lintRules = buildLintRules({ quality: ['correctness'] })

      expect(resolveRuleLayers(lintRules, catalog).fileOverrides).toStrictEqual([])
    })
  })

  describe('rules set on top of the rulesets', () => {
    it('keep the shipped options when they give only a severity', () => {
      const lintRules = buildLintRules({ quality: ['correctness'] }, { rules: { eqeqeq: 'warn' } })

      expect(resolveRuleLayers(lintRules, catalog).rules['eqeqeq']).toStrictEqual({
        severity: 'warn',
        options: ['always'],
        files: null,
        ignores: null,
      })
    })

    it('replace the shipped options when they give options', () => {
      const lintRules = buildLintRules(
        { quality: ['correctness'] },
        { rules: { eqeqeq: ['error', 'smart'] } },
      )

      expect(resolveRuleLayers(lintRules, catalog).rules['eqeqeq']).toStrictEqual({
        severity: 'error',
        options: ['smart'],
        files: null,
        ignores: null,
      })
    })

    it('remove a shipped rule they turn off', () => {
      const lintRules = buildLintRules({ quality: ['correctness'] }, { rules: { 'no-debugger': 'off' } })

      expect(resolveRuleLayers(lintRules, catalog).rules).toStrictEqual({
        eqeqeq: { severity: 'error', options: ['always'], files: null, ignores: null },
      })
    })

    it('enable a rule whose ruleset is not listed, keeping its shipped file scope', () => {
      const lintRules = buildLintRules({}, { rules: { 'storybook/default-exports': 'error' } })

      expect(resolveRuleLayers(lintRules, catalog).rules).toStrictEqual({
        'storybook/default-exports': {
          severity: 'error',
          options: [],
          files: ['**/*.stories.tsx'],
          ignores: null,
        },
      })
    })

    it('enable an available rule, in no ruleset, with the options given and no file scope', () => {
      const lintRules = buildLintRules(
        {},
        { rules: { 'sonarjs/no-duplicate-string': ['error', { threshold: 3 }] } },
      )

      expect(resolveRuleLayers(lintRules, catalog).rules).toStrictEqual({
        'sonarjs/no-duplicate-string': {
          severity: 'error',
          options: [{ threshold: 3 }],
          files: null,
          ignores: null,
        },
      })
    })
  })

  describe('an available rule enabled through rules', () => {
    const lintRules = buildLintRules(
      {},
      { rules: { 'n/no-exports-assign': 'error', 'sonarjs/no-duplicate-string': 'error' } },
    )

    it('runs in oxlint, under its oxlint name, when the catalog routes it to oxlint', () => {
      expect(buildOxlintConfig(lintRules, catalog).rules).toStrictEqual({
        'node/no-exports-assign': ['error'],
      })
    })

    it('runs in ESLint when the catalog routes it to ESLint', () => {
      const config = buildEslintConfig(lintRules, catalog, pluginRegistry, buildProjectFacts())

      expect(blockNamed(config, 'agents-inc/base').rules).toStrictEqual({
        'sonarjs/no-duplicate-string': ['error'],
      })
    })
  })

  describe('globs', () => {
    const slashFreeCatalog = buildCatalog({
      rulesets: [buildQualityRuleset('complexity')],
      rules: [
        buildEslintRoute('max-lines', {
          typed: false,
          shipped: buildShippedRule('complexity', {
            options: [],
            files: ['*.tsx'],
            ignores: ['use-*.tsx'],
          }),
        }),
      ],
    })

    it('match at any depth when the config writes them without a slash', () => {
      const lintRules = buildLintRules(
        { quality: ['complexity'] },
        {
          ignores: ['*.gen.ts', 'src/generated/**'],
          fileOverrides: [buildFileOverride(['*.test.ts'], { rules: { 'max-lines': 'off' } })],
        },
      )
      const layers = resolveRuleLayers(lintRules, slashFreeCatalog)

      expect(layers.ignores).toStrictEqual(['**/*.gen.ts', 'src/generated/**'])
      expect(layers.fileOverrides.map((layer) => layer.files)).toStrictEqual([['**/*.test.ts']])
    })

    it('match at any depth when the data writes them without a slash', () => {
      const lintRules = buildLintRules({ quality: ['complexity'] })

      expect(resolveRuleLayers(lintRules, slashFreeCatalog).rules['max-lines']).toStrictEqual({
        severity: 'error',
        options: [],
        files: ['**/*.tsx'],
        ignores: ['**/use-*.tsx'],
      })
    })
  })
})

// "Covered by" (S; spec-core.md C2): a narrow rule is left out of each layer wherever the broader
// rule covering it is on there, as the layer's rulesets and the top-level rules turn it on.
describe('a rule covered by another', () => {
  const COVER = 'functional/no-classes'
  const COVERED = '@eslint-react/x-no-class-component'
  const OTHER_REACT_RULE = '@eslint-react/no-missing-key'
  // Run on some files alone, and only with type information: neither keeps the covered rule.
  const SCOPED_TYPED_COVER = 'functional/no-expression-statements'
  const COVERED_BY_THE_SCOPED_TYPED_COVER = 'no-new'
  const CORE_RULE_COVERED = 'no-unused-expressions'
  const EXTENSION_OF_THE_CORE_RULE = '@typescript-eslint/no-unused-expressions'
  const SRC_FILES = 'src/**'
  const LEGACY_FILES = 'src/legacy/**'
  const ON: RuleSetting = { severity: 'error', options: [], files: null, ignores: null }
  const OFF: RuleSetting = { severity: 'off', options: [], files: null, ignores: null }
  const WARN: RuleSetting = { severity: 'warn', options: [], files: null, ignores: null }

  const coveredCatalog = buildCatalog({
    rulesets: [buildQualityRuleset('declarative'), buildQualityRuleset('redundancy'), buildLibsRuleset('react', 'ui')],
    rules: [
      buildEslintRoute(COVER, { typed: false, shipped: buildShippedRule('declarative') }),
      buildEslintRoute(COVERED, { typed: false, shipped: buildShippedRule('react', { coveredBy: COVER }) }),
      buildEslintRoute(OTHER_REACT_RULE, { typed: false, shipped: buildShippedRule('react') }),
      buildEslintRoute(SCOPED_TYPED_COVER, { typed: true, shipped: buildShippedRule('declarative', { files: ['**/*.ts'], ignores: ['**/use-*.ts'] }) }),
      buildOxlintRoute(COVERED_BY_THE_SCOPED_TYPED_COVER, {
        oxlintName: COVERED_BY_THE_SCOPED_TYPED_COVER,
        oxlintPlugin: 'eslint',
        shipped: buildShippedRule('redundancy', { coveredBy: SCOPED_TYPED_COVER }),
      }),
      buildOxlintRoute(CORE_RULE_COVERED, {
        oxlintName: CORE_RULE_COVERED,
        oxlintPlugin: 'eslint',
        shipped: buildShippedRule('redundancy', { coveredBy: SCOPED_TYPED_COVER }),
      }),
      buildEslintRoute(EXTENSION_OF_THE_CORE_RULE, { typed: false, shipped: null }),
    ],
    coreRuleExtensions: new Map([[CORE_RULE_COVERED, [EXTENSION_OF_THE_CORE_RULE]]]),
  })

  const BOTH_RULESETS = { quality: ['declarative'], libs: { ui: ['react'] } }
  const COVERED_RULESET_ALONE = { libs: { ui: ['react'] } }

  function topLevelRuleIdsOf(lintRules: Parameters<typeof resolveRuleLayers>[0]): string[] {
    return Object.keys(resolveRuleLayers(lintRules, coveredCatalog).rules).toSorted()
  }

  function onlyEntryOf(lintRules: Parameters<typeof resolveRuleLayers>[0]): Pick<FileOverrideLayer, 'rulesetChanges' | 'rules'> {
    const [entry, ...rest] = resolveRuleLayers(lintRules, coveredCatalog).fileOverrides
    if (entry === undefined || rest.length > 0) throw new Error('the config gives one entry')
    return { rulesetChanges: entry.rulesetChanges, rules: entry.rules }
  }

  describe('at the top level', () => {
    it('is left out where its cover is on by its ruleset, and kept where that ruleset is not listed', () => {
      expect({
        coverListed: topLevelRuleIdsOf(buildLintRules(BOTH_RULESETS)),
        coverNotListed: topLevelRuleIdsOf(buildLintRules(COVERED_RULESET_ALONE)),
      }).toStrictEqual({
        coverListed: [COVER, OTHER_REACT_RULE, SCOPED_TYPED_COVER].toSorted(),
        coverNotListed: [COVERED, OTHER_REACT_RULE].toSorted(),
      })
    })

    it('is left out where its cover is on by the top-level rules alone, as where it is on by its ruleset alone', () => {
      expect({
        byRulesAlone: topLevelRuleIdsOf(buildLintRules(COVERED_RULESET_ALONE, { rules: { [COVER]: 'error' } })),
        byItsRulesetAlone: topLevelRuleIdsOf(buildLintRules(BOTH_RULESETS)),
      }).toStrictEqual({
        byRulesAlone: [COVER, OTHER_REACT_RULE].toSorted(),
        byItsRulesetAlone: [COVER, OTHER_REACT_RULE, SCOPED_TYPED_COVER].toSorted(),
      })
    })

    it('is left out where its cover is on at warn', () => {
      expect(topLevelRuleIdsOf(buildLintRules(COVERED_RULESET_ALONE, { rules: { [COVER]: 'warn' } }))).toStrictEqual([COVER, OTHER_REACT_RULE].toSorted())
    })

    it('comes back where the top-level rules turn its cover off', () => {
      expect(topLevelRuleIdsOf(buildLintRules(BOTH_RULESETS, { rules: { [COVER]: 'off' } }))).toStrictEqual(
        [COVERED, OTHER_REACT_RULE, SCOPED_TYPED_COVER].toSorted(),
      )
    })

    it('runs at the setting the top-level rules give it where they name it, its cover on beside it', () => {
      const { rules } = resolveRuleLayers(buildLintRules(BOTH_RULESETS, { rules: { [COVERED]: 'warn' } }), coveredCatalog)

      expect({ covered: rules[COVERED], cover: rules[COVER] }).toStrictEqual({ covered: WARN, cover: ON })
    })

    it('is left out wherever its cover runs on some files alone, or only with type information', () => {
      expect(topLevelRuleIdsOf(buildLintRules({ quality: ['declarative', 'redundancy'] }))).toStrictEqual([COVER, SCOPED_TYPED_COVER].toSorted())
    })

    it('is kept where the scoped cover is not listed', () => {
      expect(topLevelRuleIdsOf(buildLintRules({ quality: ['redundancy'] }))).toStrictEqual([COVERED_BY_THE_SCOPED_TYPED_COVER, CORE_RULE_COVERED].toSorted())
    })

    // D9's "extension alone": the consumer naming typescript-eslint's extension of a covered core
    // rule does not name the core rule, which stays left out; the extension runs as stated.
    it("stays left out where the top-level rules name typescript-eslint's extension of it, which runs as stated", () => {
      const { rules } = resolveRuleLayers(buildLintRules({ quality: ['declarative', 'redundancy'] }, { rules: { [EXTENSION_OF_THE_CORE_RULE]: 'warn' } }), coveredCatalog)

      expect({ core: rules[CORE_RULE_COVERED], extension: rules[EXTENSION_OF_THE_CORE_RULE] }).toStrictEqual({ core: undefined, extension: WARN })
    })

    it('runs where the top-level rules name it, beside its extension named too', () => {
      const { rules } = resolveRuleLayers(
        buildLintRules({ quality: ['declarative', 'redundancy'] }, { rules: { [CORE_RULE_COVERED]: 'error', [EXTENSION_OF_THE_CORE_RULE]: 'warn' } }),
        coveredCatalog,
      )

      expect({ core: rules[CORE_RULE_COVERED], extension: rules[EXTENSION_OF_THE_CORE_RULE] }).toStrictEqual({ core: ON, extension: WARN })
    })
  })

  describe('in an entry', () => {
    it("comes back in the files of an entry whose lists drop its cover's ruleset", () => {
      const lintRules = buildLintRules(BOTH_RULESETS, { fileOverrides: [buildFileOverride([SRC_FILES], { rulesets: { quality: [] } })] })

      expect({ topLevel: topLevelRuleIdsOf(lintRules), entry: onlyEntryOf(lintRules) }).toStrictEqual({
        topLevel: [COVER, OTHER_REACT_RULE, SCOPED_TYPED_COVER].toSorted(),
        entry: { rulesetChanges: { [COVER]: OFF, [SCOPED_TYPED_COVER]: OFF, [COVERED]: ON }, rules: {} },
      })
    })

    it("is left out of the files of an entry that adds its cover's ruleset, where the top level runs it", () => {
      const lintRules = buildLintRules(COVERED_RULESET_ALONE, { fileOverrides: [buildFileOverride([SRC_FILES], { rulesets: { quality: ['declarative'] } })] })

      expect({ topLevel: topLevelRuleIdsOf(lintRules), entry: onlyEntryOf(lintRules) }).toStrictEqual({
        topLevel: [COVERED, OTHER_REACT_RULE].toSorted(),
        entry: { rulesetChanges: { [COVER]: ON, [SCOPED_TYPED_COVER]: scopedTypedCoverSetting(), [COVERED]: OFF }, rules: {} },
      })
    })

    it("runs at the setting an entry's own rules give it, in the entry's files", () => {
      const lintRules = buildLintRules(BOTH_RULESETS, { fileOverrides: [buildFileOverride([SRC_FILES], { rules: { [COVERED]: 'warn' } })] })

      expect({ topLevel: topLevelRuleIdsOf(lintRules), entry: onlyEntryOf(lintRules) }).toStrictEqual({
        topLevel: [COVER, OTHER_REACT_RULE, SCOPED_TYPED_COVER].toSorted(),
        entry: { rulesetChanges: {}, rules: { [COVERED]: WARN } },
      })
    })

    // The limit (spec-core.md call 2): an entry's own rules do not move S, in either direction.
    it("does not come back where an entry's own rules turn its cover off", () => {
      const lintRules = buildLintRules(BOTH_RULESETS, { fileOverrides: [buildFileOverride([SRC_FILES], { rules: { [COVER]: 'off' } })] })

      expect({ topLevel: topLevelRuleIdsOf(lintRules), entry: onlyEntryOf(lintRules) }).toStrictEqual({
        topLevel: [COVER, OTHER_REACT_RULE, SCOPED_TYPED_COVER].toSorted(),
        entry: { rulesetChanges: {}, rules: { [COVER]: OFF } },
      })
    })

    it("is not left out where an entry's own rules turn its cover on", () => {
      const lintRules = buildLintRules(COVERED_RULESET_ALONE, { fileOverrides: [buildFileOverride([SRC_FILES], { rules: { [COVER]: 'error' } })] })

      expect({ topLevel: topLevelRuleIdsOf(lintRules), entry: onlyEntryOf(lintRules) }).toStrictEqual({
        topLevel: [COVERED, OTHER_REACT_RULE].toSorted(),
        entry: { rulesetChanges: {}, rules: { [COVER]: ON } },
      })
    })

    // Overlap: a later entry re-adding the cover's ruleset re-states the covered rule an earlier
    // entry brought back, though the covered rule ships in a list the later entry does not give.
    it("is left out again in the files of a later entry re-adding its cover's ruleset over an earlier entry that dropped it", () => {
      const lintRules = buildLintRules(BOTH_RULESETS, {
        fileOverrides: [
          buildFileOverride([SRC_FILES], { rulesets: { quality: [] } }),
          buildFileOverride([LEGACY_FILES], { rulesets: { quality: ['declarative'] } }),
        ],
      })
      const [, later] = resolveRuleLayers(lintRules, coveredCatalog).fileOverrides
      if (later === undefined) throw new Error('the config gives two entries')

      expect(later.rulesetChanges).toStrictEqual({ [COVER]: ON, [SCOPED_TYPED_COVER]: scopedTypedCoverSetting(), [COVERED]: OFF })
    })
  })

  function scopedTypedCoverSetting(): RuleSetting {
    return { severity: 'error', options: [], files: ['**/*.ts'], ignores: ['**/use-*.ts'] }
  }

  // spec-core.md 2.6, S: both rules ship in a ruleset, not always on and not by allowSuppressions,
  // and the cover is another rule, covered by none. The data's tests guarantee it; the core still
  // throws on a breach, naming the covered rule and its cover.
  describe('a breach of the data', () => {
    const BOTH_LISTED = buildLintRules(BOTH_RULESETS)
    const COVERED_SHIPPED = buildShippedRule('react', { coveredBy: COVER })
    const COVER_SHIPPED = buildShippedRule('declarative')
    // Covers the cover, in a chain: a rule of the cover's ruleset.
    const COVER_OF_THE_COVER = 'functional/immutable-data'

    function catalogOf(cover: ShippedRule | null, covered: ShippedRule): Catalog {
      return buildCatalog({
        rulesets: [buildQualityRuleset('declarative'), buildLibsRuleset('react', 'ui')],
        rules: [
          buildEslintRoute(COVER, { typed: false, shipped: cover }),
          buildEslintRoute(COVERED, { typed: false, shipped: covered }),
          buildEslintRoute(COVER_OF_THE_COVER, { typed: false, shipped: buildShippedRule('declarative') }),
        ],
      })
    }

    it('is none where both ship in a ruleset and the cover is another rule, covered by none: the covered rule is left out', () => {
      expect(Object.keys(resolveRuleLayers(BOTH_LISTED, catalogOf(COVER_SHIPPED, COVERED_SHIPPED)).rules).toSorted()).toStrictEqual([COVER, COVER_OF_THE_COVER].toSorted())
    })

    it.each([
      { breach: 'the cover is on whatever rulesets are listed', cover: buildAlwaysOnShippedRule(), covered: COVERED_SHIPPED },
      { breach: 'the cover is turned on by allowSuppressions', cover: buildSuppressionModeShippedRule(), covered: COVERED_SHIPPED },
      { breach: 'the covered rule is on whatever rulesets are listed', cover: COVER_SHIPPED, covered: buildAlwaysOnShippedRule({ coveredBy: COVER }) },
      { breach: 'the covered rule is turned on by allowSuppressions', cover: COVER_SHIPPED, covered: buildSuppressionModeShippedRule({ coveredBy: COVER }) },
      { breach: 'the cover is not shipped', cover: null, covered: COVERED_SHIPPED },
      { breach: 'the cover is covered itself', cover: buildShippedRule('declarative', { coveredBy: COVER_OF_THE_COVER }), covered: COVERED_SHIPPED },
    ])('is refused where $breach', ({ cover, covered }) => {
      expect(() => resolveRuleLayers(BOTH_LISTED, catalogOf(cover, covered))).toThrowError(`${COVERED}: covered by ${COVER}`)
    })

    it('is refused where the cover is the rule itself', () => {
      const catalog = catalogOf(COVER_SHIPPED, buildShippedRule('react', { coveredBy: COVERED }))

      expect(() => resolveRuleLayers(BOTH_LISTED, catalog)).toThrowError(`${COVERED}: covered by ${COVERED}`)
    })
  })
})
