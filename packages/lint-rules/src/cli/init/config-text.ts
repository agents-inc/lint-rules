import type { RulesetDefinition, RulesetList } from '@workspace/rule-data'
import { consumerConfigFiles } from '@workspace/rule-data/consumer-config-files'
import { THIS_PACKAGE } from '../../core/package-json-files.ts'
import { textOfLines } from '../printed-lines.ts'

/** One list's rulesets: those it lists, the opt-in ones its comment names, and which of those sort code. */
type ListedRulesets = { readonly listed: readonly string[]; readonly optIn: readonly string[]; readonly optInSortingCode: readonly string[] }

type FlatList = Exclude<RulesetList, 'libs'>

// q-i7, q77, the owner's note on q-i6 (P6): the gate's list and common generated files, in the `**/`
// form, which matches at any depth in both engines. Each is listed so a team can see and remove it.
const IGNORES = [
  '**/build/**',
  '**/coverage/**',
  '**/dist/**',
  '**/.next/**',
  '**/.yarn/**',
  '**/*.d.ts',
  '**/*.gen.*',
  '**/*.min.js',
  '**/mockServiceWorker.js',
]
// Owner, 2026-10-15: a ruleset that sorts code conflicts with a formatter that sorts the same code.
const FORMATTER_WARNING =
  "each sorts code, so it conflicts with a formatter that sorts the same code (Biome, oxfmt's sortImports, a Prettier sort plugin): use one or the other."
const INDENT = '  '
const LIST_DEPTH = 2
const DOMAIN_DEPTH = 3
const BARE_KEY = /^[A-Za-z_$][\w$]*$/u

/**
 * The agents-inc.lint.mts init writes (q-i6, q30a): the agent set lists every ruleset that is not
 * opt-in, in data order, each opt-in one named only in a comment above its list's key, and those
 * that sort code named again with the formatter warning; the editor set lists none, under its comment.
 */
export function initConfigText(definitions: readonly RulesetDefinition[]): string {
  return textOfLines([
    `import { defineLintRules } from ${quoted(THIS_PACKAGE)}`,
    '',
    'const config = defineLintRules({',
    '  tsconfigRootDir: import.meta.dirname,',
    '',
    '  // What `check` runs on the lines sub-agents change.',
    '  agentRulesets: {',
    ...flatListLines('quality', definitions),
    ...libsLines(definitions),
    ...flatListLines('runtimes', definitions),
    ...flatListLines('languages', definitions),
    '  },',
    '',
    "  // What people's editors show once your team merges it into its own lint configs: add rulesets here.",
    '  editorRulesets: {',
    '    quality: [],',
    '    libs: {},',
    '    runtimes: [],',
    '    languages: [],',
    '  },',
    '',
    '  ignores: [',
    ...IGNORES.map((pattern) => `    ${quoted(pattern)},`),
    '  ],',
    '',
    '  rules: {},',
    '',
    '  fileOverrides: [],',
    '})',
    '',
    `export const { eslint, oxlint } = config.editorRulesets`,
  ])
}

/** The file init writes, by its name. */
export const INIT_CONFIG_FILE = consumerConfigFiles.lintRules

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
  const domains = [...new Set(libs.map(domainOf))]
  return [`${indentOf(LIST_DEPTH)}libs: {`, ...domains.flatMap((domain) => domainLines(domain, libs)), `${indentOf(LIST_DEPTH)}},`]
}

/** The domain's rulesets on one line, under a comment naming its opt-in ones. */
function domainLines(domain: string, libs: readonly RulesetDefinition[]): string[] {
  const rulesets = listedRulesets(libs.filter((definition) => domainOf(definition) === domain))
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

/** The opt-in comment, then the formatter warning naming the opt-in rulesets that sort code, each left out where it would name none. */
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

function domainOf({ name, domain }: RulesetDefinition): string {
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
