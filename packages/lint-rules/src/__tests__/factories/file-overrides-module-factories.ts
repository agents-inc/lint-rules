// agents-inc.lint.mts as a team types it in TypeScript, each top-level key and each fileOverrides entry on a line of
// its own, so the place tsc reports an error is known from the key or entry and the text before it.

/** Each part as its TypeScript source. */
export type FileOverridesModule = {
  /** Lines before the call, such as a const an entry names. */
  readonly declarations: readonly string[]
  readonly tsconfigRootDir: string
  readonly agentRulesets: string
  readonly editorRulesets: string
  /** Each written on a line of its own. */
  readonly entries: readonly string[]
  /** Top-level keys after fileOverrides, each on a line of its own. */
  readonly topLevel: readonly string[]
}

/** Where tsc reports an error, both counted from 1. */
export type SourcePosition = { readonly line: number; readonly column: number }

const BUILT_PACKAGE = '@agents-inc/lint-rules'
// Each level of the module text is indented by two spaces more.
const INDENT_WIDTH = 2
const TOP_LEVEL_INDENT = ' '.repeat(INDENT_WIDTH)
const ENTRY_INDENT = ' '.repeat(INDENT_WIDTH * 2)
const NOT_FOUND = -1
const NEWLINE = '\n'

/** As init writes the root, the agent set checking correctness alone; every entry turns no-debugger off in the files it names. */
export function buildFileOverridesModule(fields: Partial<FileOverridesModule> = {}): FileOverridesModule {
  return {
    declarations: [],
    tsconfigRootDir: 'import.meta.dirname',
    agentRulesets: "{ quality: ['correctness'] }",
    editorRulesets: '{}',
    entries: [],
    topLevel: [],
    ...fields,
  }
}

/** An entry whose `files` is the source given, as `['/x.ts']`, turning no-debugger off there. */
export function entryWithFiles(filesSource: string): string {
  return `{ files: ${filesSource}, rules: { 'no-debugger': 'off' } }`
}

export function fileOverridesModuleText(module: FileOverridesModule): string {
  return [
    ...linesBeforeTheEntries(module),
    ...module.entries.map((entry) => `${ENTRY_INDENT}${entry},`),
    `${TOP_LEVEL_INDENT}],`,
    ...module.topLevel.map((key) => `${TOP_LEVEL_INDENT}${key},`),
    '}).editorRulesets',
    '',
  ].join(NEWLINE)
}

/** Where the text found first in the entry starts. Throws where the entry is not there or does not hold it. */
export function positionInEntry(module: FileOverridesModule, entryIndex: number, found: string): SourcePosition {
  const entry = module.entries[entryIndex]
  if (entry === undefined) throw new Error(`the module has no entry ${String(entryIndex)}`)
  const offset = entry.indexOf(found)
  if (offset === NOT_FOUND) throw new Error(`entry ${String(entryIndex)} does not hold ${found}: ${entry}`)
  return { line: linesBeforeTheEntries(module).length + entryIndex + 1, column: ENTRY_INDENT.length + offset + 1 }
}

/** Where the text found first in the line giving the top-level key starts. Throws where no line gives the key, or it does not hold the text. */
export function positionAtTopLevel(module: FileOverridesModule, key: string, found: string): SourcePosition {
  const keyed = fileOverridesModuleText(module)
    .split(NEWLINE)
    .map((text, index) => ({ text, line: index + 1 }))
    .find(({ text }) => text.startsWith(`${TOP_LEVEL_INDENT}${key}: `))
  if (keyed === undefined) throw new Error(`the module gives no top-level ${key}`)
  const offset = keyed.text.indexOf(found)
  if (offset === NOT_FOUND) throw new Error(`the top-level ${key} does not hold ${found}: ${keyed.text.trim()}`)
  return { line: keyed.line, column: offset + 1 }
}

function linesBeforeTheEntries({ declarations, tsconfigRootDir, agentRulesets, editorRulesets }: FileOverridesModule): string[] {
  return [
    `import { defineLintRules } from '${BUILT_PACKAGE}'`,
    '',
    ...declarations,
    'export const { eslint, oxlint } = defineLintRules({',
    `${TOP_LEVEL_INDENT}tsconfigRootDir: ${tsconfigRootDir},`,
    `${TOP_LEVEL_INDENT}agentRulesets: ${agentRulesets},`,
    `${TOP_LEVEL_INDENT}editorRulesets: ${editorRulesets},`,
    `${TOP_LEVEL_INDENT}fileOverrides: [`,
  ]
}
