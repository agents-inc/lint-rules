import type { OxlintRuleFileTypes } from '../oxlint-file-types.ts'
import { DECLARATION_FILE_TYPES, type FileType, LINTED_EXTENSIONS, type RuleTrigger, type ScriptBlock } from './cases/oxlint-rule-triggers.ts'
import { type OxlintJsonReport, oxlintJsonRun } from './oxlint-cli.ts'

/** What oxlint made of a file holding a rule's trigger: the rule's finding, a parse error, or nothing. */
export type TriggerOutcome = 'reports' | 'cannot parse' | 'silent'

/** Every file type written: each extension oxlint lints by default, then each kind of declaration file. */
export const FILE_TYPES: readonly FileType[] = [...LINTED_EXTENSIONS, ...declarationFileTypes()]

/** The text of a file of the type holding the trigger: a .vue or .svelte file in a script block, an .astro file in its frontmatter. */
export function fileTextHolding(type: FileType, { code, script }: RuleTrigger): string {
  if (type === 'vue' || type === 'svelte') return `${scriptBlockOpening(type, script)}\n${code}</script>\n`
  if (type === 'astro') return `---\n${code}---\n`
  return code
}

/** The file types written that oxlint runs a rule of the file types given in: a declaration file by the extension oxlint reads it by. */
export function fileTypesWrittenTheRuleRunsIn({ extensions, skipsDeclarationFiles }: OxlintRuleFileTypes): FileType[] {
  return FILE_TYPES.filter((type) =>
    isDeclarationFileType(type) ? !skipsDeclarationFiles && extensions.includes(DECLARATION_FILE_TYPES[type]) : extensions.includes(type),
  )
}

/** What oxlint made of each file given, from its report over them: a file with any diagnostic that links nowhere could not be parsed. */
export function outcomesOf(report: OxlintJsonReport, files: readonly string[]): ReadonlyMap<string, TriggerOutcome> {
  const reported = new Set(report.diagnostics.map(({ filename }) => filename))
  const unparsed = new Set(report.diagnostics.filter(({ url }) => url === undefined).map(({ filename }) => filename))
  const strays = [...reported].filter((filename) => !files.includes(filename))
  if (strays.length > 0) throw new Error(`oxlint reported in files it was not given: ${strays.join(', ')}`)
  return new Map(files.map((file) => [file, unparsed.has(file) ? 'cannot parse' : reported.has(file) ? 'reports' : 'silent']))
}

/** The installed oxlint over the paths given, from the project's folder, with the config file given: its JSON report. */
export function runOxlintJson(projectDir: string, configFile: string, paths: readonly string[]): OxlintJsonReport {
  const run = oxlintJsonRun(projectDir, configFile, paths)
  if (run.outcome === 'refused') throw new Error(`oxlint could not lint with ${configFile}: ${run.output}`)
  return run.report
}

/** A script block's opening tag: TypeScript, or TSX where the trigger asks for it; a .vue file's `setup` where it asks for that. */
function scriptBlockOpening(type: 'vue' | 'svelte', script: ScriptBlock | undefined): string {
  const lang = script === 'tsx' ? 'tsx' : 'ts'
  const setup = type === 'vue' && script === 'setup' ? ' setup' : ''
  return `<script${setup} lang="${lang}">`
}

function isDeclarationFileType(type: string): type is keyof typeof DECLARATION_FILE_TYPES {
  return Object.hasOwn(DECLARATION_FILE_TYPES, type)
}

function declarationFileTypes(): FileType[] {
  return Object.keys(DECLARATION_FILE_TYPES).filter(isDeclarationFileType)
}
