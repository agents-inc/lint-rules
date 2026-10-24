import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { buildOxlintConfigEnabling } from './__tests__/factories/oxlint-config-factories.ts'
import { type PrintedOxlintConfig, printOxlintConfig } from './__tests__/oxlint-cli.ts'
import { setUpTempDir } from './__tests__/temp-dirs.ts'
import { catalog, routeOf } from './catalog.ts'
import inventory from './generated/inventory.json' with { type: 'json' }

type SpelledRule = { nativeName: string; spellings: readonly string[] }

const OXLINT_TIMEOUT_MS = 60_000

// ESLint spellings of rules oxlint has, each measured refused by oxlint 1.87's config. If an oxlint
// upgrade starts accepting one, it belongs in that rule's spellings.
const SPELLINGS_OXLINT_REFUSES = [
  'n/no-exports-assign',
  'eslint-plugin-n/no-exports-assign',
  '@vitest/no-focused-tests',
  'react-refresh/only-export-components',
  'unicorn/no-for-each',
  'unicorn/dom-node-dataset',
]

const oxlintImplementations = inventory.rules.flatMap(({ id, oxlint }) =>
  oxlint === null ? [] : [{ id, nativeName: oxlint.oxlintName, plugin: oxlint.oxlintPlugin }],
)
const oxlintPlugins = [...new Set(oxlintImplementations.map(({ plugin }) => plugin))]

/** Throws on a rule the catalog does not route, so a test reads it. */
function spelledRulesOfTheCatalog(): readonly SpelledRule[] {
  return oxlintImplementations.map(({ id, nativeName }) => ({
    nativeName,
    spellings: routeOf(id, catalog).oxlintSpellings,
  }))
}

// One config per spelling position: config k holds the k-th spelling of every rule that has one, so
// no two keys of one config name the same rule and each must resolve on its own.
function spellingPositionsOf(spelledRules: readonly SpelledRule[]): number[] {
  const mostSpellingsOfARule = Math.max(0, ...spelledRules.map(({ spellings }) => spellings.length))
  return Array.from({ length: mostSpellingsOfARule }, (_, position) => position)
}

function spellingAt(position: number, { spellings }: SpelledRule): readonly string[] {
  return spellings.slice(position, position + 1)
}

function nativeNamesSpelledAt(position: number): readonly string[] {
  return spelledRulesOfTheCatalog()
    .filter((rule) => spellingAt(position, rule).length > 0)
    .map(({ nativeName }) => nativeName)
    .toSorted()
}

function isRefusedAsUnknown(printed: PrintedOxlintConfig): boolean {
  return printed.status === 'refused' && printed.output.includes('not found')
}

describe("the oxlint spellings of every RuleId oxlint implements, read by the installed oxlint's config", () => {
  const configDir = setUpTempDir('rule-data-oxlint-spellings-')

  async function printConfigEnabling(name: string, ruleKeys: readonly string[]): Promise<PrintedOxlintConfig> {
    const configPath = join(configDir(), `${name}.json`)
    await writeFile(configPath, JSON.stringify(buildOxlintConfigEnabling(ruleKeys, { plugins: oxlintPlugins })))
    return printOxlintConfig(configPath)
  }

  it(
    "resolves each spelling of each rule to that rule's native oxlint name",
    async () => {
      const spelledRules = spelledRulesOfTheCatalog()
      const spellingPositions = spellingPositionsOf(spelledRules)
      const printed = await Promise.all(
        spellingPositions.map((position) =>
          printConfigEnabling(
            `spelling-${String(position)}`,
            spelledRules.flatMap((rule) => spellingAt(position, rule)),
          ),
        ),
      )

      expect(printed).toStrictEqual(
        spellingPositions.map((position) => ({ status: 'loaded', ruleNames: nativeNamesSpelledAt(position) })),
      )
    },
    OXLINT_TIMEOUT_MS,
  )

  describe('an ESLint spelling oxlint refuses', () => {
    it(
      'is refused by oxlint as an unknown plugin or rule',
      async () => {
        const refusals = await Promise.all(
          SPELLINGS_OXLINT_REFUSES.map(async (spelling, index) => ({
            spelling,
            refusedAsUnknown: isRefusedAsUnknown(await printConfigEnabling(`refused-${String(index)}`, [spelling])),
          })),
        )

        expect(refusals).toStrictEqual(SPELLINGS_OXLINT_REFUSES.map((spelling) => ({ spelling, refusedAsUnknown: true })))
      },
      OXLINT_TIMEOUT_MS,
    )

    it("is in no rule's spellings", () => {
      const listedSpellings = new Set(spelledRulesOfTheCatalog().flatMap(({ spellings }) => spellings))

      expect(SPELLINGS_OXLINT_REFUSES.filter((spelling) => listedSpellings.has(spelling))).toStrictEqual([])
    })
  })
})
