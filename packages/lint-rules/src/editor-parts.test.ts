import type { Catalog, RuleRoute } from '@workspace/rule-data'
import { buildShippedRule } from '@workspace/rule-data/test-support/shipped-rule-factories'
import { describe, expect, it } from 'vitest'
import { buildCatalog, buildEslintRoute, buildOxlintRoute, buildPluginRegistry, buildQualityRuleset } from './__tests__/factories/catalog-factories.ts'
import {
  buildEveryRulesetLintRules,
  buildLintRules,
  buildTwoSetFileOverride,
  buildTwoSetLintRules,
} from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOthers, createProjectListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { buildProjectFacts } from './__tests__/factories/project-facts-factories.ts'
import { pathsOfFunctionsIn } from './__tests__/functions-in.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'
import { buildEslintConfig } from './core/build-eslint-config.ts'
import { editorPartsOf } from './core/editor-parts.ts'
import type { RuleSetting, RuleSettings } from './core/resolve-rule-layers.ts'
import { defineLintRules } from './index.ts'

// The parts are plain data, so importing agents-inc.lint.mts costs only the catalog: ESLint's plugins
// and parser load only when a team's ESLint config imports the merge.

const EDITOR_PART_KEYS = ['eslint', 'oxlint']

const tempProjects = setUpTempProjects()
const PROJECT_WITH_OXLINT = createProjectListingOxlint(tempProjects)
const PROJECT_WITHOUT_OXLINT = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOthers()) } })

const PROJECTS = [
  { project: 'whose package.json lists oxlint', projectDir: PROJECT_WITH_OXLINT, partTypes: { eslint: 'object', oxlint: 'object' } },
  { project: 'whose package.json lists no oxlint', projectDir: PROJECT_WITHOUT_OXLINT, partTypes: { eslint: 'object', oxlint: 'undefined' } },
]

describe('what defineLintRules returns', () => {
  it.each(PROJECTS)('is the editor parts and nothing else, for a project $project', ({ projectDir }) => {
    const config = defineLintRules(buildEveryRulesetLintRules(projectDir))

    expect({
      keys: Object.keys(config),
      partKeysBesideTheTwo: Object.keys(config.editorRulesets).filter((key) => !EDITOR_PART_KEYS.includes(key)),
    }).toStrictEqual({ keys: ['editorRulesets'], partKeysBesideTheTwo: [] })
  })

  it.each(PROJECTS)('holds parts that are data, with no function anywhere in them, for a project $project', ({ projectDir, partTypes }) => {
    const { editorRulesets } = defineLintRules(buildEveryRulesetLintRules(projectDir))

    expect({
      partTypes: { eslint: typeof editorRulesets.eslint, oxlint: typeof editorRulesets.oxlint },
      functions: pathsOfFunctionsIn(editorRulesets),
    }).toStrictEqual({ partTypes, functions: [] })
  })

  it('holds both parts for a project whose package.json lists oxlint', () => {
    const { eslint, oxlint } = defineLintRules(buildEveryRulesetLintRules(PROJECT_WITH_OXLINT)).editorRulesets

    expect({ eslint: typeof eslint, oxlint: typeof oxlint }).toStrictEqual({ eslint: 'object', oxlint: 'object' })
  })

  it('holds no oxlint part for a project whose package.json lists none', () => {
    const { eslint, oxlint } = defineLintRules(buildEveryRulesetLintRules(PROJECT_WITHOUT_OXLINT)).editorRulesets

    expect({ eslint: typeof eslint, oxlint }).toStrictEqual({ eslint: 'object', oxlint: undefined })
  })
})

// The ESLint part keeps the oxlint part's layers, read to turn off typescript-eslint's extensions where
// oxlint runs their core rule; the oxlint part names the rules the ESLint part turns on, read to turn
// off oxlint's silent copies of them.
describe('the parts of a project whose package.json lists oxlint', () => {
  it("hold their engine, the project root and their layers, the ESLint part beside oxlint the oxlint part's layers too, the oxlint part the rules the ESLint part turns on, and nothing else", () => {
    const { eslint, oxlint } = defineLintRules(buildEveryRulesetLintRules(PROJECT_WITH_OXLINT)).editorRulesets

    expect({ eslint: Object.keys(eslint).toSorted(), oxlint: oxlint === undefined ? undefined : Object.keys(oxlint).toSorted() }).toStrictEqual({
      eslint: ['engine', 'layers', 'oxlintLayers', 'tsconfigRootDir', 'usesOxlint'],
      oxlint: ['engine', 'layers', 'tsconfigRootDir', 'turnedOnInEslint'],
    })
  })
})

// Without oxlint, wherever the layers state an oxc rule, the ESLint part states its stand-in with the
// oxc rule's severity, files and ignores but none of its options, and the oxc rule not at all.
/** The rules the editor ESLint part of a project without oxlint runs, the correctness ruleset listed, under the catalog given. */
function eslintRulesWith(catalog: Catalog): RuleSettings {
  return editorPartsOf(buildTwoSetLintRules({ editorRulesets: { quality: ['correctness'] } }), catalog, false).eslint.layers.rules
}

describe('the stand-ins for oxlint-only rules', () => {
  const CHAINED_OXC = 'oxc/bad-comparison-sequence'
  const CHAINED_STAND_IN = 'unicorn/no-chained-comparison'
  const DOUBLE_OXC = 'oxc/double-comparisons'
  const DOUBLE_STAND_IN = 'unicorn/no-double-comparison'
  const ESLINT_RULE = 'unicorn/no-array-for-each'
  const LEGACY_FILES = 'legacy/**'
  const TEST_FILES = ['**/*.test.js']
  // An option no oxc rule takes: a factory's oxc rule ships it, so a spec sees it is not carried over.
  const OXC_OPTIONS = [{ strict: true }]

  const standInCatalog = buildCatalog({
    rulesets: [buildQualityRuleset('correctness')],
    rules: [
      buildOxlintRoute(CHAINED_OXC, { oxlintName: CHAINED_OXC, oxlintPlugin: 'oxc', shipped: buildShippedRule('correctness', { options: OXC_OPTIONS, ignores: TEST_FILES }) }),
      buildOxlintRoute(DOUBLE_OXC, { oxlintName: DOUBLE_OXC, oxlintPlugin: 'oxc', shipped: buildShippedRule('correctness') }),
      buildEslintRoute(CHAINED_STAND_IN, { typed: false, shipped: null }),
      buildEslintRoute(DOUBLE_STAND_IN, { typed: false, shipped: null }),
      buildEslintRoute(ESLINT_RULE, { typed: false, shipped: buildShippedRule('correctness') }),
    ],
    eslintStandIns: new Map([
      [CHAINED_OXC, CHAINED_STAND_IN],
      [DOUBLE_OXC, DOUBLE_STAND_IN],
    ]),
  })

  const ON: RuleSetting = { severity: 'error', options: [], files: null, ignores: null }
  const WARN: RuleSetting = { severity: 'warn', options: [], files: null, ignores: null }
  const OFF: RuleSetting = { severity: 'off', options: [], files: null, ignores: null }
  const CHAINED_STAND_IN_ON: RuleSetting = { ...ON, ignores: TEST_FILES }

  function editorPartsWith(fields: Parameters<typeof buildTwoSetLintRules>[1], usesOxlint: boolean): ReturnType<typeof editorPartsOf> {
    return editorPartsOf(buildTwoSetLintRules({ editorRulesets: { quality: ['correctness'] } }, fields), standInCatalog, usesOxlint)
  }

  describe('in a project without oxlint', () => {
    it("state each stand-in at its oxc rule's severity, files and ignores, with no options, and neither oxc rule", () => {
      const { eslint, oxlint } = editorPartsWith({}, false)

      expect({ eslint: eslint.layers.rules, oxlint }).toStrictEqual({
        eslint: { [CHAINED_STAND_IN]: CHAINED_STAND_IN_ON, [DOUBLE_STAND_IN]: ON, [ESLINT_RULE]: ON },
        oxlint: undefined,
      })
    })

    it('turn a stand-in off where the rules turn its oxc rule off, and keep the other on', () => {
      const { eslint } = editorPartsWith({ rules: { [CHAINED_OXC]: 'off' } }, false)

      expect(eslint.layers.rules).toStrictEqual({ [DOUBLE_STAND_IN]: ON, [ESLINT_RULE]: ON })
    })

    it("give a stand-in an entry's setting of its oxc rule, in the entry's files", () => {
      const { eslint } = editorPartsWith({ fileOverrides: [buildTwoSetFileOverride([LEGACY_FILES], { rules: { [CHAINED_OXC]: 'warn', [DOUBLE_OXC]: 'off' } })] }, false)
      const [entry] = eslint.layers.fileOverrides

      expect(entry === undefined ? undefined : entry.rules).toStrictEqual({ [CHAINED_STAND_IN]: { ...WARN, ignores: TEST_FILES }, [DOUBLE_STAND_IN]: OFF })
    })

    it("state the stand-in once, at the consumer's own setting of it, where the rules name it too", () => {
      const { eslint } = editorPartsWith({ rules: { [CHAINED_STAND_IN]: 'warn' } }, false)

      expect(eslint.layers.rules).toStrictEqual({ [CHAINED_STAND_IN]: WARN, [DOUBLE_STAND_IN]: ON, [ESLINT_RULE]: ON })
    })
  })

  describe('in a project with oxlint', () => {
    it('are stated by neither part, the oxlint part stating the oxc rules', () => {
      const { eslint, oxlint } = editorPartsWith({}, true)

      expect({ eslint: eslint.layers.rules, oxlint: oxlint === undefined ? undefined : Object.keys(oxlint.layers.rules).toSorted() }).toStrictEqual({
        eslint: { [ESLINT_RULE]: ON },
        oxlint: [CHAINED_OXC, DOUBLE_OXC],
      })
    })
  })

  it('are stated by no block of the agent build', () => {
    const config = buildEslintConfig(
      buildLintRules({ quality: ['correctness'] }),
      standInCatalog,
      buildPluginRegistry({ unicorn: ['no-chained-comparison', 'no-double-comparison', 'no-array-for-each'] }),
      buildProjectFacts(),
    )

    expect(config.filter(({ rules = {} }) => [CHAINED_STAND_IN, DOUBLE_STAND_IN].some((standIn) => Object.hasOwn(rules, standIn))).map(({ name }) => name)).toStrictEqual([])
  })

  // The data's tests guarantee the stand-ins; the core still throws on a breach, which would run a rule
  // twice, or the stand-in nowhere or where it cannot run.
  describe('a breach of the data, in a project without oxlint', () => {
    const chainedOxc = buildOxlintRoute(CHAINED_OXC, { oxlintName: CHAINED_OXC, oxlintPlugin: 'oxc', shipped: buildShippedRule('correctness') })
    const doubleOxc = buildOxlintRoute(DOUBLE_OXC, { oxlintName: DOUBLE_OXC, oxlintPlugin: 'oxc', shipped: buildShippedRule('correctness') })
    const standIn = buildEslintRoute(CHAINED_STAND_IN, { typed: false, shipped: null })
    const ONE_STAND_IN = new Map([[CHAINED_OXC, CHAINED_STAND_IN]])
    const ONE_STAND_IN_FOR_TWO = new Map([
      [CHAINED_OXC, CHAINED_STAND_IN],
      [DOUBLE_OXC, CHAINED_STAND_IN],
    ])

    function catalogOf(rules: readonly RuleRoute[], eslintStandIns: ReadonlyMap<string, string>): Catalog {
      return buildCatalog({ rulesets: [buildQualityRuleset('correctness')], rules, eslintStandIns })
    }

    it('is none where the oxlint-only rule is one oxlint runs alone and its stand-in an untyped ESLint rule, not shipped, standing in for it alone', () => {
      expect(eslintRulesWith(catalogOf([chainedOxc, standIn], ONE_STAND_IN))).toStrictEqual({ [CHAINED_STAND_IN]: ON })
    })

    it.each([
      {
        breach: 'the stand-in is a rule oxlint runs',
        catalog: catalogOf([chainedOxc, buildOxlintRoute(CHAINED_STAND_IN, { oxlintName: 'no-chained-comparison', oxlintPlugin: 'unicorn', shipped: null })], ONE_STAND_IN),
      },
      { breach: 'the stand-in needs type information', catalog: catalogOf([chainedOxc, buildEslintRoute(CHAINED_STAND_IN, { typed: true, shipped: null })], ONE_STAND_IN) },
      { breach: 'the stand-in is shipped', catalog: catalogOf([chainedOxc, buildEslintRoute(CHAINED_STAND_IN, { typed: false, shipped: buildShippedRule('correctness') })], ONE_STAND_IN) },
      { breach: 'the oxlint-only rule is one ESLint runs', catalog: catalogOf([buildEslintRoute(CHAINED_OXC, { typed: false, shipped: buildShippedRule('correctness') }), standIn], ONE_STAND_IN) },
      {
        breach: 'ESLint has a version of the oxlint-only rule',
        catalog: { ...catalogOf([chainedOxc, standIn], ONE_STAND_IN), ruleIdsWithAnEslintVersion: new Set([CHAINED_OXC, CHAINED_STAND_IN]) },
      },
    ])('is refused where $breach', ({ catalog }) => {
      expect(() => eslintRulesWith(catalog)).toThrowError(`${CHAINED_OXC}: stood in for by ${CHAINED_STAND_IN}`)
    })

    it('is refused where the stand-in stands in for two oxlint-only rules', () => {
      expect(() => eslintRulesWith(catalogOf([chainedOxc, doubleOxc, standIn], ONE_STAND_IN_FOR_TWO))).toThrowError(
        new RegExp(`^(${CHAINED_OXC}|${DOUBLE_OXC}): stood in for by ${CHAINED_STAND_IN}`, 'u'),
      )
    })
  })
})
