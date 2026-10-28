import { describe, expect, it } from 'vitest'

import canonicalRules from '../data/rules.json' with { type: 'json' }
import rulesetDefinitions from '../data/ruleset-definitions.json' with { type: 'json' }
import { ROUTED_TO_ESLINT_FOR_A_MEASURED_REASON } from './__tests__/cases/routed-to-eslint-for-a-reason.ts'
import { DROPPED_ON_2026_10_16 } from './__tests__/cases/dropped-rules.ts'
import { ROUND_2_DROPS } from './__tests__/cases/round-2-drops.ts'
import { ALLOWANCES_LEFT_TO, COVERED_BY, COVERED_IN_OXLINT_BY, FILES_LEFT_UNCOVERED_BY_CARD, SPLIT_BY_TYPES_WITH } from './__tests__/cases/rule-relations.ts'
import { isOptInRuleset, isSortingRuleset, RULES_THAT_SORT, SORTING_RULESETS } from './__tests__/cases/sorting-rulesets.ts'
import { NAMES_TEST_FILES, RULES_SKIPPING_TEST_FILES, STORY_FILE_GLOB, TEST_FILE_GLOBS } from './__tests__/cases/test-file-globs.ts'
import { allowancesLeftToOffenders, coveredByOffenders, coveredInOxlintByOffenders, filesLeftUncovered, splitByTypesOffenders } from './__tests__/relation-offenders.ts'
import { catalog } from './catalog.ts'
import { canonicalRules as parsedCanonicalRules } from './generate/canonical-rules.ts'
import inventory from './generated/inventory.json' with { type: 'json' }
import { canonicalIdOf } from './rule-id-parts.ts'

const QUALITY_RULESETS = [
  'correctness',
  'type-safety',
  'security',
  'accessibility',
  'performance',
  'complexity',
  'declarative',
  'immutability',
  'modern-js',
  'redundancy',
  'modules',
  'import-order',
  'naming',
  'comments',
  'ordering',
  'conventions',
  'tests',
]

const LIBS_RULESETS_BY_DOMAIN = {
  ui: ['react', 'nextjs', 'react-ssr'],
  testing: ['vitest', 'testing-library', 'storybook', 'playwright', 'jest-dom'],
  forms: ['react-hook-form'],
  styling: ['css-modules', 'class-names', 'tailwind'],
  data: ['tanstack-query', 'drizzle'],
  routing: ['tanstack-router'],
  validation: ['zod'],
  auth: ['jsonwebtoken'],
  // The owner's answer on card q-lint-effect-ruleset-name: a domain named after the library, listed by init.
  effect: ['effect'],
}

// browser-targets needs a browser target, so it sets no globals: browser does that.
const RUNTIME_RULESETS = [
  { name: 'node', env: 'node' },
  { name: 'browser', env: 'browser' },
  { name: 'browser-targets', env: null },
]

// Created empty, so a team can list each before its first rule arrives.
const LIBRARY_RULESETS_CREATED_EMPTY = new Set(['nextjs', 'react-ssr', 'jest-dom', 'drizzle', 'jsonwebtoken', 'browser-targets'])

const definedRulesetNames = new Set(rulesetDefinitions.map((definition) => definition.name))
const inventoryById = new Map(inventory.rules.map((rule) => [rule.id, rule]))

function canonicalEntryFor(id: string) {
  const entry = canonicalRules.find((rule) => rule.id === id)
  if (entry === undefined) throw new Error(`${id} is not in data/rules.json`)
  return entry
}

/** The reason ESLint runs a rule oxlint has, where rules.json gives one. */
function eslintBecauseOf(rule: Readonly<(typeof canonicalRules)[number]>): unknown {
  return 'eslintBecause' in rule ? rule.eslintBecause : undefined
}

/**
 * Whether the entry records who assigned it and how sure they were. Typed wider than data/rules.json's
 * inferred type, which requires the record of today's entries only: an entry written without one is
 * what this reads.
 */
function hasAnAssignmentRecord({ assignment }: { readonly assignment?: { readonly by?: unknown; readonly confidence?: unknown } }): boolean {
  return assignment !== undefined && typeof assignment.by === 'string' && typeof assignment.confidence === 'string'
}

/** The ruleset a rule ships in, or `null` for a rule the canonical list leaves out. */
function shippedRulesetOf(id: string): string | null {
  const entry = canonicalRules.find((rule) => rule.id === id)
  if (entry === undefined) return null
  if (entry.ruleset === undefined) throw new Error(`${id} ships always on, in no ruleset`)
  return entry.ruleset
}

/** Each rule recording the relation, and the rule it names. */
function namedByRelation(relationOf: (rule: Readonly<(typeof parsedCanonicalRules)[number]>) => { readonly rule: string } | undefined): Readonly<Record<string, string>> {
  return Object.fromEntries(
    parsedCanonicalRules.flatMap((rule) => {
      const relation = relationOf(rule)
      return relation === undefined ? [] : [[rule.id, relation.rule]]
    }),
  )
}

describe('the canonical list, data/rules.json', () => {
  describe('offenders, each list empty', () => {
    it('has no ID out of strictly ascending order, so none is duplicated or unsorted', () => {
      const ids = canonicalRules.map((rule) => rule.id)
      const outOfOrder = ids.flatMap((id, index) => {
        const previous = ids[index - 1]
        return previous !== undefined && previous >= id ? [[previous, id]] : []
      })

      expect(outOfOrder).toStrictEqual([])
    })

    it('has no rule that the inventory lacks on the engine it is routed to', () => {
      const missingOnEngine = canonicalRules
        .filter((rule) => {
          const installed = inventoryById.get(rule.id)
          if (installed === undefined) return true
          const onItsEngine = rule.engine === 'oxlint' ? installed.oxlint : installed.eslint
          return onItsEngine === null
        })
        .map((rule) => `${rule.id} (${rule.engine})`)

      expect(missingOnEngine).toStrictEqual([])
    })

    it('has no oxlint rule whose oxlintName does not map back to its ID, and no ESLint rule with an oxlintName', () => {
      const misnamed = canonicalRules
        .filter((rule) =>
          rule.engine === 'oxlint'
            ? rule.oxlintName === undefined || canonicalIdOf(rule.oxlintName) !== rule.id
            : rule.oxlintName !== undefined,
        )
        .map((rule) => `${rule.id} (${rule.engine}, oxlintName ${String(rule.oxlintName)})`)

      expect(misnamed).toStrictEqual([])
    })

    it('has no rule in a ruleset that ruleset-definitions.json does not define', () => {
      const inUnknownRuleset = canonicalRules
        .filter((rule) => rule.ruleset !== undefined && !definedRulesetNames.has(rule.ruleset))
        .map((rule) => `${rule.id} (${String(rule.ruleset)})`)

      expect(inUnknownRuleset).toStrictEqual([])
    })

    it('has no oxlint rule scoped by files, since the oxlint build refuses to turn a rule on in files of its own', () => {
      const scopedOxlintRules = canonicalRules
        .filter((rule) => rule.engine === 'oxlint' && rule.files !== undefined)
        .map((rule) => rule.id)

      expect(scopedOxlintRules).toStrictEqual([])
    })

    it('has no typed oxlint rule, because oxlint runs without type information', () => {
      const typedOxlintRules = canonicalRules
        .filter((rule) => rule.engine === 'oxlint' && rule.typed)
        .map((rule) => rule.id)

      expect(typedOxlintRules).toStrictEqual([])
    })

    it("has no oxlint rule whose oxlint version needs type information, which oxlint's config never gives it", () => {
      // A rule the inventory lacks is reported by the engine test above, not here.
      const typeAwareOxlintRules = canonicalRules
        .filter((rule) => {
          const installed = inventoryById.get(rule.id)
          return rule.engine === 'oxlint' && installed?.oxlint?.typeAware === true
        })
        .map((rule) => rule.id)

      expect(typeAwareOxlintRules).toStrictEqual([])
    })

    it('has no rule with both or neither of a ruleset and alwaysOn: true, so each is turned on exactly one way', () => {
      const misplaced = canonicalRules
        .filter((rule) => {
          const hasRuleset = typeof rule.ruleset === 'string' && rule.ruleset !== ''
          return hasRuleset === (rule.alwaysOn === true)
        })
        .map((rule) => `${rule.id} (ruleset ${String(rule.ruleset)}, alwaysOn ${String(rule.alwaysOn)})`)

      expect(misplaced).toStrictEqual([])
    })

    it('has no rule without an assignment record', () => {
      const unassigned = canonicalRules.filter((rule) => !hasAnAssignmentRecord(rule)).map((rule) => rule.id)

      expect(unassigned).toStrictEqual([])
    })

    // The narrow rule is left out wherever its cover in another ruleset is on.
    it('has no "covered by" that does not hold: each rule and its cover shipped, in rulesets of their own, the cover left out nowhere', () => {
      expect(coveredByOffenders(parsedCanonicalRules)).toStrictEqual([])
    })

    // The covered rule is left out only where oxlint runs both.
    it('has no "covered in oxlint by" that does not hold: each rule and its cover shipped, run by oxlint and turned on by a ruleset, the cover left out nowhere', () => {
      expect(coveredInOxlintByOffenders(parsedCanonicalRules)).toStrictEqual([])
    })

    // A rule's files or ignores that name test files name every form, Vitest's type tests among them.
    it('has no files or ignores list naming test files without every test-file glob, or with one spelled otherwise', () => {
      const offenders = canonicalRules.flatMap(({ id, files, ignores }) =>
        Object.entries({ files, ignores }).flatMap(([key, globs]) => {
          const testFileGlobs = (globs ?? []).filter((glob) => NAMES_TEST_FILES.test(glob))
          const missing = testFileGlobs.length === 0 ? [] : TEST_FILE_GLOBS.filter((glob) => !testFileGlobs.includes(glob))
          const otherSpellings = testFileGlobs.filter((glob) => !TEST_FILE_GLOBS.includes(glob))
          return [...missing.map((glob) => `${id} ${key}: lacks ${glob}`), ...otherSpellings.map((glob) => `${id} ${key}: names ${glob}`)]
        }),
      )

      expect(offenders).toStrictEqual([])
    })

    // An untyped rule is off where its typed partner runs with type information.
    it('has no "split by types" that does not hold: an untyped and a typed rule, both shipped, run by ESLint on every file, each typed rule named once', () => {
      expect(splitByTypesOffenders(parsedCanonicalRules)).toStrictEqual([])
    })

    // An entry is kept only in the files where the rule its calls are left to runs, so that rule must run wherever types are known when the holder does.
    it('has no options entry left to another rule that does not hold: that rule shipped in a ruleset, covered by none, run by ESLint without oxlint and wherever types are known when the holder needs none, and the entry in the shipped options', () => {
      expect(allowancesLeftToOffenders(parsedCanonicalRules, catalog.eslintFallbackSkips)).toStrictEqual([])
    })
  })

  describe('the relations between shipped rules the owner chose', () => {
    it('records "covered by" on exactly the covered rules the owner\'s cards left out beside their cover, each naming its cover', () => {
      expect(namedByRelation(({ coveredBy }) => coveredBy)).toStrictEqual(COVERED_BY)
    })

    it('records "covered in oxlint by" on exactly the rule the <html lang> card left out where oxlint runs both, naming the rule left reporting', () => {
      expect(namedByRelation(({ coveredInOxlintBy }) => coveredInOxlintBy)).toStrictEqual(COVERED_IN_OXLINT_BY)
    })

    // A covered rule is left out wherever its cover is listed, so where the cover does not run nothing reports.
    it("leaves files uncovered only as an owner's card decides, each set of files named", () => {
      expect(filesLeftUncovered(parsedCanonicalRules).toSorted()).toStrictEqual(Object.values(FILES_LEFT_UNCOVERED_BY_CARD).flat().toSorted())
    })

    it('records "split by types" on exactly the untyped rules of the cards a (T) option was chosen on, each naming its typed partner', () => {
      expect(namedByRelation(({ splitByTypesWith }) => splitByTypesWith)).toStrictEqual(SPLIT_BY_TYPES_WITH)
    })

    it("leaves exactly no-floating-promises' Testing Library and Vitest entries to the rule reporting their calls, each with a reason", () => {
      const leftTo = parsedCanonicalRules.flatMap(({ id, allowancesLeftTo = [] }) =>
        allowancesLeftTo.map(({ option, entry, rule, because }) => ({ allowance: { holder: id, option, entry, leftTo: rule }, hasAReason: because.trim() !== '' })),
      )

      expect(leftTo).toStrictEqual(ALLOWANCES_LEFT_TO.map((allowance) => ({ allowance, hasAReason: true })))
    })

    it('gives each relation a reason', () => {
      const unexplained = parsedCanonicalRules
        .flatMap(({ id, coveredBy, coveredInOxlintBy, splitByTypesWith }) => [
          ...(coveredBy?.because.trim() === '' ? [`${id} covered by ${coveredBy.rule}`] : []),
          ...(coveredInOxlintBy?.because.trim() === '' ? [`${id} covered in oxlint by ${coveredInOxlintBy.rule}`] : []),
          ...(splitByTypesWith?.because.trim() === '' ? [`${id} split by types with ${splitByTypesWith.rule}`] : []),
        ])

      expect(unexplained).toStrictEqual([])
    })
  })

  // The editor merges give our runtimes' globals only where a rule of ours that reads them runs.
  describe("the rules our runtimes' globals serve", () => {
    it('are marked on no-undef alone', () => {
      const marked = Object.fromEntries(
        parsedCanonicalRules.flatMap(({ id, readsRuntimeGlobals }) => (readsRuntimeGlobals === undefined ? [] : [[id, readsRuntimeGlobals]])),
      )

      expect(marked).toStrictEqual({ 'no-undef': true })
    })
  })

  // Where oxlint's version is measurably worse, ESLint runs the rule, with the reason in rules.json.
  describe('the rules routed to ESLint for a measured reason', () => {
    it("are exactly those oxlint's version is measurably worse at, each giving its reason", () => {
      const withAReason = canonicalRules.filter((rule) => typeof eslintBecauseOf(rule) === 'string' && eslintBecauseOf(rule) !== '').map((rule) => rule.id)

      expect(withAReason).toStrictEqual(ROUTED_TO_ESLINT_FOR_A_MEASURED_REASON)
    })

    it('are each routed to ESLint, with no oxlintName', () => {
      const misrouted = canonicalRules
        .filter((rule) => eslintBecauseOf(rule) !== undefined && (rule.engine !== 'eslint' || rule.oxlintName !== undefined))
        .map((rule) => `${rule.id} (${rule.engine}, oxlintName ${String(rule.oxlintName)})`)

      expect(misrouted).toStrictEqual([])
    })

    // A reason only means something where oxlint could run the rule: an untyped version of it.
    it('each have a version oxlint runs without type information', () => {
      const withNoUntypedOxlintVersion = canonicalRules
        .filter((rule) => {
          if (eslintBecauseOf(rule) === undefined) return false
          const installed = inventoryById.get(rule.id)
          return !installed?.oxlint || installed.oxlint.typeAware
        })
        .map((rule) => rule.id)

      expect(withNoUntypedOxlintVersion).toStrictEqual([])
    })
  })

  describe('pinned entries', () => {
    // oxlint runs it under react/, but refuses an option ESLint's version takes.
    it('keys the hooks rule by its ESLint ID, ESLint running it', () => {
      const { engine, oxlintName, ruleset } = canonicalEntryFor('react-hooks/rules-of-hooks')

      expect({ engine, oxlintName, ruleset }).toStrictEqual({
        engine: 'eslint',
        oxlintName: undefined,
        ruleset: 'react',
      })
    })

    it('does not key the hooks rule by its oxlint spelling', () => {
      expect(canonicalRules.map((rule) => rule.id)).not.toContain('react/rules-of-hooks')
    })

    // oxlint knows both unicorn rules only by their old names; beside oxlint a suppression comment names
    // oxlint's spelling.
    it("keys the dataset rule by unicorn's current name and runs it in oxlint, under the old name oxlint has", () => {
      const { engine, oxlintName, ruleset } = canonicalEntryFor('unicorn/dom-node-dataset')

      expect({ engine, oxlintName, ruleset }).toStrictEqual({
        engine: 'oxlint',
        oxlintName: 'unicorn/prefer-dom-node-dataset',
        ruleset: 'browser',
      })
    })

    it("keys the for-each rule by unicorn's current name and runs it in oxlint, under no-array-for-each, the name oxlint has", () => {
      const { engine, oxlintName, ruleset } = canonicalEntryFor('unicorn/no-for-each')

      expect({ engine, oxlintName, ruleset }).toStrictEqual({
        engine: 'oxlint',
        oxlintName: 'unicorn/no-array-for-each',
        ruleset: 'modern-js',
      })
    })

    it("does not key the dataset rule by unicorn's deprecated name", () => {
      expect(canonicalRules.map((rule) => rule.id)).not.toContain('unicorn/prefer-dom-node-dataset')
    })

    // Hoisting is the house style, so neither spelling of the rule forbidding it ships.
    it('does not ship no-use-before-define under either spelling, and still ships no-dupe-class-members', () => {
      const shippedIds = new Set(canonicalRules.map((rule) => rule.id))

      expect(
        ['@typescript-eslint/no-use-before-define', 'no-dupe-class-members', 'no-use-before-define'].filter((id) =>
          shippedIds.has(id),
        ),
      ).toStrictEqual(['no-dupe-class-members'])
    })

    it("runs max-lines on JSX files only, skipping hooks, tests, type tests and stories, as the gate's ESLint config did", () => {
      const { engine, options, files, ignores } = canonicalEntryFor('max-lines')

      expect({ engine, options, files, ignores }).toStrictEqual({
        engine: 'eslint',
        options: [{ max: 200 }],
        files: ['**/*.{tsx,jsx}'],
        ignores: [
          '**/use[A-Z]*.{tsx,jsx}',
          '**/use-*.{tsx,jsx}',
          '**/*.{test,spec}.{ts,tsx,js,jsx}',
          '**/__tests__/**',
          '**/*.{test,spec}-d.{ts,tsx,js,jsx}',
          '**/*.stories.{ts,tsx,js,jsx}',
        ],
      })
    })

    // Folders named in an option are one project's layout: `scripts/**` made lint:fix add a shebang to
    // every module under a consumer's scripts/.
    it('ships n/hashbang naming no executable folders, keeping only ignoreUnpublished, while its sibling keeps its option', () => {
      expect({
        'n/hashbang': canonicalEntryFor('n/hashbang').options,
        'n/prefer-global/process': canonicalEntryFor('n/prefer-global/process').options,
      }).toStrictEqual({
        'n/hashbang': [{ ignoreUnpublished: true }],
        'n/prefer-global/process': ['always'],
      })
    })

    // Classic loops are banned and for…of is allowed, which functional/no-loop-statements could not say.
    it('ships house/no-classic-loops in declarative, run by ESLint on every file with no options', () => {
      const { engine, oxlintName, ruleset, options, typed, files, ignores } = canonicalEntryFor('house/no-classic-loops')

      expect({ engine, oxlintName, ruleset, options, typed, files, ignores }).toStrictEqual({
        engine: 'eslint',
        oxlintName: undefined,
        ruleset: 'declarative',
        options: [],
        typed: false,
        files: undefined,
        ignores: undefined,
      })
    })

    // Each dropped rule is covered by the shipped rule paired with it here, or conflicted with it.
    it('ships none of the dropped rules, and ships each rule that replaces one', () => {
      expect(
        Object.fromEntries(
          [
            ['functional/no-loop-statements', 'house/no-classic-loops'],
            ['house/prefer-arrow-callbacks', 'prefer-arrow-callback'],
            ['no-eq-null', 'eqeqeq'],
            ['oxc/approx-constant', 'unicorn/prefer-math-constants'],
            ['unicorn/prefer-type-literal-last', 'perfectionist/sort-union-types'],
          ].flatMap((ids) => ids.map((id) => [id, shippedRulesetOf(id)])),
        ),
      ).toStrictEqual({
        'functional/no-loop-statements': null,
        'house/no-classic-loops': 'declarative',
        'house/prefer-arrow-callbacks': null,
        'prefer-arrow-callback': 'modern-js',
        'no-eq-null': null,
        eqeqeq: 'correctness',
        'oxc/approx-constant': null,
        'unicorn/prefer-math-constants': 'correctness',
        'unicorn/prefer-type-literal-last': null,
        'perfectionist/sort-union-types': 'ordering',
      })
    })

    it('ships none of the round 2 drops, and ships each rule a drop leaves reporting', () => {
      const shippedIds = new Set(canonicalRules.map(({ id }) => id))

      expect({
        stillShipped: ROUND_2_DROPS.flatMap(({ dropped }) => dropped).filter((id) => shippedIds.has(id)),
        reportingButUnshipped: ROUND_2_DROPS.flatMap(({ stillReporting }) => stillReporting).filter((id) => !shippedIds.has(id)),
      }).toStrictEqual({ stillShipped: [], reportingButUnshipped: [] })
    })

    // Mapped types match perfectionist's object selector and void its nullish one, so a custom group keeps
    // them with the other types. lint-rules' sort-union-types.integration.test.ts runs the fix.
    it('ships perfectionist/sort-union-types sorting object types last and null and undefined after them', () => {
      expect(canonicalEntryFor('perfectionist/sort-union-types').options).toStrictEqual([
        {
          partitionByComment: true,
          partitionByNewLine: true,
          customGroups: [
            {
              groupName: 'mapped-type',
              selector: 'object',
              elementNamePattern: String.raw`^\{\s*(?:[+-]?readonly\s+)?\[\s*[\w$]+\s+in\s`,
            },
            { groupName: 'void-type', selector: 'nullish', elementNamePattern: '^void$' },
          ],
          groups: [
            [
              'conditional',
              'function',
              'import',
              'intersection',
              'keyword',
              'literal',
              'named',
              'operator',
              'tuple',
              'union',
              'mapped-type',
              'void-type',
            ],
            'object',
            'nullish',
          ],
        },
      ])
    })

    // Removing rulesets never removes the bans; a consumer can still turn either off by ID in rules.
    it('ships exactly the two suppression bans always on, in no ruleset', () => {
      expect(canonicalRules.filter((rule) => rule.alwaysOn === true).map((rule) => rule.id)).toStrictEqual([
        '@typescript-eslint/ban-ts-comment',
        'house/no-suppressions',
      ])
    })

    it('ships house/no-suppressions always on, run by ESLint on every file with no options', () => {
      const { engine, oxlintName, ruleset, alwaysOn, options, typed, files, ignores } =
        canonicalEntryFor('house/no-suppressions')

      expect({ engine, oxlintName, ruleset, alwaysOn, options, typed, files, ignores }).toStrictEqual({
        engine: 'eslint',
        oxlintName: undefined,
        ruleset: undefined,
        alwaysOn: true,
        options: [],
        typed: false,
        files: undefined,
        ignores: undefined,
      })
    })

    // oxlint skips it in a JS file, so ESLint runs it. A type test asserts a type error with a
    // description-bearing @ts-expect-error, which TypeScript fails where it suppresses nothing.
    it('ships @typescript-eslint/ban-ts-comment always on, run by ESLint, banning @ts-expect-error, @ts-ignore and @ts-nocheck outright, but for @ts-expect-error with a description in test and type-test files', () => {
      const { engine, oxlintName, ruleset, alwaysOn, options, files, ignores, whenSuppressions } = canonicalEntryFor(
        '@typescript-eslint/ban-ts-comment',
      )

      expect({ engine, oxlintName, ruleset, alwaysOn, options, files, ignores, whenSuppressions }).toStrictEqual({
        engine: 'eslint',
        oxlintName: undefined,
        ruleset: undefined,
        alwaysOn: true,
        options: [{ 'ts-expect-error': true, 'ts-ignore': true, 'ts-nocheck': true }],
        files: undefined,
        ignores: undefined,
        whenSuppressions: {
          banned: 'on',
          allowed: { options: [{ 'ts-expect-error': 'allow-with-description', 'ts-ignore': true, 'ts-nocheck': true }] },
          bannedInTestFiles: { options: [{ 'ts-expect-error': 'allow-with-description', 'ts-ignore': true, 'ts-nocheck': true }] },
        },
      })
    })

    // generate/render-generated.ts renders exactly these as SuppressionRuleId.
    it('has allowSuppressions decide exactly the two bans, the blanket-suppression rule and the hooks rule that reports suppressions', () => {
      expect(canonicalRules.filter((rule) => rule.whenSuppressions !== undefined).map((rule) => rule.id)).toStrictEqual([
        '@typescript-eslint/ban-ts-comment',
        'house/no-suppressions',
        'react-hooks/rule-suppression',
        'unicorn/no-abusive-eslint-disable',
      ])
    })

    // oxlint reports a blanket comment of either engine's (measured, oxlint 1.87); where suppressions are
    // banned, house/no-suppressions reports every comment.
    it("runs unicorn/no-abusive-eslint-disable in oxlint under its own name, only where suppressions are allowed", () => {
      const { engine, oxlintName, ruleset, whenSuppressions } = canonicalEntryFor('unicorn/no-abusive-eslint-disable')

      expect({ engine, oxlintName, ruleset, whenSuppressions }).toStrictEqual({
        engine: 'oxlint',
        oxlintName: 'unicorn/no-abusive-eslint-disable',
        ruleset: 'comments',
        whenSuppressions: { banned: 'off', allowed: 'on' },
      })
    })

    // Where suppressions are banned, house/no-suppressions reports the comment already.
    it('runs react-hooks/rule-suppression in oxlint only where suppressions are allowed', () => {
      const { engine, oxlintName, ruleset, whenSuppressions } = canonicalEntryFor('react-hooks/rule-suppression')

      expect({ engine, oxlintName, ruleset, whenSuppressions }).toStrictEqual({
        engine: 'oxlint',
        oxlintName: 'react/rule-suppression',
        ruleset: 'react',
        whenSuppressions: { banned: 'off', allowed: 'on' },
      })
    })

    // A loop whose body can run only once is a bug, or `const [first] = items` in disguise.
    it('ships no-unreachable-loop in correctness, run by oxlint at its defaults on every file', () => {
      const { engine, oxlintName, ruleset, options, typed, files, ignores } = canonicalEntryFor('no-unreachable-loop')

      expect({ engine, oxlintName, ruleset, options, typed, files, ignores }).toStrictEqual({
        engine: 'oxlint',
        oxlintName: 'no-unreachable-loop',
        ruleset: 'correctness',
        options: [],
        typed: false,
        files: undefined,
        ignores: undefined,
      })
    })

    it('runs storybook/default-exports on story files only, with nothing skipped', () => {
      const { engine, files, ignores } = canonicalEntryFor('storybook/default-exports')

      expect({ engine, files, ignores }).toStrictEqual({
        engine: 'eslint',
        files: ['**/*.stories.{ts,tsx,js,jsx,mjs}', '**/.storybook/**'],
        ignores: undefined,
      })
    })

    it('ships house/require-class-helper in class-names, run by ESLint untyped on every file at its defaults', () => {
      const { engine, oxlintName, ruleset, options, typed, files, ignores } = canonicalEntryFor('house/require-class-helper')

      expect({ engine, oxlintName, ruleset, options, typed, files, ignores }).toStrictEqual({
        engine: 'eslint',
        oxlintName: undefined,
        ruleset: 'class-names',
        options: [],
        typed: false,
        files: undefined,
        ignores: undefined,
      })
    })

    // It sorts nothing, but the owner keeps it with the import rules: a team that does not opt in to
    // import-order goes without it.
    it('ships import-x/first in import-order, run by oxlint as import/first at its defaults', () => {
      const { engine, oxlintName, ruleset, options, typed } = canonicalEntryFor('import-x/first')

      expect({ engine, oxlintName, ruleset, options, typed }).toStrictEqual({
        engine: 'oxlint',
        oxlintName: 'import/first',
        ruleset: 'import-order',
        options: [],
        typed: false,
      })
    })

    // Back for every team where the opt-in ordering ruleset is not listed; with it, sort-switch-case
    // reports the same switch too.
    it('ships default-case-last in conventions, run by oxlint at its defaults', () => {
      const { engine, oxlintName, ruleset, options, typed, files, ignores } = canonicalEntryFor('default-case-last')

      expect({ engine, oxlintName, ruleset, options, typed, files, ignores }).toStrictEqual({
        engine: 'oxlint',
        oxlintName: 'default-case-last',
        ruleset: 'conventions',
        options: [],
        typed: false,
        files: undefined,
        ignores: undefined,
      })
    })

    // Each reported only code written so on purpose, or wrote code another rule reports; a team can
    // still turn one on by ID.
    it('ships none of the rules turned off for every team on 2026-10-16, each still a RuleId', () => {
      expect(DROPPED_ON_2026_10_16.map((id) => [id, { shipped: shippedRulesetOf(id), isRuleId: catalog.rules.has(id) }])).toStrictEqual(
        DROPPED_ON_2026_10_16.map((id) => [id, { shipped: null, isRuleId: true }]),
      )
    })

    // A test is made of statements, and fixture code held in strings: these judge it by source-code standards.
    it('skips test and type-test files in exactly the rules that judge code by standards a test cannot meet', () => {
      const skipping = canonicalRules.filter(({ ignores }) => TEST_FILE_GLOBS.every((glob) => (ignores ?? []).includes(glob))).map(({ id }) => id)

      expect(skipping.toSorted()).toStrictEqual(RULES_SKIPPING_TEST_FILES.toSorted())
    })

    // The plugin takes any function named render… for Testing Library's.
    it('runs every testing-library rule in test, type-test and story files only', () => {
      const testingLibraryRules = canonicalRules.filter(({ id }) => id.startsWith('testing-library/'))

      expect(Object.fromEntries(testingLibraryRules.map(({ id, files }) => [id, files]))).toStrictEqual(
        Object.fromEntries(testingLibraryRules.map(({ id }) => [id, [...TEST_FILE_GLOBS, STORY_FILE_GLOB]])),
      )
    })

    // The core versions reach JS files and TS files outside every tsconfig, where the typed ones cannot run.
    it('ships consistent-return in correctness and no-implied-eval in security, each run by ESLint untyped at its defaults', () => {
      const entries = Object.fromEntries(
        ['consistent-return', 'no-implied-eval'].map((id) => {
          const { engine, oxlintName, ruleset, options, typed } = canonicalEntryFor(id)
          return [id, { engine, oxlintName, ruleset, options, typed }]
        }),
      )

      expect(entries).toStrictEqual({
        'consistent-return': { engine: 'eslint', oxlintName: undefined, ruleset: 'correctness', options: [], typed: false },
        'no-implied-eval': { engine: 'eslint', oxlintName: undefined, ruleset: 'security', options: [], typed: false },
      })
    })
  })
})

describe('the ruleset definitions, data/ruleset-definitions.json', () => {
  // `init` reads `optIn`, and names each ruleset whose `sortsCode` is true in its formatter warning.
  it("defines the owner's rulesets, in the owner's order, each in its list, domain and env, opt-in where it sorts code and on tailwind, browser-targets, jest-dom and react-ssr, sorting code exactly where it sorts code", () => {
    expect(rulesetDefinitions).toStrictEqual([
      ...QUALITY_RULESETS.map((name) => ({ name, list: 'quality', domain: null, env: null, optIn: isOptInRuleset(name), sortsCode: isSortingRuleset(name) })),
      ...Object.entries(LIBS_RULESETS_BY_DOMAIN).flatMap(([domain, names]) =>
        names.map((name) => ({ name, list: 'libs', domain, env: null, optIn: isOptInRuleset(name), sortsCode: isSortingRuleset(name) })),
      ),
      ...RUNTIME_RULESETS.map(({ name, env }) => ({ name, list: 'runtimes', domain: null, env, optIn: isOptInRuleset(name), sortsCode: isSortingRuleset(name) })),
    ])
  })

  it('holds no rule yet in the library rulesets created empty', () => {
    expect(canonicalRules.filter(({ ruleset }) => ruleset !== undefined && LIBRARY_RULESETS_CREATED_EMPTY.has(ruleset)).map(({ id }) => id)).toStrictEqual([])
  })

  // A rule that sorts nothing would leave the opt-in, and so every new repo, without it: import-x/first
  // alone is there by the owner's choice.
  it('puts in the rulesets that sort code exactly the rules that reorder code, and import-x/first', () => {
    const rulesByRuleset = Object.fromEntries(
      SORTING_RULESETS.map((ruleset) => [ruleset, canonicalRules.filter((rule) => rule.ruleset === ruleset).map(({ id }) => id)]),
    )

    expect(rulesByRuleset).toStrictEqual(RULES_THAT_SORT)
  })
})
