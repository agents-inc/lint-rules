import { describe, expect, it } from 'vitest'

import rulesetDefinitions from '../data/ruleset-definitions.json' with { type: 'json' }
import { RULES_UNICORN_78_ADDS } from './__tests__/cases/plugin-upgrades.ts'
import { ROUND_2_DROPS, RULES_NEEDING_NEWER_NODE } from './__tests__/cases/round-2-drops.ts'
import { ALLOWANCES_LEFT_TO } from './__tests__/cases/rule-relations.ts'
import { isOptInRuleset, isSortingRuleset } from './__tests__/cases/sorting-rulesets.ts'
import { TEST_FILE_GLOBS } from './__tests__/cases/test-file-globs.ts'
import { buildEslintRoute, buildEslintRoutingEntry, buildOxlintRoute, buildOxlintRoutingEntry } from './__tests__/factories/inventory-factories.ts'
import { buildShippedRule } from './__tests__/factories/shipped-rule-factories.ts'
import { negatedShippedGlobsIn } from './__tests__/negated-globs.ts'
import { coreRulesExtendedMoreThanOnce, twinsSharedByShippedRules } from './__tests__/twin-offenders.ts'
import { typescriptEslintExtensions } from './__tests__/typescript-eslint-extensions.ts'
import { catalog, isOxlintRoute, parseRuleRoute, routeOf, shippedRuleOf } from './catalog.ts'
import inventory from './generated/inventory.json' with { type: 'json' }
import { ruleNameOf } from './rule-id-parts.ts'

const routes = [...catalog.rules.values()]
const nativeOxlintNameById: ReadonlyMap<string, string> = new Map(
  inventory.rules.flatMap<[string, string]>(({ id, oxlint }) => (oxlint === null ? [] : [[id, oxlint.oxlintName]])),
)

/** A relation as the catalog gives it: another rule's ID, or null for none. */
function isRelationValue(value: unknown): boolean {
  return value === null || typeof value === 'string'
}

describe('the catalog, src/generated/routing.json', () => {
  describe('offenders, each list empty', () => {
    it("has no RuleId oxlint implements whose oxlint spellings leave out oxlint's own name, whichever engine runs it", () => {
      const withoutOwnName = routes
        .filter((route) => {
          const nativeName = nativeOxlintNameById.get(route.id)
          return nativeName !== undefined && !route.oxlintSpellings.includes(nativeName)
        })
        .map((route) => `${route.id} (${route.engine})`)

      expect(withoutOwnName).toStrictEqual([])
    })

    it('has no RuleId oxlint does not implement with an oxlint spelling', () => {
      const spelledWithoutOxlint = routes
        .filter((route) => !nativeOxlintNameById.has(route.id) && route.oxlintSpellings.length > 0)
        .map((route) => route.id)

      expect(spelledWithoutOxlint).toStrictEqual([])
    })

    it('has no oxlint spellings out of strictly ascending order, so none is listed twice', () => {
      const unsorted = routes
        .filter((route) =>
          route.oxlintSpellings.some((spelling, index) => {
            const previous = route.oxlintSpellings[index - 1]
            return previous !== undefined && previous >= spelling
          }),
        )
        .map((route) => route.id)

      expect(unsorted).toStrictEqual([])
    })

    // The ESLint merge narrows a typed rule of ours to the files a team block types by putting the
    // team's ignores before ours. A later negation takes back what an earlier ignore matched, so a
    // negation among ours would put the rule back in a file the team lints without types.
    it("has no shipped files or ignores glob that is a negation, which would take back a file a team's ignores leave out", () => {
      expect(negatedShippedGlobsIn(catalog.rules.values())).toStrictEqual([])
    })

    // The ESLint merge gives a team its typescript-eslint twin back where an entry of ours turns our rule
    // off. A twin shared by another rule of ours would come back where that rule runs, and report twice.
    it('has no core rule more than one installed rule extends', () => {
      expect(coreRulesExtendedMoreThanOnce(catalog.coreRuleExtensions)).toStrictEqual([])
    })

    it('has no typescript-eslint twin two shipped rules share', () => {
      expect(twinsSharedByShippedRules(catalog.rules.values(), catalog.coreRuleExtensions)).toStrictEqual([])
    })
  })

  describe('the walks the twin offenders lists read', () => {
    it('name each core rule more than one rule extends, and none one rule extends', () => {
      const coreRuleExtensions = new Map([
        ['no-shadow', ['@typescript-eslint/no-shadow']],
        ['no-invalid-this', ['@typescript-eslint/no-invalid-this', 'other/no-invalid-this']],
      ])

      expect(coreRulesExtendedMoreThanOnce(coreRuleExtensions)).toStrictEqual([
        'no-invalid-this: @typescript-eslint/no-invalid-this, other/no-invalid-this',
      ])
    })

    it("name a twin two shipped rules share, and none a shipped rule shares with its own twin, or with an unshipped rule", () => {
      const coreRuleExtensions = new Map([
        ['no-invalid-this', ['@typescript-eslint/no-invalid-this', 'other/no-invalid-this']],
        ['no-shadow', ['@typescript-eslint/no-shadow']],
        ['no-loop-func', ['@typescript-eslint/no-loop-func', 'other/no-loop-func']],
      ])
      const shipped = buildShippedRule('quality')
      const routes = [
        buildEslintRoute('@typescript-eslint/no-invalid-this', { typed: false, oxlintSpellings: [], shipped }),
        buildEslintRoute('other/no-invalid-this', { typed: false, oxlintSpellings: [], shipped }),
        buildEslintRoute('no-shadow', { typed: false, oxlintSpellings: [], shipped }),
        buildEslintRoute('@typescript-eslint/no-shadow', { typed: false, oxlintSpellings: [], shipped }),
        buildEslintRoute('@typescript-eslint/no-loop-func', { typed: false, oxlintSpellings: [], shipped }),
        buildEslintRoute('other/no-loop-func', { typed: false, oxlintSpellings: [], shipped: null }),
      ]

      expect(twinsSharedByShippedRules(routes, coreRuleExtensions)).toStrictEqual([
        'no-invalid-this: @typescript-eslint/no-invalid-this, other/no-invalid-this',
      ])
    })
  })

  describe('the walk the negation offenders list reads', () => {
    it('names each negated files and ignores glob of a shipped rule, and none led by a character class, a plain glob or an unshipped rule', () => {
      const routes = [
        buildEslintRoute('plugin/negates-files', {
          typed: false,
          oxlintSpellings: [],
          shipped: buildShippedRule('quality', { files: ['**/*.ts', '!**/*.d.ts'] }),
        }),
        buildEslintRoute('plugin/negates-ignores', {
          typed: false,
          oxlintSpellings: [],
          shipped: buildShippedRule('quality', { ignores: ['**/legacy/**', '!**/legacy/typed/**'] }),
        }),
        buildEslintRoute('plugin/negates-a-character', {
          typed: false,
          oxlintSpellings: [],
          shipped: buildShippedRule('quality', { files: ['**/[!_]*.ts'], ignores: ['**/use[A-Z]*.ts'] }),
        }),
        buildEslintRoute('plugin/unshipped', { typed: false, oxlintSpellings: [], shipped: null }),
      ]

      expect(negatedShippedGlobsIn(routes)).toStrictEqual([
        'plugin/negates-files files: !**/*.d.ts',
        'plugin/negates-ignores ignores: !**/legacy/typed/**',
      ])
    })
  })

  // The merge turns a team's twin of our rule off where ours runs, so a missed twin reports twice. The
  // expectation is read from the installed typescript-eslint, deprecated extensions included.
  describe('coreRuleExtensions', () => {
    it('holds, for each core rule, exactly the typescript-eslint rules that extend it, as the installed typescript-eslint names them', () => {
      const extensions = typescriptEslintExtensions()
      const coreRules = [...new Set(extensions.map(({ coreRule }) => coreRule))]
      const expected = new Map(
        coreRules.map((coreRule) => [coreRule, extensions.filter((extension) => extension.coreRule === coreRule).map(({ id }) => id)]),
      )

      expect(catalog.coreRuleExtensions).toStrictEqual(expected)
    })
  })

  // rules.json records a relation on one rule of a pair; the catalog gives every shipped rule both,
  // the other rule's ID or null.
  describe("each shipped rule's relations to other shipped rules", () => {
    it("parses each as the other rule's ID where rules.json records one, and as null where it records none", () => {
      const relationsById = Object.fromEntries(
        ['no-return-assign', 'no-throw-literal', 'eqeqeq'].map((id) => {
          const { coveredBy, splitByTypesWith } = shippedRuleOf(routeOf(id, catalog))
          return [id, { coveredBy, splitByTypesWith }]
        }),
      )

      expect(relationsById).toStrictEqual({
        'no-return-assign': { coveredBy: 'sonarjs/no-nested-assignment', splitByTypesWith: null },
        'no-throw-literal': { coveredBy: null, splitByTypesWith: '@typescript-eslint/only-throw-error' },
        eqeqeq: { coveredBy: null, splitByTypesWith: null },
      })
    })

    // A relation of the oxlint part alone: the editor ESLint part without oxlint keeps both rules.
    it('parses "covered in oxlint by" as the other rule\'s ID on jsx-a11y/html-has-lang, and as null on every other shipped rule', () => {
      const coveredInOxlint = routes.flatMap(({ id, shipped }) => (shipped !== null && shipped.coveredInOxlintBy !== null ? [[id, shipped.coveredInOxlintBy]] : []))

      expect(coveredInOxlint).toStrictEqual([['jsx-a11y/html-has-lang', 'jsx-a11y/lang']])
    })

    it('gives every shipped rule each relation, an ID or null', () => {
      const withoutEach = routes
        .filter(({ shipped }) => shipped !== null && ![shipped.coveredBy, shipped.coveredInOxlintBy, shipped.splitByTypesWith].every(isRelationValue))
        .map(({ id }) => id)

      expect(withoutEach).toStrictEqual([])
    })
  })

  // rules.json records each options entry left to another rule on the rule holding it; the catalog gives every
  // shipped rule a list of them, empty where rules.json records none.
  describe('the options entries each shipped rule leaves to another rule', () => {
    it("parses each as its option, entry and the other rule's ID on no-floating-promises, and as none on a rule recording none", () => {
      const holder = '@typescript-eslint/no-floating-promises'
      const leftToById = Object.fromEntries([holder, 'eqeqeq'].map((id) => [id, shippedRuleOf(routeOf(id, catalog)).allowancesLeftTo]))

      expect(leftToById).toStrictEqual({
        [holder]: ALLOWANCES_LEFT_TO.filter((allowance) => allowance.holder === holder).map(({ option, entry, leftTo }) => ({ option, entry, rule: leftTo })),
        eqeqeq: [],
      })
    })

    it('gives every shipped rule a list', () => {
      const withoutOne = routes.filter(({ shipped }) => shipped !== null && !Array.isArray(shipped.allowancesLeftTo)).map(({ id }) => id)

      expect(withoutOne).toStrictEqual([])
    })
  })

  // rules.json marks each rule our runtimes' globals serve; the catalog gives every shipped rule the
  // mark, false where rules.json gives none.
  describe("whether our runtimes' globals serve each shipped rule", () => {
    it('parses it as true where rules.json marks the rule, and as false where it does not', () => {
      const markById = Object.fromEntries(['no-undef', 'eqeqeq'].map((id) => [id, shippedRuleOf(routeOf(id, catalog)).readsRuntimeGlobals]))

      expect(markById).toStrictEqual({ 'no-undef': true, eqeqeq: false })
    })

    it('gives every shipped rule a boolean', () => {
      const withoutOne = routes.filter(({ shipped }) => shipped !== null && typeof shipped.readsRuntimeGlobals !== 'boolean').map(({ id }) => id)

      expect(withoutOne).toStrictEqual([])
    })
  })

  describe('the rulesets', () => {
    it("carries each ruleset's optIn and sortsCode, both true on the rulesets that sort code, optIn alone on tailwind and browser-targets, and both false on every other", () => {
      expect(catalog.rulesets.map(({ name, optIn, sortsCode }) => [name, optIn, sortsCode])).toStrictEqual(
        rulesetDefinitions.map(({ name }) => [name, isOptInRuleset(name), isSortingRuleset(name)]),
      )
    })
  })

  describe('pinned routes', () => {
    // oxlint matches a suppression comment by rule name alone, so beside oxlint a comment naming the RuleId
    // misses a rule oxlint runs under another name: the merge states ESLint stubs for oxlint's names. A
    // third rename needs those stubs checked for it.
    it('runs exactly the two renamed unicorn rules in oxlint under a rule name of its own', () => {
      const renamedInOxlint = routes
        .filter(isOxlintRoute)
        .filter((route) => ruleNameOf(route.id) !== ruleNameOf(route.oxlintName))
        .map((route) => `${route.id} (oxlint: ${route.oxlintName})`)

      expect(renamedInOxlint).toStrictEqual([
        'unicorn/dom-node-dataset (oxlint: unicorn/prefer-dom-node-dataset)',
        'unicorn/no-for-each (oxlint: unicorn/no-array-for-each)',
      ])
    })

    it('runs unicorn/no-for-each in oxlint under its old name, and keeps the spellings oxlint knows it by', () => {
      const { engine, oxlintName, oxlintPlugin, oxlintSpellings } = routeOf('unicorn/no-for-each', catalog)

      expect({ engine, oxlintName, oxlintPlugin, oxlintSpellings }).toStrictEqual({
        engine: 'oxlint',
        oxlintName: 'unicorn/no-array-for-each',
        oxlintPlugin: 'unicorn',
        oxlintSpellings: ['eslint-plugin-unicorn/no-array-for-each', 'unicorn/no-array-for-each'],
      })
    })

    it('runs unicorn/dom-node-dataset in oxlint under its old name, and keeps the spellings oxlint knows it by', () => {
      const { engine, oxlintName, oxlintPlugin, oxlintSpellings } = routeOf('unicorn/dom-node-dataset', catalog)

      expect({ engine, oxlintName, oxlintPlugin, oxlintSpellings }).toStrictEqual({
        engine: 'oxlint',
        oxlintName: 'unicorn/prefer-dom-node-dataset',
        oxlintPlugin: 'unicorn',
        oxlintSpellings: ['eslint-plugin-unicorn/prefer-dom-node-dataset', 'unicorn/prefer-dom-node-dataset'],
      })
    })

    // oxlint has it under react/, but refuses an option ESLint's version takes.
    it('routes react-hooks/rules-of-hooks to ESLint, though oxlint has it under a name that differs in prefix only', () => {
      const { engine, oxlintName } = routeOf('react-hooks/rules-of-hooks', catalog)
      const oxlintsNames = catalog.oxlintRules.filter(({ id }) => id === 'react-hooks/rules-of-hooks').map((rule) => rule.oxlintName)

      expect({ engine, oxlintName, oxlintsNames }).toStrictEqual({ engine: 'eslint', oxlintName: null, oxlintsNames: ['react/rules-of-hooks'] })
    })

    // Hoisting is the house style: no ruleset turns the rule on, but a consumer can still enable it by ID,
    // and oxlint runs it, as it runs the shipped core rule beside it.
    it('keeps no-use-before-define available to enable in oxlint but unshipped, beside a shipped core rule', () => {
      const routesById = Object.fromEntries(
        ['no-dupe-class-members', 'no-use-before-define'].map((id) => {
          const { engine, shipped } = routeOf(id, catalog)
          return [id, { engine, shipped }]
        }),
      )

      expect(routesById).toStrictEqual({
        'no-dupe-class-members': {
          engine: 'oxlint',
          shipped: { ruleset: 'correctness', options: [], files: null, ignores: null, coveredBy: null, coveredInOxlintBy: null, splitByTypesWith: null, readsRuntimeGlobals: false, allowancesLeftTo: [] },
        },
        'no-use-before-define': { engine: 'oxlint', shipped: null },
      })
    })

    // A house rule exists only while the house plugin has it: the catalog is built from the
    // installed plugins.
    it('makes house/no-classic-loops a RuleId and house/prefer-arrow-callbacks, which the house plugin dropped, none', () => {
      expect(
        ['house/no-classic-loops', 'house/prefer-arrow-callbacks'].filter((id) => catalog.rules.has(id)),
      ).toStrictEqual(['house/no-classic-loops'])
    })

    // No ruleset turns these on, but each engine still has them, so a consumer can enable one by ID.
    it('keeps the dropped rules of installed plugins available to enable but unshipped, beside the rules that replace them', () => {
      const shippedRulesetById = Object.fromEntries(
        [
          'eqeqeq',
          'functional/no-loop-statements',
          'no-eq-null',
          'oxc/approx-constant',
          'perfectionist/sort-union-types',
          'unicorn/prefer-math-constants',
          'unicorn/prefer-type-literal-last',
        ].map((id) => {
          const { shipped } = routeOf(id, catalog)
          return [id, shipped === null ? null : shipped.ruleset]
        }),
      )

      expect(shippedRulesetById).toStrictEqual({
        eqeqeq: 'correctness',
        'functional/no-loop-statements': null,
        'no-eq-null': null,
        'oxc/approx-constant': null,
        'perfectionist/sort-union-types': 'ordering',
        'unicorn/prefer-math-constants': 'correctness',
        'unicorn/prefer-type-literal-last': null,
      })
    })

    // The bans are always on; house's comes from the installed house plugin. oxlint skips ban-ts-comment
    // in a JS file, so ESLint runs it.
    it('routes both suppression bans to ESLint, each with its shipped options', () => {
      const bans = Object.fromEntries(
        ['@typescript-eslint/ban-ts-comment', 'house/no-suppressions'].map((id) => {
          const route = routeOf(id, catalog)
          return [id, { engine: route.engine, oxlintName: route.oxlintName, options: shippedRuleOf(route).options }]
        }),
      )

      expect(bans).toStrictEqual({
        '@typescript-eslint/ban-ts-comment': {
          engine: 'eslint',
          oxlintName: null,
          options: [{ 'ts-expect-error': true, 'ts-ignore': true, 'ts-nocheck': true }],
        },
        'house/no-suppressions': { engine: 'eslint', oxlintName: null, options: [] },
      })
    })

    // Where suppressions are banned, a test and a type test may still assert a type error, with a
    // description; @ts-ignore and @ts-nocheck stay banned there.
    it("gives @typescript-eslint/ban-ts-comment its setting in test and type-test files where suppressions are banned, with those files' globs", () => {
      const shipped = shippedRuleOf(routeOf('@typescript-eslint/ban-ts-comment', catalog))

      expect('whenSuppressions' in shipped ? shipped.whenSuppressions : 'not decided by allowSuppressions').toStrictEqual({
        banned: { options: [{ 'ts-expect-error': true, 'ts-ignore': true, 'ts-nocheck': true }] },
        allowed: { options: [{ 'ts-expect-error': 'allow-with-description', 'ts-ignore': true, 'ts-nocheck': true }] },
        bannedInTestFiles: { files: TEST_FILE_GLOBS, options: [{ 'ts-expect-error': 'allow-with-description', 'ts-ignore': true, 'ts-nocheck': true }] },
      })
    })

    it('gives a test-file setting to no other rule allowSuppressions decides', () => {
      const withATestFileSetting = routes.filter(({ shipped }) => shipped !== null && 'whenSuppressions' in shipped && 'bannedInTestFiles' in shipped.whenSuppressions).map(({ id }) => id)

      expect(withATestFileSetting).toStrictEqual(['@typescript-eslint/ban-ts-comment'])
    })

    it('ships house/require-class-helper in class-names, run by ESLint at its defaults, related to no other rule', () => {
      const { engine, shipped } = routeOf('house/require-class-helper', catalog)

      expect({ engine, shipped }).toStrictEqual({
        engine: 'eslint',
        shipped: { ruleset: 'class-names', options: [], files: null, ignores: null, coveredBy: null, coveredInOxlintBy: null, splitByTypesWith: null, readsRuntimeGlobals: false, allowancesLeftTo: [] },
      })
    })

    // eslint-plugin-n 18.4.1 reads tsconfig.json's aliases for a TS file alone; enhanced-resolve's
    // `tsconfig` option reads them for a JS file too. import-x/no-extraneous-dependencies reports what
    // n/no-extraneous-import did.
    it("ships n/no-unpublished-import with enhanced-resolve's tsconfig option beside its allowModules, and n/no-extraneous-import not at all", () => {
      expect({
        'n/no-unpublished-import': shippedRuleOf(routeOf('n/no-unpublished-import', catalog)).options,
        'n/no-extraneous-import': routeOf('n/no-extraneous-import', catalog).shipped,
      }).toStrictEqual({
        'n/no-unpublished-import': [{ allowModules: expect.any(Array), resolverConfig: { tsconfig: true } }],
        'n/no-extraneous-import': null,
      })
    })

    // Each engine still has a dropped rule, so a team can turn it on by ID.
    it('keeps each round 2 drop a RuleId, shipped in no ruleset', () => {
      const shippedOrUnknown = ROUND_2_DROPS.flatMap(({ dropped }) => dropped).filter((id) => {
        const route = catalog.rules.get(id)
        return route === undefined || route.shipped !== null
      })

      expect(shippedOrUnknown).toStrictEqual([])
    })

    // Each rule a drop leaves reporting that oxlint runs, ESLint takes over without oxlint, or stands in for.
    it('has ESLint take over, or stand in for, each rule a round 2 drop leaves reporting that oxlint runs', () => {
      const lostWithoutOxlint = ROUND_2_DROPS.flatMap(({ stillReporting }) => stillReporting).filter((id) => {
        const route = catalog.rules.get(id)
        if (route === undefined || route.engine === 'eslint') return false
        const takenOver = catalog.ruleIdsWithAnEslintVersion.has(id) && !catalog.eslintFallbackSkips.has(id)
        return !takenOver && !catalog.eslintStandIns.has(id)
      })

      expect(lostWithoutOxlint).toStrictEqual([])
    })

    // The fix of each writes an API Node 22 lacks: shipped off until a category for the newest language
    // features, enabled by Node version, exists.
    it('keeps each modern-js rule whose fix needs a newer Node a RuleId run by ESLint, shipped in no ruleset', () => {
      const routesById = Object.fromEntries(
        RULES_NEEDING_NEWER_NODE.map((id) => {
          const route = catalog.rules.get(id)
          return [id, route === undefined ? 'no RuleId' : { engine: route.engine, shipped: route.shipped }]
        }),
      )

      expect(routesById).toStrictEqual(Object.fromEntries(RULES_NEEDING_NEWER_NODE.map((id) => [id, { engine: 'eslint', shipped: null }])))
    })

    // oxlint has neither, so ESLint runs each: in its ruleset where we ship it, elsewhere where a team turns it on by ID.
    it('makes each rule eslint-plugin-unicorn 78 adds a RuleId run by ESLint, shipped as listed or in no ruleset', () => {
      const routesById = Object.fromEntries(
        Object.keys(RULES_UNICORN_78_ADDS).map((id) => {
          const route = catalog.rules.get(id)
          return [id, route === undefined ? 'no RuleId' : { engine: route.engine, shipped: route.shipped }]
        }),
      )

      expect(routesById).toStrictEqual(Object.fromEntries(Object.entries(RULES_UNICORN_78_ADDS).map(([id, shipped]) => [id, { engine: 'eslint', shipped }])))
    })

    it('gives a rule only ESLint has no oxlint spellings', () => {
      expect(routeOf('sonarjs/cognitive-complexity', catalog).oxlintSpellings).toStrictEqual([])
    })
  })
})

describe('the route lookups', () => {
  const SHIPPED_IN_QUALITY = buildShippedRule('quality')
  const OXLINT_ROUTE = buildOxlintRoute('plugin/oxlint-rule', {
    oxlintName: 'plugin/oxlint-rule',
    oxlintPlugin: 'plugin',
    eslintAliases: [],
    oxlintSpellings: [],
    shipped: SHIPPED_IN_QUALITY,
  })
  const UNSHIPPED_ESLINT_ROUTE = buildEslintRoute('plugin/eslint-rule', { typed: false, oxlintSpellings: [], shipped: null })

  describe('routeOf', () => {
    it("gives a RuleId's route, and throws for an ID the catalog does not hold, naming it", () => {
      const rules = new Map([[OXLINT_ROUTE.id, OXLINT_ROUTE]])

      expect(routeOf('plugin/oxlint-rule', { rules })).toBe(OXLINT_ROUTE)
      expect(() => routeOf('plugin/unknown', { rules })).toThrow('unknown rule ID "plugin/unknown"')
    })
  })

  describe('isOxlintRoute', () => {
    it('holds for a route oxlint runs, and not for one ESLint runs', () => {
      expect([isOxlintRoute(OXLINT_ROUTE), isOxlintRoute(UNSHIPPED_ESLINT_ROUTE)]).toStrictEqual([true, false])
    })

  })

  describe('parseRuleRoute', () => {
    const OXLINT_ROUTING_ENTRY = buildOxlintRoutingEntry('plugin/oxlint-rule', {
      oxlintName: 'plugin/oxlint-rule',
      oxlintPlugin: 'plugin',
      eslintAliases: [],
      oxlintSpellings: [],
      shipped: null,
    })
    const ESLINT_ROUTING_ENTRY = buildEslintRoutingEntry('plugin/eslint-rule', { typed: false, oxlintSpellings: [], shipped: null })

    it('reads a generated route oxlint runs with its oxlint name and plugin, and one ESLint runs with neither', () => {
      expect([parseRuleRoute(OXLINT_ROUTING_ENTRY), parseRuleRoute(ESLINT_ROUTING_ENTRY)]).toStrictEqual([
        { ...OXLINT_ROUTE, shipped: null },
        UNSHIPPED_ESLINT_ROUTE,
      ])
    })

    it('throws for a generated route oxlint runs without an oxlint name, or without an oxlint plugin, naming the rule', () => {
      expect(() => parseRuleRoute({ ...OXLINT_ROUTING_ENTRY, oxlintName: null })).toThrow('plugin/oxlint-rule: routed to oxlint without an oxlint name and plugin')
      expect(() => parseRuleRoute({ ...OXLINT_ROUTING_ENTRY, oxlintPlugin: null })).toThrow('plugin/oxlint-rule: routed to oxlint without an oxlint name and plugin')
    })

    it('throws for a generated route ESLint runs with an oxlint name, or with an oxlint plugin, naming the rule', () => {
      expect(() => parseRuleRoute({ ...ESLINT_ROUTING_ENTRY, oxlintName: 'plugin/eslint-rule' })).toThrow('plugin/eslint-rule: routed to ESLint with an oxlint name or plugin')
      expect(() => parseRuleRoute({ ...ESLINT_ROUTING_ENTRY, oxlintPlugin: 'plugin' })).toThrow('plugin/eslint-rule: routed to ESLint with an oxlint name or plugin')
    })
  })

  describe('shippedRuleOf', () => {
    it('gives what a shipped rule ships with, and throws for a rule we do not ship, naming it', () => {
      expect(shippedRuleOf(OXLINT_ROUTE)).toBe(SHIPPED_IN_QUALITY)
      expect(() => shippedRuleOf(UNSHIPPED_ESLINT_ROUTE)).toThrow('plugin/eslint-rule is not shipped')
    })
  })
})
