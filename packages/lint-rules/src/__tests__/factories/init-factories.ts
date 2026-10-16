import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { initConfigText } from '../../cli/init/config-text.ts'
import type { FileWrite } from '../../cli/init/write-all-or-none.ts'
import type { LintRules } from '../../index.ts'
import { entriesUnder } from '../temp-projects.ts'
import { CONFIG_FILE, exportedConstant, moduleText, PACKAGE_JSON_FILE } from './check-factories.ts'
import { EVERY_RULESET } from './lint-rules-factories.ts'
import { buildPackageJson, lintRulesPackageVersion, packageJsonText } from './package-json-factories.ts'

/** A ruleset definition as init reads it: rule-data's, with whether it is opt-in (X1). */
export type InitRulesetDefinition = Parameters<typeof initConfigText>[0][number]

/**
 * One list of rulesets in the text init writes: the rulesets it lists, the opt-in ones its comment
 * names, and those of them that sort code, which the comment's formatter warning names (none unless given).
 */
export type InitList = { readonly listed: readonly string[]; readonly optIn: readonly string[]; readonly sortsCode?: readonly string[] }

/** A libs domain's list, under its domain's key. */
export type InitDomainList = InitList & { readonly domain: string }

/** Every agent list in the text init writes, in the order the file gives them. */
export type InitLists = {
  readonly quality: InitList
  readonly libs: readonly InitDomainList[]
  readonly runtimes: InitList
  readonly languages: InitList
}

/** How a package.json is laid out: what it indents with, its line ends, and whether it ends with one. */
export type JsonLayout = { readonly indent: string; readonly eol: '\n' | '\r\n'; readonly finalNewline: boolean }

/** A value kept as it is written, such as an array on one line, which JSON.stringify would lay out otherwise. */
export type WrittenAsIs = { readonly writtenAsIs: string }

export type PackageJsonValue = string | boolean | WrittenAsIs | PackageJsonObject

/** A package.json's fields, in their order in the file. */
export type PackageJsonObject = { readonly [key: string]: PackageJsonValue }

/** The package init adds, and the range it gives it: a caret on this package's version (q-i4). */
export const OUR_PACKAGE = '@agents-inc/lint-rules'
export const OUR_RANGE = `^${lintRulesPackageVersion()}`

/** package.json before init's edit, and after it. */
export const PACKAGE_JSON_BEFORE_INIT = packageJsonText(buildPackageJson())
export const PACKAGE_JSON_AFTER_INIT = packageJsonText(buildPackageJson({ devDependencies: { [OUR_PACKAGE]: OUR_RANGE } }))
/** A config file as init writes it, for a test of how init writes, not of what. */
export const CONFIG_INIT_WRITES = moduleText(exportedConstant('writtenByInit'))

/** Which of init's two writes comes first. */
export type InitWriteOrder = 'package.json first' | 'config first'

/** What a project holds once init's writes ended: its entries, and package.json's text. */
export type InitFilesState = { readonly entries: readonly string[]; readonly packageJson: string }

/** The `ignores` init writes (q-i7, q77, P6): the gate's list and common generated files, in the `**\/` form. */
export const INIT_IGNORES = [
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

/** The rulesets that sort code (owner, 2026-10-15): opt-in, so init names them in quality's comment, with the formatter warning. */
export const SORTING_RULESETS: readonly string[] = ['import-order', 'ordering']

const NO_OPT_IN: readonly string[] = []
/** What init's comment says after the opt-in rulesets that sort code (owner, 2026-10-15). */
const FORMATTER_WARNING =
  "each sorts code, so it conflicts with a formatter that sorts the same code (Biome, oxfmt's sortImports, a Prettier sort plugin): use one or the other."
const INIT_PROJECT_NAME = 'consumer-project'
const INIT_PROJECT_VERSION = '1.0.0'
const TWO_SPACES = '  '

export function buildRulesetDefinition(fields: Pick<InitRulesetDefinition, 'name' | 'list'> & Partial<InitRulesetDefinition>): InitRulesetDefinition {
  return { domain: null, env: null, optIn: false, sortsCode: false, ...fields }
}

/** The lists for rulesets of the shape a consumer writes, none of them opt-in. */
export function initListsOf(rulesets: LintRules['agentRulesets']): InitLists {
  const { quality = [], libs = {}, runtimes = [], languages = [] } = rulesets
  return {
    quality: { listed: quality, optIn: NO_OPT_IN },
    libs: Object.entries(libs).flatMap(([domain, listed]): InitDomainList[] => (listed === undefined ? [] : [{ domain, listed, optIn: NO_OPT_IN }])),
    runtimes: { listed: runtimes, optIn: NO_OPT_IN },
    languages: { listed: languages, optIn: NO_OPT_IN },
  }
}

/** The lists init writes for the real catalog: every ruleset but the sorting ones, which quality's comment names with the formatter warning. */
export function initListsOfTheCatalog(): InitLists {
  return {
    ...initListsOf(EVERY_RULESET),
    quality: { listed: EVERY_RULESET.quality.filter((name) => !SORTING_RULESETS.includes(name)), optIn: SORTING_RULESETS, sortsCode: SORTING_RULESETS },
  }
}

/**
 * The text init writes for the agent lists given (q-i6, q30a, q-i7, spec-cli.md "The config text"),
 * as the spec lays it out: two-space indent, single quotes, trailing commas, no semicolons.
 */
export function initConfigTextListing({ quality, libs, runtimes, languages }: InitLists): string {
  return moduleText(
    "import { defineLintRules } from '@agents-inc/lint-rules'",
    '',
    'const config = defineLintRules({',
    '  tsconfigRootDir: import.meta.dirname,',
    '',
    '  // What `check` runs on the lines sub-agents change.',
    '  agentRulesets: {',
    ...flatListLines('quality', quality),
    ...libsLines(libs),
    ...flatListLines('runtimes', runtimes),
    ...flatListLines('languages', languages),
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
    ...INIT_IGNORES.map((pattern) => `    ${quoted(pattern)},`),
    '  ],',
    '',
    '  rules: {},',
    '',
    '  fileOverrides: [],',
    '})',
    '',
    'export const { eslint, oxlint } = config.editorRulesets',
  )
}

/** A package.json's text, laid out as given, each value as JSON.stringify writes it but a value written as is. */
export function packageJsonTextIn(fields: PackageJsonObject, layout: JsonLayout): string {
  return `${objectText(fields, 0, layout)}${layout.finalNewline ? layout.eol : ''}`
}

function flatListLines(key: string, { listed, optIn, sortsCode = NO_OPT_IN }: InitList): string[] {
  const comment = optInCommentLines(optIn, sortsCode, 2)
  if (listed.length === 0) return [...comment, `    ${key}: [],`]
  return [...comment, `    ${key}: [`, ...listed.map((name) => `      ${quoted(name)},`), '    ],']
}

function libsLines(libs: readonly InitDomainList[]): string[] {
  if (libs.length === 0) return ['    libs: {},']
  return [
    '    libs: {',
    ...libs.flatMap(({ domain, listed, optIn, sortsCode = NO_OPT_IN }) => [...optInCommentLines(optIn, sortsCode, 3), `      ${domain}: [${listed.map(quoted).join(', ')}],`]),
    '    },',
  ]
}

function optInCommentLines(optIn: readonly string[], sortsCode: readonly string[], depth: number): string[] {
  const indent = TWO_SPACES.repeat(depth)
  const optInLine = optIn.length === 0 ? [] : [`${indent}// Opt-in, so not listed: ${optIn.map(quoted).join(', ')}`]
  const warningLine = sortsCode.length === 0 ? [] : [`${indent}// ${sortsCode.map(quoted).join(', ')}: ${FORMATTER_WARNING}`]
  return [...optInLine, ...warningLine]
}

function quoted(name: string): string {
  return `'${name}'`
}

function objectText(object: PackageJsonObject, depth: number, layout: JsonLayout): string {
  const entries = Object.entries(object)
  if (entries.length === 0) return '{}'
  const { indent, eol } = layout
  const members = entries.map(([key, value]) => `${indent.repeat(depth + 1)}${JSON.stringify(key)}: ${valueText(value, depth + 1, layout)}`)
  return `{${eol}${members.join(`,${eol}`)}${eol}${indent.repeat(depth)}}`
}

function valueText(value: PackageJsonValue, depth: number, layout: JsonLayout): string {
  if (typeof value !== 'object') return JSON.stringify(value)
  if (isWrittenAsIs(value)) return value.writtenAsIs
  return objectText(value, depth, layout)
}

function isWrittenAsIs(value: WrittenAsIs | PackageJsonObject): value is WrittenAsIs {
  return typeof value['writtenAsIs'] === 'string' && Object.keys(value).length === 1
}

/** init's two writes into the project, in the order given: package.json's edit, and the config. */
export function initWritesIn(projectDir: string, order: InitWriteOrder): FileWrite[] {
  const packageJson = { path: join(projectDir, PACKAGE_JSON_FILE), text: PACKAGE_JSON_AFTER_INIT }
  const config = { path: join(projectDir, CONFIG_FILE), text: CONFIG_INIT_WRITES }
  return order === 'package.json first' ? [packageJson, config] : [config, packageJson]
}

export function filesStateOf(projectDir: string): InitFilesState {
  return { entries: entriesUnder(projectDir), packageJson: readFileSync(join(projectDir, PACKAGE_JSON_FILE), 'utf8') }
}

/** Which runner and install command init prints for a package manager (q-i3, q-i5). */
export type PackageManagerLines = { readonly install: string; readonly runner: string }

export const NPM: PackageManagerLines = { install: 'npm install', runner: 'npx' }
export const BUN: PackageManagerLines = { install: 'bun install', runner: 'bunx' }
export const PNPM: PackageManagerLines = { install: 'pnpm install', runner: 'pnpm exec' }
export const YARN: PackageManagerLines = { install: 'yarn install', runner: 'yarn' }

/** What init prints to stdout once it wrote both files, its first line saying whether it added our entry or kept one (q-i3, q-i4, q-i5, P7). */
export function initStdout(entry: 'added' | 'kept', { install, runner }: PackageManagerLines): string {
  const firstLine =
    entry === 'added'
      ? `init: wrote agents-inc.lint.mts and added ${OUR_PACKAGE} ${OUR_RANGE} to devDependencies in package.json.`
      : `init: wrote agents-inc.lint.mts and kept the existing ${OUR_PACKAGE} entry in package.json.`
  return moduleText(
    firstLine,
    `Next: run "${install}".`,
    "Then add these lines to your agents' instructions:",
    '',
    `After changing code, run \`${runner} agents-inc-lint check\` with no arguments. Exit 0: done. Exit 1: fix every finding in code you wrote, then run it again; when only findings in code you did not write remain, you are done. Exit 2: stop and report its output. Never add a suppression comment, and never edit agents-inc.lint.mts.`,
  )
}

/** init's note where the folder is in no git repo (q-i8). */
export function outsideGitNote(folder: string): string {
  return `init: note: ${folder} is not in a git repository, and check needs one.\n`
}

/** init's note where no package.json up to the git top level lists @types/node (q-i9, P7). */
export const TYPES_NODE_NOTE =
  'init: note: agents-inc.lint.mts reads import.meta.dirname, which TypeScript knows only from @types/node. If your tsconfig includes the file, add @types/node to devDependencies.\n'

/** @types/node, as a project lists it. */
export const TYPES_NODE_ENTRY = { '@types/node': '^22.0.0' }

/** The dependency lists a package.json init finds may hold. */
export type InitPackageJsonFields = {
  /** A package npm may publish: no `"private": true`. */
  readonly published?: boolean
  readonly dependencies?: Readonly<Record<string, string>>
  readonly devDependencies?: Readonly<Record<string, string>>
}

/** The fields of a package's package.json, in the order npm writes them: private unless published, listing only the dependencies given. */
export function buildInitPackageJson({ published = false, ...dependencyLists }: InitPackageJsonFields = {}): PackageJsonObject {
  return { name: INIT_PROJECT_NAME, version: INIT_PROJECT_VERSION, ...(published ? {} : { private: true }), type: 'module', ...dependencyLists }
}

/** A package.json a merge left its conflict markers in: not valid JSON. */
export const PACKAGE_JSON_LEFT_MID_MERGE = moduleText('{', '<<<<<<< HEAD', '  "name": "root"', '}')

/** A package.json laid out as npm writes it, two-space indent and a final newline, with the fields given in their order. */
export function npmPackageJsonText(fields: PackageJsonObject): string {
  return packageJsonTextIn(fields, { indent: '  ', eol: '\n', finalNewline: true })
}
