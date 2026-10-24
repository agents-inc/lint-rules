import { buildAlwaysOnShippedRule, buildShippedRule, buildShippedRuleDecidedBySuppressions } from '@workspace/rule-data/test-support/shipped-rule-factories'
import { describe, expect, it } from 'vitest'
import type { Catalog, RuleRoute, RulesetDefinition, ShippedRule } from '@workspace/rule-data'
import { blockNamed } from '../__tests__/eslint-config-reads.ts'
import {
  buildCatalog,
  buildEslintRoute,
  buildLibsRuleset,
  buildOxlintRoute,
  buildPluginRegistry,
  buildQualityRuleset,
  buildRuntimeRuleset,
  buildSuppressionModeShippedRule,
} from '../__tests__/factories/catalog-factories.ts'
import { buildFileOverride, buildLintRules } from '../__tests__/factories/lint-rules-factories.ts'
import { buildProjectFacts } from '../__tests__/factories/project-facts-factories.ts'
import { buildEslintConfig } from './build-eslint-config.ts'
import { buildOxlintConfig } from './build-oxlint-config.ts'
import {
  type FileOverrideLayer,
  layersKeepingRules,
  resolveRuleLayers,
  resolveRuleLayersBesideOxlint,
  ruleIdsOnIn,
  type RuleSetting,
  suppressionRulesOf,
} from './resolve-rule-layers.ts'

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
    it('runs in oxlint, under its oxlint name, when the catalog routes it to oxlint', () => {
      const lintRules = buildLintRules({}, { rules: { 'n/no-exports-assign': 'error', 'sonarjs/no-duplicate-string': 'error' } })

      expect(buildOxlintConfig(lintRules, catalog).rules).toStrictEqual({
        'node/no-exports-assign': ['error'],
      })
    })

    it('runs in ESLint when the catalog routes it to ESLint', () => {
      const lintRules = buildLintRules({}, { rules: { 'n/no-exports-assign': 'error', 'sonarjs/no-duplicate-string': 'error' } })
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

// A narrow rule is left out of each layer wherever the broader rule covering it is on there.
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

    // Naming typescript-eslint's extension of a covered core rule does not name the core rule.
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

    // A known limit: an entry's own rules do not move the cover, in either direction.
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

    // The covered rule ships in a list the later entry does not give, yet the later entry restates it.
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

  // The data's tests guarantee a valid cover; the core still throws on a breach, naming both rules.
  describe('a breach of the data', () => {
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
      const bothListed = buildLintRules(BOTH_RULESETS)

      expect(Object.keys(resolveRuleLayers(bothListed, catalogOf(COVER_SHIPPED, COVERED_SHIPPED)).rules).toSorted()).toStrictEqual([COVER, COVER_OF_THE_COVER].toSorted())
    })

    it.each([
      { breach: 'the cover is on whatever rulesets are listed', cover: buildAlwaysOnShippedRule(), covered: COVERED_SHIPPED },
      { breach: 'the cover is turned on by allowSuppressions', cover: buildSuppressionModeShippedRule(), covered: COVERED_SHIPPED },
      { breach: 'the covered rule is on whatever rulesets are listed', cover: COVER_SHIPPED, covered: buildAlwaysOnShippedRule({ coveredBy: COVER }) },
      { breach: 'the covered rule is turned on by allowSuppressions', cover: COVER_SHIPPED, covered: buildSuppressionModeShippedRule({ coveredBy: COVER }) },
      { breach: 'the cover is not shipped', cover: null, covered: COVERED_SHIPPED },
      { breach: 'the cover is covered itself', cover: buildShippedRule('declarative', { coveredBy: COVER_OF_THE_COVER }), covered: COVERED_SHIPPED },
    ])('is refused where $breach', ({ cover, covered }) => {
      const bothListed = buildLintRules(BOTH_RULESETS)

      expect(() => resolveRuleLayers(bothListed, catalogOf(cover, covered))).toThrowError(`${COVERED}: covered by ${COVER}`)
    })

    it('is refused where the cover is the rule itself', () => {
      const bothListed = buildLintRules(BOTH_RULESETS)
      const catalog = catalogOf(COVER_SHIPPED, buildShippedRule('react', { coveredBy: COVERED }))

      expect(() => resolveRuleLayers(bothListed, catalog)).toThrowError(`${COVERED}: covered by ${COVERED}`)
    })
  })
})

// Beside oxlint a rule is left out where a rule oxlint runs, which reports every case of it, is on; without
// oxlint ESLint keeps both, its version of the cover reporting less.
describe('a rule covered in oxlint by another', () => {
  const COVER = 'jsx-a11y/lang'
  const COVERED = 'jsx-a11y/html-has-lang'
  const OTHER_ACCESSIBILITY_RULE = 'jsx-a11y/alt-text'
  // Covers the cover, in a chain: a rule of the cover's ruleset.
  const COVER_OF_THE_COVER = 'jsx-a11y/no-autofocus'
  const SRC_FILES = 'src/**'
  const ON: RuleSetting = { severity: 'error', options: [], files: null, ignores: null }
  const OFF: RuleSetting = { severity: 'off', options: [], files: null, ignores: null }
  const WARN: RuleSetting = { severity: 'warn', options: [], files: null, ignores: null }
  const COVERED_SHIPPED = buildShippedRule('accessibility', { coveredInOxlintBy: COVER })
  const COVER_SHIPPED = buildShippedRule('lang')
  const ACCESSIBILITY_ALONE = { quality: ['accessibility'] }
  const BOTH_RULESETS = { quality: ['accessibility', 'lang'] }

  function oxlintRoute(id: string, shipped: ShippedRule | null): RuleRoute {
    return buildOxlintRoute(id, { oxlintName: id.replace('jsx-a11y/', 'jsx_a11y/'), oxlintPlugin: 'jsx_a11y', shipped })
  }

  function catalogOf(cover: RuleRoute, covered: RuleRoute): Catalog {
    return buildCatalog({
      rulesets: [buildQualityRuleset('accessibility'), buildQualityRuleset('lang')],
      rules: [cover, covered, oxlintRoute(OTHER_ACCESSIBILITY_RULE, buildShippedRule('accessibility')), oxlintRoute(COVER_OF_THE_COVER, buildShippedRule('lang'))],
    })
  }

  const coveredCatalog = catalogOf(oxlintRoute(COVER, COVER_SHIPPED), oxlintRoute(COVERED, COVERED_SHIPPED))

  function topLevelRuleIdsOf(resolve: typeof resolveRuleLayers, lintRules: Parameters<typeof resolveRuleLayers>[0]): string[] {
    return Object.keys(resolve(lintRules, coveredCatalog).rules).toSorted()
  }

  describe('at the top level', () => {
    it('is left out beside oxlint where its cover is on, and kept without oxlint', () => {
      const lintRules = buildLintRules(BOTH_RULESETS)

      expect({ besideOxlint: topLevelRuleIdsOf(resolveRuleLayersBesideOxlint, lintRules), withoutOxlint: topLevelRuleIdsOf(resolveRuleLayers, lintRules) }).toStrictEqual({
        besideOxlint: [COVER, COVER_OF_THE_COVER, OTHER_ACCESSIBILITY_RULE].toSorted(),
        withoutOxlint: [COVER, COVER_OF_THE_COVER, COVERED, OTHER_ACCESSIBILITY_RULE].toSorted(),
      })
    })

    it("is kept beside oxlint where its cover's ruleset is not listed", () => {
      expect(topLevelRuleIdsOf(resolveRuleLayersBesideOxlint, buildLintRules(ACCESSIBILITY_ALONE))).toStrictEqual([COVERED, OTHER_ACCESSIBILITY_RULE].toSorted())
    })

    it('comes back beside oxlint where the top-level rules turn its cover off', () => {
      expect(topLevelRuleIdsOf(resolveRuleLayersBesideOxlint, buildLintRules(BOTH_RULESETS, { rules: { [COVER]: 'off' } }))).toStrictEqual(
        [COVER_OF_THE_COVER, COVERED, OTHER_ACCESSIBILITY_RULE].toSorted(),
      )
    })

    it('runs beside oxlint at the setting the top-level rules give it where they name it, its cover on beside it', () => {
      const { rules } = resolveRuleLayersBesideOxlint(buildLintRules(BOTH_RULESETS, { rules: { [COVERED]: 'warn' } }), coveredCatalog)

      expect({ covered: rules[COVERED], cover: rules[COVER] }).toStrictEqual({ covered: WARN, cover: ON })
    })
  })

  describe('in an entry', () => {
    function onlyEntryOf(resolve: typeof resolveRuleLayers, lintRules: Parameters<typeof resolveRuleLayers>[0]): Pick<FileOverrideLayer, 'rulesetChanges' | 'rules'> {
      const [entry, ...rest] = resolve(lintRules, coveredCatalog).fileOverrides
      if (entry === undefined || rest.length > 0) throw new Error('the config gives one entry')
      return { rulesetChanges: entry.rulesetChanges, rules: entry.rules }
    }

    it("is left out beside oxlint of the files of an entry that adds its cover's ruleset, and kept there without oxlint", () => {
      const lintRules = buildLintRules(ACCESSIBILITY_ALONE, { fileOverrides: [buildFileOverride([SRC_FILES], { rulesets: { quality: ['accessibility', 'lang'] } })] })

      expect({ besideOxlint: onlyEntryOf(resolveRuleLayersBesideOxlint, lintRules), withoutOxlint: onlyEntryOf(resolveRuleLayers, lintRules) }).toStrictEqual({
        besideOxlint: { rulesetChanges: { [COVER]: ON, [COVER_OF_THE_COVER]: ON, [COVERED]: OFF }, rules: {} },
        withoutOxlint: { rulesetChanges: { [COVER]: ON, [COVER_OF_THE_COVER]: ON }, rules: {} },
      })
    })

    it("comes back beside oxlint in the files of an entry whose lists drop its cover's ruleset", () => {
      const lintRules = buildLintRules(BOTH_RULESETS, { fileOverrides: [buildFileOverride([SRC_FILES], { rulesets: { quality: ['accessibility'] } })] })

      expect(onlyEntryOf(resolveRuleLayersBesideOxlint, lintRules)).toStrictEqual({ rulesetChanges: { [COVER]: OFF, [COVER_OF_THE_COVER]: OFF, [COVERED]: ON }, rules: {} })
    })
  })

  // The data's tests guarantee a valid cover; the core still throws on a breach, naming both rules.
  describe('a breach of the data', () => {
    it.each([
      { breach: 'ESLint runs the cover', cover: buildEslintRoute(COVER, { typed: false, shipped: COVER_SHIPPED }), covered: oxlintRoute(COVERED, COVERED_SHIPPED) },
      { breach: 'ESLint runs the covered rule', cover: oxlintRoute(COVER, COVER_SHIPPED), covered: buildEslintRoute(COVERED, { typed: false, shipped: COVERED_SHIPPED }) },
      { breach: 'the cover is on whatever rulesets are listed', cover: oxlintRoute(COVER, buildAlwaysOnShippedRule()), covered: oxlintRoute(COVERED, COVERED_SHIPPED) },
      { breach: 'the covered rule is on whatever rulesets are listed', cover: oxlintRoute(COVER, COVER_SHIPPED), covered: oxlintRoute(COVERED, buildAlwaysOnShippedRule({ coveredInOxlintBy: COVER })) },
      { breach: 'the cover is not shipped', cover: oxlintRoute(COVER, null), covered: oxlintRoute(COVERED, COVERED_SHIPPED) },
      { breach: 'the cover is covered in oxlint itself', cover: oxlintRoute(COVER, buildShippedRule('lang', { coveredInOxlintBy: COVER_OF_THE_COVER })), covered: oxlintRoute(COVERED, COVERED_SHIPPED) },
      { breach: 'the cover is covered itself', cover: oxlintRoute(COVER, buildShippedRule('lang', { coveredBy: COVER_OF_THE_COVER })), covered: oxlintRoute(COVERED, COVERED_SHIPPED) },
    ])('is refused beside oxlint where $breach', ({ cover, covered }) => {
      const bothListed = buildLintRules(BOTH_RULESETS)

      expect(() => resolveRuleLayersBesideOxlint(bothListed, catalogOf(cover, covered))).toThrowError(`${COVERED}: covered in oxlint by ${COVER}`)
    })

    it('is none without oxlint, where the relation is not read', () => {
      const bothListed = buildLintRules(BOTH_RULESETS)
      const catalog = catalogOf(buildEslintRoute(COVER, { typed: false, shipped: COVER_SHIPPED }), oxlintRoute(COVERED, COVERED_SHIPPED))

      expect(Object.keys(resolveRuleLayers(bothListed, catalog).rules).toSorted()).toStrictEqual([COVER, COVER_OF_THE_COVER, COVERED, OTHER_ACCESSIBILITY_RULE].toSorted())
    })
  })
})

// An entry of a rule's options may allow calls another shipped rule reports: no-floating-promises leaves an
// unawaited Vitest assertion to vitest/valid-expect. The entry is kept in each layer where that rule is on,
// by the layer's lists or the top-level rules, so each such call is reported once whichever rulesets are listed.
describe.each([
  { resolution: 'without oxlint', resolve: resolveRuleLayers },
  { resolution: 'beside oxlint', resolve: resolveRuleLayersBesideOxlint },
])('an options entry whose calls another rule reports, $resolution', ({ resolve }) => {
  type EntryRuleMaps = Pick<FileOverrideLayer, 'rulesetChanges' | 'rules'>

  const HOLDER = '@typescript-eslint/no-floating-promises'
  const COVER = 'vitest/valid-expect'
  const SAFE_CALLS = 'allowForKnownSafeCalls'
  // Left to no other rule: kept wherever the holder runs.
  const UNMARKED_ENTRY = { from: 'package', package: '@testing-library/dom', name: ['waitFor'] }
  const VITEST_ENTRY = { from: 'package', package: 'vitest', name: '__type' }
  const VITEST_3_ENTRY = { from: 'package', package: '@vitest/expect', name: 'Promisify' }
  const LEGACY_FILES = 'legacy/**'
  const KEPT_LEGACY_FILES = 'legacy/kept/**'
  const CORRECTNESS = buildQualityRuleset('correctness')
  const TESTS = buildQualityRuleset('tests')
  // The cover ships in a list the holder does not, so only the cover's list changes the holder's options.
  const VITEST = buildLibsRuleset('vitest', 'testing')
  const COVER_ON: RuleSetting = { severity: 'error', options: [], files: null, ignores: null }
  const COVER_OFF: RuleSetting = { severity: 'off', options: [], files: null, ignores: null }
  const ALLOWING_EVERY_ENTRY = holderOptionsAllowing([UNMARKED_ENTRY, VITEST_ENTRY, VITEST_3_ENTRY])
  const ALLOWING_THE_UNMARKED_ENTRY_ALONE = holderOptionsAllowing([UNMARKED_ENTRY])
  const OPTIONS_A_TEAM_WRITES = { [SAFE_CALLS]: [VITEST_ENTRY] }
  const WITH_TESTS = { quality: [CORRECTNESS.name, TESTS.name] }
  const WITHOUT_TESTS = { quality: [CORRECTNESS.name] }

  /** Another key of the same options object, kept as shipped. */
  function holderOptionsAllowing(entries: readonly unknown[]): readonly unknown[] {
    return [{ [SAFE_CALLS]: entries, ignoreVoid: true }]
  }

  function leftToTheCover(entry: unknown): { readonly option: string; readonly entry: unknown; readonly rule: string } {
    return { option: SAFE_CALLS, entry, rule: COVER }
  }

  function catalogShippingTheCoverIn(coverRuleset: Readonly<RulesetDefinition>): Catalog {
    return buildCatalog({
      rulesets: [CORRECTNESS, coverRuleset],
      rules: [
        buildEslintRoute(HOLDER, {
          typed: true,
          shipped: buildShippedRule(CORRECTNESS.name, { options: ALLOWING_EVERY_ENTRY, allowancesLeftTo: [leftToTheCover(VITEST_ENTRY), leftToTheCover(VITEST_3_ENTRY)] }),
        }),
        buildOxlintRoute(COVER, { oxlintName: COVER, oxlintPlugin: 'vitest', shipped: buildShippedRule(coverRuleset.name) }),
      ],
    })
  }

  const coverInTests = catalogShippingTheCoverIn(TESTS)
  const coverInALibsRuleset = catalogShippingTheCoverIn(VITEST)

  function topLevelHolderOf(lintRules: Parameters<typeof resolveRuleLayers>[0]): RuleSetting | undefined {
    return resolve(lintRules, coverInTests).rules[HOLDER]
  }

  function entriesOf(lintRules: Parameters<typeof resolveRuleLayers>[0], shippedIn: Readonly<Catalog>): readonly EntryRuleMaps[] {
    return resolve(lintRules, shippedIn).fileOverrides.map(({ rulesetChanges, rules }) => ({ rulesetChanges, rules }))
  }

  describe('at the top level', () => {
    it("keeps it where the cover's ruleset is listed", () => {
      expect(topLevelHolderOf(buildLintRules(WITH_TESTS))).toStrictEqual(holderSetting(ALLOWING_EVERY_ENTRY))
    })

    it("drops it where the cover's ruleset is not listed, keeping the entry left to no rule and the other options", () => {
      expect(topLevelHolderOf(buildLintRules(WITHOUT_TESTS))).toStrictEqual(holderSetting(ALLOWING_THE_UNMARKED_ENTRY_ALONE))
    })

    it.each(['error', 'warn'] as const)('keeps it where the top-level rules turn the cover on at %s, its ruleset not listed', (severity) => {
      expect(topLevelHolderOf(buildLintRules(WITHOUT_TESTS, { rules: { [COVER]: severity } }))).toStrictEqual(holderSetting(ALLOWING_EVERY_ENTRY))
    })

    it('drops it where the top-level rules turn the cover off, its ruleset listed', () => {
      expect(topLevelHolderOf(buildLintRules(WITH_TESTS, { rules: { [COVER]: 'off' } }))).toStrictEqual(holderSetting(ALLOWING_THE_UNMARKED_ENTRY_ALONE))
    })

    it('uses the options the top-level rules write for the holder as written, the cover off', () => {
      expect(topLevelHolderOf(buildLintRules(WITHOUT_TESTS, { rules: { [HOLDER]: ['error', OPTIONS_A_TEAM_WRITES] } }))).toStrictEqual(holderSetting([OPTIONS_A_TEAM_WRITES]))
    })

    it('gives a severity alone the options in force, without the entry, the cover off', () => {
      expect(topLevelHolderOf(buildLintRules(WITHOUT_TESTS, { rules: { [HOLDER]: 'warn' } }))).toStrictEqual(holderSetting(ALLOWING_THE_UNMARKED_ENTRY_ALONE, 'warn'))
    })
  })

  describe('in an entry', () => {
    it("restates the holder without it in the files of an entry whose lists drop the cover's ruleset", () => {
      const lintRules = buildLintRules(WITH_TESTS, { fileOverrides: [buildFileOverride([LEGACY_FILES], { rulesets: WITHOUT_TESTS })] })

      expect(entriesOf(lintRules, coverInTests)).toStrictEqual([{ rulesetChanges: { [COVER]: COVER_OFF, [HOLDER]: holderSetting(ALLOWING_THE_UNMARKED_ENTRY_ALONE) }, rules: {} }])
    })

    it("restates the holder with it in the files of an entry whose lists add the cover's ruleset", () => {
      const lintRules = buildLintRules(WITHOUT_TESTS, { fileOverrides: [buildFileOverride([LEGACY_FILES], { rulesets: WITH_TESTS })] })

      expect(entriesOf(lintRules, coverInTests)).toStrictEqual([{ rulesetChanges: { [COVER]: COVER_ON, [HOLDER]: holderSetting(ALLOWING_EVERY_ENTRY) }, rules: {} }])
    })

    it('restates nothing in the files of an entry whose lists leave the cover as the top level has it', () => {
      const lintRules = buildLintRules(WITH_TESTS, { fileOverrides: [buildFileOverride([LEGACY_FILES], { rulesets: WITH_TESTS })] })

      expect(entriesOf(lintRules, coverInTests)).toStrictEqual([{ rulesetChanges: {}, rules: {} }])
    })

    it("restates the holder with it again in a later entry re-adding the cover's ruleset over an earlier entry that dropped it", () => {
      const lintRules = buildLintRules(WITH_TESTS, {
        fileOverrides: [buildFileOverride([LEGACY_FILES], { rulesets: WITHOUT_TESTS }), buildFileOverride([KEPT_LEGACY_FILES], { rulesets: WITH_TESTS })],
      })

      expect(entriesOf(lintRules, coverInTests)).toStrictEqual([
        { rulesetChanges: { [COVER]: COVER_OFF, [HOLDER]: holderSetting(ALLOWING_THE_UNMARKED_ENTRY_ALONE) }, rules: {} },
        { rulesetChanges: { [COVER]: COVER_ON, [HOLDER]: holderSetting(ALLOWING_EVERY_ENTRY) }, rules: {} },
      ])
    })

    // The holder ships in the quality list, which neither entry gives: the cover's list counts for it too.
    it("restates the holder in entries giving only the cover's list, where the cover ships in a list the holder does not", () => {
      const lintRules = buildLintRules(
        { quality: [CORRECTNESS.name], libs: { testing: [VITEST.name] } },
        { fileOverrides: [buildFileOverride([LEGACY_FILES], { rulesets: { libs: { testing: [] } } }), buildFileOverride([KEPT_LEGACY_FILES], { rulesets: { libs: { testing: [VITEST.name] } } })] },
      )

      expect(entriesOf(lintRules, coverInALibsRuleset)).toStrictEqual([
        { rulesetChanges: { [COVER]: COVER_OFF, [HOLDER]: holderSetting(ALLOWING_THE_UNMARKED_ENTRY_ALONE) }, rules: {} },
        { rulesetChanges: { [COVER]: COVER_ON, [HOLDER]: holderSetting(ALLOWING_EVERY_ENTRY) }, rules: {} },
      ])
    })

    it("gives a severity alone in an entry's own rules the options in force in its files, without the entry where its lists drop the cover", () => {
      const lintRules = buildLintRules(WITH_TESTS, { fileOverrides: [buildFileOverride([LEGACY_FILES], { rulesets: WITHOUT_TESTS, rules: { [HOLDER]: 'warn' } })] })

      expect(entriesOf(lintRules, coverInTests).map(({ rules }) => rules)).toStrictEqual([{ [HOLDER]: holderSetting(ALLOWING_THE_UNMARKED_ENTRY_ALONE, 'warn') }])
    })

    // Its lists turn the holder off too, so the options in force are the shipped ones, entry and all.
    it("gives a severity alone in an entry's own rules the shipped options without the entry, where its lists turn neither rule on", () => {
      const lintRules = buildLintRules(WITH_TESTS, { fileOverrides: [buildFileOverride([LEGACY_FILES], { rulesets: { quality: [] }, rules: { [HOLDER]: 'warn' } })] })

      expect(entriesOf(lintRules, coverInTests).map(({ rules }) => rules)).toStrictEqual([{ [HOLDER]: holderSetting(ALLOWING_THE_UNMARKED_ENTRY_ALONE, 'warn') }])
    })

    // The options in force in its files are the team's, so the severity is all that changes there.
    it("gives a severity alone in an entry's own rules the options the top-level rules write for the holder, as written, the cover off", () => {
      const lintRules = buildLintRules(WITHOUT_TESTS, {
        rules: { [HOLDER]: ['error', OPTIONS_A_TEAM_WRITES] },
        fileOverrides: [buildFileOverride([LEGACY_FILES], { rules: { [HOLDER]: 'warn' } })],
      })

      expect(entriesOf(lintRules, coverInTests).map(({ rules }) => rules)).toStrictEqual([{ [HOLDER]: holderSetting([OPTIONS_A_TEAM_WRITES], 'warn') }])
    })

    it("uses the options an entry's own rules write for the holder as written, where its lists turn neither rule on", () => {
      const lintRules = buildLintRules(WITH_TESTS, { fileOverrides: [buildFileOverride([LEGACY_FILES], { rulesets: { quality: [] }, rules: { [HOLDER]: ['error', OPTIONS_A_TEAM_WRITES] } })] })

      expect(entriesOf(lintRules, coverInTests).map(({ rules }) => rules)).toStrictEqual([{ [HOLDER]: holderSetting([OPTIONS_A_TEAM_WRITES]) }])
    })

    it("uses the options an entry's own rules write for the holder as written, its lists dropping the cover", () => {
      const lintRules = buildLintRules(WITH_TESTS, { fileOverrides: [buildFileOverride([LEGACY_FILES], { rulesets: WITHOUT_TESTS, rules: { [HOLDER]: ['error', OPTIONS_A_TEAM_WRITES] } })] })

      expect(entriesOf(lintRules, coverInTests).map(({ rules }) => rules)).toStrictEqual([{ [HOLDER]: holderSetting([OPTIONS_A_TEAM_WRITES]) }])
    })

    // A known limit, as for a cover: an entry's own rules do not move the entry, in either direction.
    it("restates nothing where an entry's own rules turn the cover on, the top level dropping the entry", () => {
      const lintRules = buildLintRules(WITHOUT_TESTS, { fileOverrides: [buildFileOverride([LEGACY_FILES], { rules: { [COVER]: 'error' } })] })

      expect(entriesOf(lintRules, coverInTests)).toStrictEqual([{ rulesetChanges: {}, rules: { [COVER]: COVER_ON } }])
    })

    it("restates nothing where an entry's own rules turn the cover off, the top level keeping the entry", () => {
      const lintRules = buildLintRules(WITH_TESTS, { fileOverrides: [buildFileOverride([LEGACY_FILES], { rules: { [COVER]: 'off' } })] })

      expect(entriesOf(lintRules, coverInTests)).toStrictEqual([{ rulesetChanges: {}, rules: { [COVER]: COVER_OFF } }])
    })
  })
})

/** The rule holding the entries, on every file. */
function holderSetting(options: readonly unknown[], severity: RuleSetting['severity'] = 'error'): RuleSetting {
  return { severity, options, files: null, ignores: null }
}

describe('layersKeepingRules, given an entry that gives allowSuppressions', () => {
  const BLANKET_DISABLE_RULE = 'unicorn/no-abusive-eslint-disable'
  const routedToBothEngines = buildCatalog({
    rulesets: [],
    rules: [
      buildEslintRoute('demo/strict', { typed: false, shipped: buildSuppressionModeShippedRule() }),
      buildOxlintRoute(BLANKET_DISABLE_RULE, {
        oxlintName: BLANKET_DISABLE_RULE,
        oxlintPlugin: 'unicorn',
        shipped: buildShippedRuleDecidedBySuppressions({ banned: 'off', allowed: { options: [] } }),
      }),
    ],
  })

  it("keeps in the entry's suppression rules only the rules it is told to, so ruleIdsOnIn names no other", () => {
    const lintRules = buildLintRules({}, { allowSuppressions: true, fileOverrides: [buildFileOverride(['strict/**'], { allowSuppressions: false })] })
    const kept = layersKeepingRules(resolveRuleLayers(lintRules, routedToBothEngines), ({ id }) => id === 'demo/strict')

    expect({
      entrySuppressionRules: kept.fileOverrides.map((layer) => Object.keys(suppressionRulesOf(layer))),
      ruleIdsOn: ruleIdsOnIn(kept),
    }).toStrictEqual({ entrySuppressionRules: [['demo/strict']], ruleIdsOn: ['demo/strict'] })
  })
})
