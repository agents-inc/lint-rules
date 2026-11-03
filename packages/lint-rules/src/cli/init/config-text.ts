import { catalog, pluginPrefixOf, type RuleRoute, type RulesetDefinition, type RulesetList } from '@workspace/rule-data'
import { groupBy } from '@workspace/rule-data/collections'
import { consumerConfigFiles } from '@workspace/rule-data/consumer-config-files'
import { THIS_PACKAGE } from '../../core/package-json-files.ts'
import { textOfLines } from '../printed-lines.ts'

type ListedRulesets = { readonly listed: readonly string[]; readonly optIn: readonly string[]; readonly optInSortingCode: readonly string[] }

type FlatList = Exclude<RulesetList, 'libs'>

// The `**/` form matches at any depth in both engines. Each is listed so a team can see and remove it.
const IGNORES: readonly string[] = [
  '**/build/**',
  '**/coverage/**',
  '**/dist/**',
  '**/.next/**',
  '**/.yarn/**',
  '**/generated/**',
  '**/__generated__/**',
  '**/*.d.ts',
  '**/*.gen.*',
  '**/*.min.js',
  '**/mockServiceWorker.js',
]
// TypeScript 6 loads Node's types only where a tsconfig lists them, and the file reads import.meta.dirname.
const NODE_TYPES_REFERENCE = '/// <reference types="node" />'
const FORMATTER_WARNING =
  "each sorts code, so it conflicts with a formatter that sorts the same code (Biome, oxfmt's sortImports, a Prettier sort plugin): use one or the other."
const INDENT = '  '
const LIST_DEPTH = 2
const DOMAIN_DEPTH = 3
const BARE_KEY = /^[A-Za-z_$][\w$]*$/u
const PLAYWRIGHT_PLUGIN = 'playwright'
const PLAYWRIGHT_TESTS_FOLDER = 'e2e/**'
const PLAYWRIGHT_EXAMPLE_COMMENT = 'Opt-in, so off: uncomment to turn these on for your Playwright tests, matched by folder as here or by file name.'

/**
 * Opt-in rulesets are named only in a comment above their list's key, those that sort code again
 * with the formatter warning. The editor set lists none.
 */
export function initConfigText(definitions: readonly RulesetDefinition[]): string {
  return textOfLines([...openingLines(), ...agentRulesetsLines(definitions), '', ...editorRulesetsLines(), '', ...ignoresLines(), '', ...closingLines()])
}

export const INIT_CONFIG_FILE = consumerConfigFiles.lintRules

function openingLines(): string[] {
  return [NODE_TYPES_REFERENCE, `import { defineLintRules } from ${quoted(THIS_PACKAGE)}`, '', 'const config = defineLintRules({', '  tsconfigRootDir: import.meta.dirname,', '']
}

function agentRulesetsLines(definitions: readonly RulesetDefinition[]): string[] {
  return [
    '  // What `check` runs on the lines sub-agents change.',
    '  agentRulesets: {',
    ...flatListLines('quality', definitions),
    ...libsLines(definitions),
    ...flatListLines('runtimes', definitions),
    ...flatListLines('languages', definitions),
    '  },',
  ]
}

function editorRulesetsLines(): string[] {
  return [
    "  // What people's editors show once your team merges it into its own lint configs: add rulesets here.",
    '  editorRulesets: {',
    '    quality: [],',
    '    libs: {},',
    '    runtimes: [],',
    '    languages: [],',
    '  },',
  ]
}

function ignoresLines(): string[] {
  return ['  ignores: [', ...IGNORES.map((pattern) => `    ${quoted(pattern)},`), '  ],']
}

function closingLines(): string[] {
  return ['  rules: {},', '', ...fileOverridesLines(), '})', '', `export const { eslint, oxlint } = config.editorRulesets`]
}

function fileOverridesLines(): string[] {
  return ['  fileOverrides: [', `${indentOf(LIST_DEPTH)}// ${PLAYWRIGHT_EXAMPLE_COMMENT}`, ...commentedOut(playwrightExampleLines(), LIST_DEPTH), '  ],']
}

function playwrightExampleLines(): string[] {
  const ruleLines = playwrightRulesShippedOff().map((id) => `${indentOf(LIST_DEPTH)}${quoted(id)}: 'error',`)
  return ['{', `${INDENT}files: [${quoted(PLAYWRIGHT_TESTS_FOLDER)}],`, `${INDENT}rules: {`, ...ruleLines, `${INDENT}},`, '},']
}

/** In ID order, as the catalog holds them. */
function playwrightRulesShippedOff(): string[] {
  return catalog.rules.values().toArray().filter(isPlaywrightRuleShippedOff).map(({ id }) => id)
}

function isPlaywrightRuleShippedOff({ id, shipped }: Readonly<RuleRoute>): boolean {
  return shipped !== null && 'offByDefault' in shipped && pluginPrefixOf(id) === PLAYWRIGHT_PLUGIN
}

function commentedOut(lines: readonly string[], depth: number): string[] {
  return lines.map((line) => `${indentOf(depth)}// ${line}`)
}

function flatListLines(list: FlatList, definitions: readonly RulesetDefinition[]): string[] {
  const rulesets = listedRulesets(definitions.filter((definition) => definition.list === list))
  const key = `${indentOf(LIST_DEPTH)}${list}:`
  const comment = optInCommentLines(rulesets, LIST_DEPTH)
  if (rulesets.listed.length === 0) return [...comment, `${key} [],`]
  return [...comment, `${key} [`, ...rulesets.listed.map((name) => `${indentOf(LIST_DEPTH + 1)}${quoted(name)},`), `${indentOf(LIST_DEPTH)}],`]
}

/** One line per domain, in the order its first ruleset appears. */
function libsLines(definitions: readonly RulesetDefinition[]): string[] {
  const libs = definitions.filter((definition) => definition.list === 'libs')
  if (libs.length === 0) return [`${indentOf(LIST_DEPTH)}libs: {},`]
  return [`${indentOf(LIST_DEPTH)}libs: {`, ...[...groupBy(libs, domainOf)].flatMap(domainLines), `${indentOf(LIST_DEPTH)}},`]
}

function domainLines([domain, definitions]: readonly [string, readonly RulesetDefinition[]]): string[] {
  const rulesets = listedRulesets(definitions)
  return [...optInCommentLines(rulesets, DOMAIN_DEPTH), `${indentOf(DOMAIN_DEPTH)}${keyOf(domain)}: [${quotedList(rulesets.listed)}],`]
}

function listedRulesets(definitions: readonly RulesetDefinition[]): ListedRulesets {
  const optInDefinitions = definitions.filter(({ optIn }) => optIn)
  return {
    listed: namesOf(definitions.filter(({ optIn }) => !optIn)),
    optIn: namesOf(optInDefinitions),
    optInSortingCode: namesOf(optInDefinitions.filter(({ sortsCode }) => sortsCode)),
  }
}

/** Each left out where it would name none. */
function optInCommentLines({ optIn, optInSortingCode }: ListedRulesets, depth: number): string[] {
  return [
    ...commentLinesNaming(optIn, (names) => `Opt-in, so not listed: ${names}`, depth),
    ...commentLinesNaming(optInSortingCode, (names) => `${names}: ${FORMATTER_WARNING}`, depth),
  ]
}

function commentLinesNaming(rulesets: readonly string[], textNaming: (names: string) => string, depth: number): string[] {
  return rulesets.length === 0 ? [] : [`${indentOf(depth)}// ${textNaming(quotedList(rulesets))}`]
}

function namesOf(definitions: readonly RulesetDefinition[]): string[] {
  return definitions.map(({ name }) => name)
}

function quotedList(names: readonly string[]): string {
  return names.map(quoted).join(', ')
}

function domainOf({ name, domain }: Readonly<RulesetDefinition>): string {
  if (domain === null) throw new Error(`the libs ruleset ${name} has no domain`)
  return domain
}

function keyOf(name: string): string {
  return BARE_KEY.test(name) ? name : quoted(name)
}

function quoted(text: string): string {
  return `'${text}'`
}

function indentOf(depth: number): string {
  return INDENT.repeat(depth)
}
