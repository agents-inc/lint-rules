import { describe, expect, it } from 'vitest'

import rulesetDefinitions from '../data/ruleset-definitions.json' with { type: 'json' }
import { RULES_UNICORN_78_ADDS } from './__tests__/cases/plugin-upgrades.ts'
import { ROUND_2_DROPS, RULES_NEEDING_NEWER_NODE } from './__tests__/cases/round-2-drops.ts'
import { isSortingRuleset } from './__tests__/cases/sorting-rulesets.ts'
import { buildEslintRoute, buildShippedRule } from './__tests__/factories/inventory-factories.ts'
import { negatedShippedGlobsIn } from './__tests__/negated-globs.ts'
import { ruleNameOf } from './__tests__/rule-name.ts'
import { coreRulesExtendedMoreThanOnce, twinsSharedByShippedRules } from './__tests__/twin-offenders.ts'
import { typescriptEslintExtensions } from './__tests__/typescript-eslint-extensions.ts'
import { type RuleRoute, type ShippedRule, catalog } from './catalog.ts'
import inventory from './generated/inventory.json' with { type: 'json' }

const routes = [...catalog.rules.values()]
const nativeOxlintNameById: ReadonlyMap<string, string> = new Map(
  inventory.rules.flatMap<[string, string]>(({ id, oxlint }) => (oxlint === null ? [] : [[id, oxlint.oxlintName]])),
)

function routeOf(id: string): RuleRoute {
  const route = catalog.rules.get(id)
  if (route === undefined) throw new Error(`${id} is not a RuleId`)
  return route
}

function shippedOptionsOf(route: RuleRoute): readonly unknown[] {
  if (route.shipped === null) throw new Error(`${route.id} is not shipped`)
  return route.shipped.options
}

function oxlintNameOf(route: RuleRoute): string {
  if (route.oxlintName === null) throw new Error(`${route.id} is routed to oxlint without an oxlint name`)
  return route.oxlintName
}

function shippedOf(route: RuleRoute): ShippedRule {
  if (route.shipped === null) throw new Error(`${route.id} is not shipped`)
  return route.shipped
}

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

    // The ESLint merge gives a team its typescript-eslint twin of a rule of ours back where an entry
    // of ours turns our rule off (questions.md #41). It reads one twin each way: a twin another rule
    // of ours shared would come back where that rule still runs, and report each finding twice.
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

  // The merge turns a team's twin of our rule off where ours runs (questions.md #41), reading the
  // twins from coreRuleExtensions; one missed would report each finding twice. The expectation is
  // read from the installed typescript-eslint itself, deprecated extensions included.
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
  // the other rule's ID or null (spec-data.md, 2.5).
  describe("each shipped rule's relations to other shipped rules", () => {
    it("parses each as the other rule's ID where rules.json records one, and as null where it records none", () => {
      const relationsById = Object.fromEntries(
        ['no-return-assign', 'no-throw-literal', 'eqeqeq'].map((id) => {
          const { coveredBy, splitByTypesWith } = shippedOf(routeOf(id))
          return [id, { coveredBy, splitByTypesWith }]
        }),
      )

      expect(relationsById).toStrictEqual({
        'no-return-assign': { coveredBy: 'sonarjs/no-nested-assignment', splitByTypesWith: null },
        'no-throw-literal': { coveredBy: null, splitByTypesWith: '@typescript-eslint/only-throw-error' },
        eqeqeq: { coveredBy: null, splitByTypesWith: null },
      })
    })

    it('gives every shipped rule both, each an ID or null', () => {
      const withoutBoth = routes
        .filter(({ shipped }) => shipped !== null && !(isRelationValue(shipped.coveredBy) && isRelationValue(shipped.splitByTypesWith)))
        .map(({ id }) => id)

      expect(withoutBoth).toStrictEqual([])
    })
  })

  // rules.json marks each rule our runtimes' globals serve; the catalog gives every shipped rule the
  // mark, false where rules.json gives none (spec-core.md, 2.5).
  describe("whether our runtimes' globals serve each shipped rule", () => {
    it('parses it as true where rules.json marks the rule, and as false where it does not', () => {
      const markById = Object.fromEntries(['no-undef', 'eqeqeq'].map((id) => [id, shippedOf(routeOf(id)).readsRuntimeGlobals]))

      expect(markById).toStrictEqual({ 'no-undef': true, eqeqeq: false })
    })

    it('gives every shipped rule a boolean', () => {
      const withoutOne = routes.filter(({ shipped }) => shipped !== null && typeof shipped.readsRuntimeGlobals !== 'boolean').map(({ id }) => id)

      expect(withoutOne).toStrictEqual([])
    })
  })

  describe('the rulesets', () => {
    // Owner, 2026-10-15: the rulesets that sort code are opt-in.
    it("carries each ruleset's optIn and sortsCode, both true on the rulesets that sort code and false on every other", () => {
      expect(catalog.rulesets.map(({ name, optIn, sortsCode }) => [name, optIn, sortsCode])).toStrictEqual(
        rulesetDefinitions.map(({ name }) => [name, isSortingRuleset(name), isSortingRuleset(name)]),
      )
    })
  })

  describe('pinned routes', () => {
    // oxlint matches a suppression comment by the rule name alone, whatever prefix it is written with,
    // so beside oxlint a comment naming the RuleId misses a rule oxlint runs under another rule name.
    // Owner, 2026-10-14: oxlint runs these two all the same; the merge states ESLint stubs for
    // oxlint's names (spec-core.md, C5). A third rename needs those stubs checked for it.
    it('runs exactly the two renamed unicorn rules in oxlint under a rule name of its own', () => {
      const renamedInOxlint = routes
        .filter((route) => route.engine === 'oxlint' && ruleNameOf(route.id) !== ruleNameOf(oxlintNameOf(route)))
        .map((route) => `${route.id} (oxlint: ${oxlintNameOf(route)})`)

      expect(renamedInOxlint).toStrictEqual([
        'unicorn/dom-node-dataset (oxlint: unicorn/prefer-dom-node-dataset)',
        'unicorn/no-for-each (oxlint: unicorn/no-array-for-each)',
      ])
    })

    it('runs unicorn/no-for-each in oxlint under its old name, and keeps the spellings oxlint knows it by', () => {
      const { engine, oxlintName, oxlintPlugin, oxlintSpellings } = routeOf('unicorn/no-for-each')

      expect({ engine, oxlintName, oxlintPlugin, oxlintSpellings }).toStrictEqual({
        engine: 'oxlint',
        oxlintName: 'unicorn/no-array-for-each',
        oxlintPlugin: 'unicorn',
        oxlintSpellings: ['eslint-plugin-unicorn/no-array-for-each', 'unicorn/no-array-for-each'],
      })
    })

    it('runs unicorn/dom-node-dataset in oxlint under its old name, and keeps the spellings oxlint knows it by', () => {
      const { engine, oxlintName, oxlintPlugin, oxlintSpellings } = routeOf('unicorn/dom-node-dataset')

      expect({ engine, oxlintName, oxlintPlugin, oxlintSpellings }).toStrictEqual({
        engine: 'oxlint',
        oxlintName: 'unicorn/prefer-dom-node-dataset',
        oxlintPlugin: 'unicorn',
        oxlintSpellings: ['eslint-plugin-unicorn/prefer-dom-node-dataset', 'unicorn/prefer-dom-node-dataset'],
      })
    })

    // oxlint has it under react/, but refuses an option ESLint's version takes (spec-merge-model.md, 3.2).
    it('routes react-hooks/rules-of-hooks to ESLint, though oxlint has it under a name that differs in prefix only', () => {
      const { engine, oxlintName } = routeOf('react-hooks/rules-of-hooks')
      const oxlintsNames = catalog.oxlintRules.filter(({ id }) => id === 'react-hooks/rules-of-hooks').map((rule) => rule.oxlintName)

      expect({ engine, oxlintName, oxlintsNames }).toStrictEqual({ engine: 'eslint', oxlintName: null, oxlintsNames: ['react/rules-of-hooks'] })
    })

    // Hoisting is the house style (owner, 2026-10-10): no ruleset turns the rule on, but a consumer can
    // still enable it by ID, and oxlint runs it, as it runs the shipped core rule beside it.
    it('keeps no-use-before-define available to enable in oxlint but unshipped, beside a shipped core rule', () => {
      const routesById = Object.fromEntries(
        ['no-dupe-class-members', 'no-use-before-define'].map((id) => {
          const { engine, shipped } = routeOf(id)
          return [id, { engine, shipped }]
        }),
      )

      expect(routesById).toStrictEqual({
        'no-dupe-class-members': {
          engine: 'oxlint',
          shipped: { ruleset: 'correctness', options: [], files: null, ignores: null, coveredBy: null, splitByTypesWith: null, readsRuntimeGlobals: false },
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

    // Owner, 2026-10-10: no ruleset turns these on, but each engine still has them, so a consumer can
    // enable one by ID, as they can the shipped rules beside them.
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
          const { shipped } = routeOf(id)
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

    // The bans are always on; the catalog carries each to the engine that runs it, house's from the
    // installed house plugin. oxlint skips ban-ts-comment in a JS file, so ESLint runs it
    // (spec-merge-model.md, 3.2).
    it('routes both suppression bans to ESLint, each with its shipped options', () => {
      const bans = Object.fromEntries(
        ['@typescript-eslint/ban-ts-comment', 'house/no-suppressions'].map((id) => {
          const route = routeOf(id)
          return [id, { engine: route.engine, oxlintName: route.oxlintName, options: shippedOptionsOf(route) }]
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

    // Owner, 2026-10-14 (q-r2-class-helper-ruleset, lib-structure): a libs ruleset of its own.
    it('ships house/require-class-helper in class-names, run by ESLint at its defaults, related to no other rule', () => {
      const { engine, shipped } = routeOf('house/require-class-helper')

      expect({ engine, shipped }).toStrictEqual({
        engine: 'eslint',
        shipped: { ruleset: 'class-names', options: [], files: null, ignores: null, coveredBy: null, splitByTypesWith: null, readsRuntimeGlobals: false },
      })
    })

    // eslint-plugin-n 18.4.1 reads tsconfig.json's aliases for a TS file alone; enhanced-resolve's own
    // `tsconfig` option, given to our copy of n/no-unpublished-import, reads them for a JS file too
    // (decisions.md, 2026-10-14 "fix round 5 review"). Owner, 2026-10-14 (r2-d59):
    // n/no-extraneous-import no longer ships; import-x/no-extraneous-dependencies reports the same.
    it("ships n/no-unpublished-import with enhanced-resolve's tsconfig option beside its allowModules, and n/no-extraneous-import not at all", () => {
      expect({
        'n/no-unpublished-import': shippedOptionsOf(routeOf('n/no-unpublished-import')),
        'n/no-extraneous-import': routeOf('n/no-extraneous-import').shipped,
      }).toStrictEqual({
        'n/no-unpublished-import': [{ allowModules: expect.any(Array), resolverConfig: { tsconfig: true } }],
        'n/no-extraneous-import': null,
      })
    })

    // Owner, 2026-10-14 (round 2 of the duplicate cards): a dropped rule is in no list, but each engine
    // still has it, so a team can turn it on by ID.
    it('keeps each round 2 drop a RuleId, shipped in no ruleset', () => {
      const shippedOrUnknown = ROUND_2_DROPS.flatMap(({ dropped }) => dropped).filter((id) => {
        const route = catalog.rules.get(id)
        return route === undefined || route.shipped !== null
      })

      expect(shippedOrUnknown).toStrictEqual([])
    })

    // Owner, 2026-10-14 (r2-d7's note): for oxlint use oxlint, for ESLint use ESLint. Each rule a drop
    // leaves reporting that oxlint runs, ESLint takes over without oxlint, or stands in for.
    it('has ESLint take over, or stand in for, each rule a round 2 drop leaves reporting that oxlint runs', () => {
      const lostWithoutOxlint = ROUND_2_DROPS.flatMap(({ stillReporting }) => stillReporting).filter((id) => {
        const route = catalog.rules.get(id)
        if (route === undefined || route.engine === 'eslint') return false
        const takenOver = catalog.ruleIdsWithAnEslintVersion.has(id) && !catalog.eslintFallbackSkips.has(id)
        return !takenOver && !catalog.eslintStandIns.has(id)
      })

      expect(lostWithoutOxlint).toStrictEqual([])
    })

    // The fix of each writes an API Node 22 lacks (questions.md "Parked"): shipped off until a category
    // for the newest language features, enabled by Node version, exists.
    it('keeps each modern-js rule whose fix needs a newer Node a RuleId run by ESLint, shipped in no ruleset', () => {
      const routesById = Object.fromEntries(
        RULES_NEEDING_NEWER_NODE.map((id) => {
          const route = catalog.rules.get(id)
          return [id, route === undefined ? 'no RuleId' : { engine: route.engine, shipped: route.shipped }]
        }),
      )

      expect(routesById).toStrictEqual(Object.fromEntries(RULES_NEEDING_NEWER_NODE.map((id) => [id, { engine: 'eslint', shipped: null }])))
    })

    // oxlint has neither, so ESLint runs each where a team turns it on by ID.
    it('makes each rule eslint-plugin-unicorn 78 adds a RuleId run by ESLint, shipped in no ruleset', () => {
      const routesById = Object.fromEntries(
        RULES_UNICORN_78_ADDS.map((id) => {
          const route = catalog.rules.get(id)
          return [id, route === undefined ? 'no RuleId' : { engine: route.engine, shipped: route.shipped }]
        }),
      )

      expect(routesById).toStrictEqual(Object.fromEntries(RULES_UNICORN_78_ADDS.map((id) => [id, { engine: 'eslint', shipped: null }])))
    })

    it('gives a rule only ESLint has no oxlint spellings', () => {
      expect(routeOf('sonarjs/cognitive-complexity').oxlintSpellings).toStrictEqual([])
    })
  })
})
