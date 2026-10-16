import { ESLint, type Linter } from 'eslint'
import { isRecord } from '../../core/is-record.ts'
import { messageOf } from '../caught-errors.ts'
import type { ChangedLines } from './changed-lines.ts'
import { eslintFixFilter } from './eslint-fix-filter.ts'
import { eslintFailed } from './texts.ts'

/** ESLint, through its Node API, with the agent build alone: the project's own ESLint config is never loaded. */
export type EslintEngine = {
  readonly isIgnored: (path: string) => Promise<boolean>
  /** Whether the agent build allows suppression comments in the file: it has ESLint read no inline config where they are banned. */
  readonly allowsSuppressionsIn: (path: string) => Promise<boolean>
  /** Lints the text with the fixes allowed on the changed lines given. Await each call before the next: the lines are the engine's, not the call's. */
  readonly fixed: (path: string, text: string, changed: ChangedLines) => Promise<ESLint.LintResult>
  readonly linted: (path: string, text: string) => Promise<ESLint.LintResult>
}

// Suppression comments that silenced nothing are reported, for check to keep the unused ones (q-c15).
// ESLint reads comments only where suppressions are allowed, so it reports none elsewhere.
const UNUSED_SUPPRESSIONS_REPORTED: Linter.Config = { linterOptions: { reportUnusedDisableDirectives: 'error' } }

export function eslintEngineFor(folder: string, config: readonly Linter.Config[], withheld: ReadonlyMap<string, string>): EslintEngine {
  // ESLint's fix predicate is told the message, never the file, so it reads the lines of the file
  // being linted from here; null while a file is linted with no fix.
  let fixableLines: ChangedLines | null = null
  const eslint = new ESLint({
    cwd: folder,
    overrideConfigFile: true,
    overrideConfig: [...config, UNUSED_SUPPRESSIONS_REPORTED],
    fix: (message) => fixableLines !== null && eslintFixFilter(fixableLines, withheld)(message),
  })
  const lintedWith = async (path: string, text: string, changed: ChangedLines | null): Promise<ESLint.LintResult> => {
    fixableLines = changed
    try {
      return onlyResultOf(await eslintCall(() => eslint.lintText(text, { filePath: path })), path)
    } finally {
      fixableLines = null
    }
  }
  return {
    isIgnored: (path) => eslintCall(() => eslint.isPathIgnored(path)),
    allowsSuppressionsIn: async (path) => readsInlineConfigUnder(await eslintCall(() => eslint.calculateConfigForFile(path)), path),
    fixed: (path, text, changed) => lintedWith(path, text, changed),
    linted: (path, text) => lintedWith(path, text, null),
  }
}

/** Any error ESLint throws, a rule's crash or a config it refuses, stops check: exit 2. */
async function eslintCall<Result>(call: () => Promise<Result>): Promise<Result> {
  try {
    return await call()
  } catch (error) {
    throw new Error(eslintFailed(messageOf(error)), { cause: error })
  }
}

/** Parse boundary: the config ESLint computes for a file it lints, whose `linterOptions` it always fills in. */
export function readsInlineConfigUnder(config: unknown, path: string): boolean {
  const linterOptions = isRecord(config) ? config['linterOptions'] : undefined
  const noInlineConfig = isRecord(linterOptions) ? linterOptions['noInlineConfig'] : undefined
  if (typeof noInlineConfig !== 'boolean') throw new Error(eslintFailed(`its config for ${path} says nothing of inline config`))
  return !noInlineConfig
}

function onlyResultOf(results: readonly ESLint.LintResult[], path: string): ESLint.LintResult {
  const [result, ...rest] = results
  if (result === undefined || rest.length > 0) throw new Error(eslintFailed(`it gave ${String(results.length)} results for ${path}, not one`))
  return result
}
