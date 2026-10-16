import { ESLint, type Linter } from 'eslint'
import tseslint from 'typescript-eslint'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { consumerConfigSource } from './__tests__/cases/consumer-config-source.ts'
import { setUpTempDir } from './__tests__/temp-dirs.ts'
import { catalog, routeOf, shippedRuleOf } from './catalog.ts'
import { consumerConfigFiles } from './consumer-config-files.ts'
import { eslintPlugins } from './eslint-plugins.ts'
import { pluginPrefixOf } from './rule-id-parts.ts'

// Both report plan.md's three files as written (real run). ESLint runs both.
const SORT_OBJECTS = 'perfectionist/sort-objects'
const NO_TOP_LEVEL_SIDE_EFFECTS = 'unicorn/no-top-level-side-effects'
// Reports each of the three files importing our package in a package npm may publish (measured,
// check right after init).
const NO_UNPUBLISHED_IMPORT = 'n/no-unpublished-import'
const RULES_THE_CONSUMER_FILES_BREAK = [SORT_OBJECTS, NO_TOP_LEVEL_SIDE_EFFECTS]
const CONSUMER_FILES = Object.values(consumerConfigFiles)
// The names the files had before the owner's rename to .mts: now any other file of the consumer's.
// oxlint.config.ts is a tool's config file all the same, which no-top-level-side-effects skips.
const FORMER_CONSUMER_FILES = ['agents-inc.lint.ts', 'oxlint.config.ts']
// Owner, 2026-10-14 (q71): every tool's config file default-exports a call.
const TOOL_CONFIG_FILES = '**/*.config.{js,mjs,cjs,ts,mts,cts}'
const NESTED_PACKAGE = 'apps/web'
const ORDINARY_FILES = ['src/app.ts', 'src/app.mts', 'src/app.mjs']
const LINTED_FILES = '**/*.{ts,mts,mjs}'
const ESLINT_TIMEOUT_MS = 60_000
const CATALOG_MODULE = './catalog.ts'

function sortedShippedIgnoresOf(ruleId: string): readonly string[] {
  const { ignores } = shippedRuleOf(routeOf(ruleId, catalog))
  if (ignores === null) throw new Error(`${ruleId} ships without ignores`)
  return ignores.toSorted()
}

/** The prefix the rule is registered under, with the plugin registered there. */
function pluginEntryOf(ruleId: string): [string, ESLint.Plugin] {
  const prefix = pluginPrefixOf(ruleId)
  const plugin = prefix === null ? undefined : eslintPlugins[prefix]
  if (prefix === null || plugin === undefined) throw new Error(`no registered plugin runs ${ruleId}`)
  return [prefix, plugin]
}

/** The rule's block as it ships: everywhere we lint, minus its own ignores, with its options. */
function shippedBlockOf(ruleId: string): Linter.Config {
  const { files, ignores, options } = shippedRuleOf(routeOf(ruleId, catalog))
  const entry: Linter.RuleEntry = ['error', ...options]
  return {
    files: [...(files ?? [LINTED_FILES])],
    ignores: [...(ignores ?? [])],
    rules: { [ruleId]: entry },
  }
}

describe('consumerConfigFiles, the one source of the names of the files a consumer writes', () => {
  afterEach(() => {
    vi.doUnmock(CATALOG_MODULE)
  })

  it("names the owner's files: the two TypeScript configs as .mts, the ESLint config as .mjs", () => {
    expect(consumerConfigFiles).toStrictEqual({
      lintRules: 'agents-inc.lint.mts',
      oxlintConfig: 'oxlint.config.mts',
      eslintConfig: 'eslint.config.mjs',
    })
  })

  it('loads from its package subpath without loading the catalog, so lint-rules can import the names alone', async () => {
    vi.resetModules()
    vi.doMock(CATALOG_MODULE, () => {
      throw new Error('the catalog was loaded')
    })

    const loaded = await import('@workspace/rule-data/consumer-config-files')

    expect(loaded.consumerConfigFiles).toStrictEqual(consumerConfigFiles)
  })

  it('gives the rules the consumer files break those files, under any directory, as their shipped ignores, and no-top-level-side-effects every tool config file beside them', () => {
    const consumerFilesAnywhere = CONSUMER_FILES.map((file) => `**/${file}`)

    expect(
      Object.fromEntries(RULES_THE_CONSUMER_FILES_BREAK.map((ruleId) => [ruleId, sortedShippedIgnoresOf(ruleId)])),
    ).toStrictEqual({
      [SORT_OBJECTS]: consumerFilesAnywhere.toSorted(),
      [NO_TOP_LEVEL_SIDE_EFFECTS]: [...consumerFilesAnywhere, TOOL_CONFIG_FILES].toSorted(),
    })
  })

  it('gives n/no-unpublished-import those files, under any directory, as its shipped ignores, and no other', () => {
    expect(sortedShippedIgnoresOf(NO_UNPUBLISHED_IMPORT)).toStrictEqual(CONSUMER_FILES.map((file) => `**/${file}`).toSorted())
  })
})

describe('the rules that report the files plan.md has a consumer write', () => {
  const projectDir = setUpTempDir('rule-data-consumer-files-')
  let eslint: ESLint

  beforeAll(() => {
    eslint = new ESLint({
      cwd: projectDir(),
      overrideConfigFile: true,
      overrideConfig: [
        {
          files: [LINTED_FILES],
          languageOptions: { parser: tseslint.parser },
          plugins: Object.fromEntries(RULES_THE_CONSUMER_FILES_BREAK.map(pluginEntryOf)),
        },
        ...RULES_THE_CONSUMER_FILES_BREAK.map(shippedBlockOf),
      ],
    })
  })

  async function ruleIdsReportedOn(filePath: string): Promise<readonly string[]> {
    const [result] = await eslint.lintText(consumerConfigSource, { filePath })
    if (result === undefined) throw new Error(`ESLint returned no result for ${filePath}`)
    return [...new Set(result.messages.map(({ ruleId }) => String(ruleId)))].toSorted()
  }

  async function reportsByFile(filePaths: readonly string[]): Promise<Readonly<Record<string, readonly string[]>>> {
    const reported = await Promise.all(
      filePaths.map(async (filePath): Promise<[string, readonly string[]]> => [filePath, await ruleIdsReportedOn(filePath)]),
    )
    return Object.fromEntries(reported)
  }

  it(
    'stay silent on each of the three files, at the root and in a nested package',
    async () => {
      const consumerFiles = [...CONSUMER_FILES, ...CONSUMER_FILES.map((file) => `${NESTED_PACKAGE}/${file}`)]

      expect(await reportsByFile(consumerFiles)).toStrictEqual(
        Object.fromEntries(consumerFiles.map((file) => [file, []])),
      )
    },
    ESLINT_TIMEOUT_MS,
  )

  it(
    'still report the same code in an ordinary file',
    async () => {
      expect(await reportsByFile(ORDINARY_FILES)).toStrictEqual(
        Object.fromEntries(ORDINARY_FILES.map((file) => [file, RULES_THE_CONSUMER_FILES_BREAK])),
      )
    },
    ESLINT_TIMEOUT_MS,
  )

  it(
    'still report the same code under the names the consumer files had before they became .mts, but for the side effect of oxlint.config.ts, a tool config file',
    async () => {
      expect(await reportsByFile(FORMER_CONSUMER_FILES)).toStrictEqual({
        'agents-inc.lint.ts': RULES_THE_CONSUMER_FILES_BREAK,
        'oxlint.config.ts': [SORT_OBJECTS],
      })
    },
    ESLINT_TIMEOUT_MS,
  )
})
