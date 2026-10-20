import type { SourcePosition } from './file-overrides-module-factories.ts'

// oxlint.config.mts as a team types it, importing both parts from agents-inc.lint.mts and merging on a line of its own,
// so the place tsc reports an error is known from the text before it.

/** Each part as its TypeScript source. */
export type OxlintConfigModule = {
  /** Lines before the call, such as a const an argument names. */
  readonly declarations: readonly string[]
  /** The merge's arguments, as written between its parentheses. */
  readonly mergeArguments: string
}

const BUILT_PACKAGE = '@agents-inc/lint-rules'
const LINT_RULES_MODULE = './agents-inc.lint.mts'
const MERGE_CALL_START = 'export default mergeOxlintConfig('
const NOT_FOUND = -1
const NEWLINE = '\n'

/** The team's config empty, the oxlint part, and no ESLint config. */
export function buildOxlintConfigModule(fields: Partial<OxlintConfigModule> = {}): OxlintConfigModule {
  return { declarations: [], mergeArguments: '{}, oxlint, { eslintConfig: null }', ...fields }
}

export function oxlintConfigModuleText(module: OxlintConfigModule): string {
  return [...linesBeforeTheCall(module), mergeCallOf(module), ''].join(NEWLINE)
}

/** Where the text found first in the merge call starts. Throws where the call does not hold it. */
export function positionInTheMergeCall(module: OxlintConfigModule, found: string): SourcePosition {
  const call = mergeCallOf(module)
  const offset = call.indexOf(found)
  if (offset === NOT_FOUND) throw new Error(`the merge call does not hold ${found}: ${call}`)
  return { line: linesBeforeTheCall(module).length + 1, column: offset + 1 }
}

function linesBeforeTheCall({ declarations }: OxlintConfigModule): string[] {
  return [`import { mergeOxlintConfig } from '${BUILT_PACKAGE}/oxlint'`, `import { eslint, oxlint } from '${LINT_RULES_MODULE}'`, '', ...declarations]
}

function mergeCallOf({ mergeArguments }: OxlintConfigModule): string {
  return `${MERGE_CALL_START}${mergeArguments})`
}
