import { describe, expect, it } from 'vitest'

import { type TypescriptEslintExtension, typescriptEslintExtensions } from './__tests__/typescript-eslint-extensions.ts'
import { type RuleRoute, catalog } from './catalog.ts'
import inventory from './generated/inventory.json' with { type: 'json' }
import { pluginPrefixOf } from './rule-id-parts.ts'

// Without oxlint, the ESLint part takes over each shipped oxlint-run rule ESLint has a version of,
// unless the skip list names it. lint-rules proves the rest fire (eslint-fallback.integration.test.ts).

// A moved core rule a current typescript-eslint rule extends is not skipped: the ESLint part runs the
// extension on TS files and the core rule on JS files.

const idsWithAnEslintVersion: ReadonlySet<string> = new Set(
  inventory.rules.flatMap(({ id, eslint }) => (eslint === null ? [] : [id])),
)

/** A shipped rule oxlint runs that ESLint has a version of: one the ESLint part takes over without oxlint. */
function isMovedRule(route: RuleRoute | undefined): boolean {
  return route !== undefined && route.engine === 'oxlint' && route.shipped !== null && idsWithAnEslintVersion.has(route.id)
}

function movedRuleIds(): string[] {
  return [...catalog.rules.values()].filter(isMovedRule).map(({ id }) => id)
}

/** The typescript-eslint rules that extend a moved core rule, as the installed plugin says. */
function extensionsOfMovedCoreRules(): TypescriptEslintExtension[] {
  const movedCoreRules = new Set(movedRuleIds().filter((id) => pluginPrefixOf(id) === null))
  return typescriptEslintExtensions().filter(({ coreRule }) => movedCoreRules.has(coreRule))
}

describe('the ESLint-fallback skip list, read through the catalog', () => {
  it('names only moved rules: each shipped, run by oxlint, and in ESLint too', () => {
    expect([...catalog.eslintFallbackSkips.keys()].filter((id) => !isMovedRule(catalog.rules.get(id)))).toStrictEqual([])
  })

  it('leaves off it moved rules whose fixture fires in ESLint, for the ESLint part to run', () => {
    const movedRulesThatFire = ['prefer-const', 'no-debugger', 'import-x/first', '@typescript-eslint/no-non-null-assertion']

    expect({
      moved: movedRulesThatFire.filter((id) => isMovedRule(catalog.rules.get(id))),
      skipped: movedRulesThatFire.filter((id) => catalog.eslintFallbackSkips.has(id)),
    }).toStrictEqual({ moved: movedRulesThatFire, skipped: [] })
  })

  it('gives every rule on it a reason', () => {
    expect([...catalog.eslintFallbackSkips].filter(([, reason]) => reason.trim() === '').map(([id]) => id)).toStrictEqual([])
  })

  it('leaves off it each moved core rule a current typescript-eslint rule extends, for the ESLint part to run', () => {
    const extended = extensionsOfMovedCoreRules()
      .filter(({ replacedByCoreRule }) => !replacedByCoreRule)
      .map(({ coreRule }) => coreRule)

    expect({ extended, skipped: extended.filter((id) => catalog.eslintFallbackSkips.has(id)) }).toStrictEqual({
      extended: [
        'max-params',
        'no-dupe-class-members',
        'no-shadow',
        'no-unused-expressions',
        'no-unused-private-class-members',
        'no-unused-vars',
        'no-useless-constructor',
        'prefer-destructuring',
      ],
      skipped: [],
    })
  })

  it('leaves off it a moved core rule whose typescript-eslint extension is deprecated in favour of it, for the ESLint part to run', () => {
    const replaced = extensionsOfMovedCoreRules()
      .filter(({ replacedByCoreRule }) => replacedByCoreRule)
      .map(({ coreRule }) => coreRule)

    expect({ replaced, skipped: replaced.filter((id) => catalog.eslintFallbackSkips.has(id)) }).toStrictEqual({
      replaced: ['no-loop-func', 'no-loss-of-precision'],
      skipped: [],
    })
  })
})
