import { relative } from 'node:path'
import { ESLint, type Linter } from 'eslint'
import { isRecord } from '../../core/is-record.ts'
import { liesOutside } from '../../core/lies-outside.ts'
import { readOnce } from '../../core/read-once.ts'
import { messageOf } from '../caught-errors.ts'
import type { ChangedLines } from './changed-lines.ts'
import { eslintFixFilter } from './eslint-fix-filter.ts'
import { eslintFailed } from './texts.ts'

/** The project's own ESLint config is never loaded. */
export type EslintEngine = {
  readonly isIgnored: (path: string) => Promise<boolean>
  readonly allowsSuppressionsIn: (path: string) => Promise<boolean>
  /** Await each call before the next: the changed lines are the engine's, not the call's. */
  readonly fixed: (path: string, text: string, changed: ChangedLines) => Promise<ESLint.LintResult>
  readonly linted: (path: string, text: string) => Promise<ESLint.LintResult>
}

/** `inTheConfigFolder` runs from the config's folder, `elsewhere` from the git top level. */
type EslintEnginesByFolder = { readonly inTheConfigFolder: EslintEngine; readonly elsewhere: EslintEngine }

// ESLint reads comments only where suppressions are allowed, so it reports none elsewhere.
const UNUSED_SUPPRESSIONS_REPORTED: Linter.Config = { linterOptions: { reportUnusedDisableDirectives: 'error' } }

const enginesBuilt = new WeakMap<() => EslintEngine, EslintEngine>()

/** `cwd`: the folder ESLint reads the config's globs from, and refuses every file outside of. */
export function eslintEngineFor(cwd: string, config: readonly Linter.Config[], withheld: ReadonlyMap<string, string>): EslintEngine {
  // The fix predicate is told the message, never the file, so it reads the lines from here.
  let fixableLines: ChangedLines | null = null
  const eslint = new ESLint({
    cwd,
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

/** ESLint warns of a legacy `.eslintignore` in its cwd as it builds an engine, so an engine no file needs is never built. */
export function eslintEngineBuiltOnFirstUse(build: () => EslintEngine): EslintEngine {
  const engine = (): EslintEngine => readOnce(enginesBuilt, build, (builder) => builder())
  return {
    isIgnored: (path) => engine().isIgnored(path),
    allowsSuppressionsIn: (path) => engine().allowsSuppressionsIn(path),
    fixed: (path, text, changed) => engine().fixed(path, text, changed),
    linted: (path, text) => engine().linted(path, text),
  }
}

/**
 * A file in the config's folder goes to the engine run from there: rules reading paths from ESLint's cwd
 * (check-file's folder names, import-x's dependency globs) read it as before check linted other packages.
 */
export function eslintEngineByFolder(configFolder: string, { inTheConfigFolder, elsewhere }: EslintEnginesByFolder): EslintEngine {
  const engineFor = (path: string): EslintEngine => (liesOutside(relative(configFolder, path)) ? elsewhere : inTheConfigFolder)
  return {
    isIgnored: (path) => engineFor(path).isIgnored(path),
    allowsSuppressionsIn: (path) => engineFor(path).allowsSuppressionsIn(path),
    fixed: (path, text, changed) => engineFor(path).fixed(path, text, changed),
    linted: (path, text) => engineFor(path).linted(path, text),
  }
}

/** Where ESLint refuses the config, check stops; where it throws on a file it lints, that file goes unchecked by it. */
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
  if (typeof noInlineConfig !== 'boolean') throw new TypeError(eslintFailed(`its config for ${path} says nothing of inline config`))
  return !noInlineConfig
}

function onlyResultOf(results: readonly ESLint.LintResult[], path: string): ESLint.LintResult {
  const [result, ...rest] = results
  if (result === undefined || rest.length > 0) throw new Error(eslintFailed(`it gave ${String(results.length)} results for ${path}, not one`))
  return result
}
