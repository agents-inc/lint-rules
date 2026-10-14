import { describe, expect, it } from 'vitest'

import canonicalRules from '../data/rules.json' with { type: 'json' }
import rulesetDefinitions from '../data/ruleset-definitions.json' with { type: 'json' }
import { ROUTED_TO_ESLINT_FOR_A_MEASURED_REASON } from './__tests__/cases/routed-to-eslint-for-a-reason.ts'
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
  ui: ['react'],
  testing: ['vitest', 'testing-library', 'storybook'],
  forms: ['react-hook-form'],
  styling: ['css-modules'],
}

const RUNTIME_RULESETS = ['node', 'browser']

const definedRulesetNames = new Set(rulesetDefinitions.map((definition) => definition.name))
const inventoryById = new Map(inventory.rules.map((rule) => [rule.id, rule]))

function canonicalEntryFor(id: string) {
  const entry = canonicalRules.find((rule) => rule.id === id)
  if (entry === undefined) throw new Error(`${id} is not in data/rules.json`)
  return entry
}

/** The reason ESLint runs a rule oxlint has, where rules.json gives one. */
function eslintBecauseOf(rule: (typeof canonicalRules)[number]): unknown {
  return 'eslintBecause' in rule ? rule.eslintBecause : undefined
}

/** The ruleset a rule ships in, or `null` for a rule the canonical list leaves out. */
function shippedRulesetOf(id: string): string | null {
  const entry = canonicalRules.find((rule) => rule.id === id)
  if (entry === undefined) return null
  if (entry.ruleset === undefined) throw new Error(`${id} ships always on, in no ruleset`)
  return entry.ruleset
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
          return rule.engine === 'oxlint' ? installed.oxlint === null : installed.eslint === null
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
          return (
            rule.engine === 'oxlint' &&
            installed !== undefined &&
            installed.oxlint !== null &&
            installed.oxlint.typeAware
          )
        })
        .map((rule) => rule.id)

      expect(typeAwareOxlintRules).toStrictEqual([])
    })

    // Owner, 2026-10-10: a rule is turned on by its ruleset, or always, whatever rulesets are listed.
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
      const unassigned = canonicalRules
        .filter(
          (rule) =>
            rule.assignment === undefined ||
            typeof rule.assignment.by !== 'string' ||
            typeof rule.assignment.confidence !== 'string',
        )
        .map((rule) => rule.id)

      expect(unassigned).toStrictEqual([])
    })
  })

  // Where oxlint's version of a rule is measurably worse than ESLint's, ESLint runs it, with the
  // reason in rules.json (decisions.md, "Owner 2026-10-14"; spec-merge-model.md, 3.3).
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
          return installed === undefined || installed.oxlint === null || installed.oxlint.typeAware
        })
        .map((rule) => rule.id)

      expect(withNoUntypedOxlintVersion).toStrictEqual([])
    })
  })

  describe('pinned entries', () => {
    // oxlint's react plugin runs it under react/, but refuses an option ESLint's version takes, so
    // ESLint runs it (spec-merge-model.md, 3.2).
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

    // oxlint knows both unicorn rules only by their old names, so a suppression comment naming the
    // RuleId would not reach oxlint's report: ESLint runs them.
    it("keys the dataset rule by unicorn's current name and runs it in ESLint, as oxlint has only the old name", () => {
      const { engine, oxlintName, ruleset } = canonicalEntryFor('unicorn/dom-node-dataset')

      expect({ engine, oxlintName, ruleset }).toStrictEqual({
        engine: 'eslint',
        oxlintName: undefined,
        ruleset: 'browser',
      })
    })

    it("keys the for-each rule by unicorn's current name and runs it in ESLint, as oxlint has only no-array-for-each", () => {
      const { engine, oxlintName, ruleset } = canonicalEntryFor('unicorn/no-for-each')

      expect({ engine, oxlintName, ruleset }).toStrictEqual({
        engine: 'eslint',
        oxlintName: undefined,
        ruleset: 'modern-js',
      })
    })

    it("does not key the dataset rule by unicorn's deprecated name", () => {
      expect(canonicalRules.map((rule) => rule.id)).not.toContain('unicorn/prefer-dom-node-dataset')
    })

    // Hoisting is the house style (owner, 2026-10-10), so neither engine's spelling of the rule that
    // forbids it ships, while the core rule beside it in correctness still does.
    it('does not ship no-use-before-define under either spelling, and still ships no-dupe-class-members', () => {
      const shippedIds = new Set(canonicalRules.map((rule) => rule.id))

      expect(
        ['@typescript-eslint/no-use-before-define', 'no-dupe-class-members', 'no-use-before-define'].filter((id) =>
          shippedIds.has(id),
        ),
      ).toStrictEqual(['no-dupe-class-members'])
    })

    it("runs max-lines on JSX files only, skipping hooks, tests and stories, as the gate's ESLint config did", () => {
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
          '**/*.stories.{ts,tsx,js,jsx}',
        ],
      })
    })

    // Folders named in an option are one project's layout: with `scripts/**` listed, every module
    // under a consumer's scripts/ was reported as needing a shebang, and lint:fix added one.
    it('ships n/hashbang naming no executable folders, keeping only ignoreUnpublished, while its sibling keeps its option', () => {
      expect({
        'n/hashbang': canonicalEntryFor('n/hashbang').options,
        'n/prefer-global/process': canonicalEntryFor('n/prefer-global/process').options,
      }).toStrictEqual({
        'n/hashbang': [{ ignoreUnpublished: true }],
        'n/prefer-global/process': ['always'],
      })
    })

    // Owner, 2026-10-10: classic loops are banned and for…of is allowed, which
    // functional/no-loop-statements, banning both, could not say.
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

    // Owner, 2026-10-10: each dropped rule is covered by the shipped rule paired with it here, or
    // conflicted with it (unicorn/prefer-type-literal-last against sort-union-types).
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

    // Object types last, then null and undefined: `{ a: 1 } | null` stays as written. Mapped types
    // match perfectionist's object selector, and void its nullish one, so a custom group keeps each
    // with the other types. lint-rules' sort-union-types.integration.test.ts runs the fix.
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

    // Owner, 2026-10-10: suppression comments are banned, and removing rulesets never removes the
    // bans; a consumer can still turn either off by ID in rules.
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

    // A description no longer buys @ts-expect-error a pass: all three suppress type errors outright.
    // oxlint skips it in a JS file, so ESLint runs it (spec-merge-model.md, 3.2).
    it('ships @typescript-eslint/ban-ts-comment always on, run by ESLint, banning @ts-expect-error, @ts-ignore and @ts-nocheck outright', () => {
      const { engine, oxlintName, ruleset, alwaysOn, options, files, ignores } = canonicalEntryFor(
        '@typescript-eslint/ban-ts-comment',
      )

      expect({ engine, oxlintName, ruleset, alwaysOn, options, files, ignores }).toStrictEqual({
        engine: 'eslint',
        oxlintName: undefined,
        ruleset: undefined,
        alwaysOn: true,
        options: [{ 'ts-expect-error': true, 'ts-ignore': true, 'ts-nocheck': true }],
        files: undefined,
        ignores: undefined,
      })
    })

    // Owner, 2026-10-10: a loop whose body can run only once is a bug, or `const [first] = items` in disguise.
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
  })
})

describe('the ruleset definitions, data/ruleset-definitions.json', () => {
  it("defines the owner's rulesets, in the owner's order, each in its list, domain and env", () => {
    expect(rulesetDefinitions).toStrictEqual([
      ...QUALITY_RULESETS.map((name) => ({ name, list: 'quality', domain: null, env: null })),
      ...Object.entries(LIBS_RULESETS_BY_DOMAIN).flatMap(([domain, names]) =>
        names.map((name) => ({ name, list: 'libs', domain, env: null })),
      ),
      ...RUNTIME_RULESETS.map((name) => ({ name, list: 'runtimes', domain: null, env: name })),
    ])
  })
})
