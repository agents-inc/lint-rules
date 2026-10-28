import { AsyncLocalStorage } from 'node:async_hooks'
import { relative } from 'node:path'
import { ESLint, type Linter } from 'eslint'
import { messageOf } from '../../core/caught-errors.ts'
import { isRecord } from '../../core/is-record.ts'
import { liesOutside } from '../../core/lies-outside.ts'
import { readOnce } from '../../core/read-once.ts'
import type { ChangedLines } from './changed-lines.ts'
import { eslintFixFilter } from './eslint-fix-filter.ts'
import { eslintFailed } from './texts.ts'

/** The project's own ESLint config is never loaded. */
export type EslintEngine = {
  readonly isIgnored: (path: string) => Promise<boolean>
  readonly allowsSuppressionsIn: (path: string) => Promise<boolean>
  readonly fixed: (path: string, text: string, changed: ChangedLines) => Promise<ESLint.LintResult>
  readonly linted: (path: string, text: string) => Promise<ESLint.LintResult>
}

/** `inTheConfigFolder` runs from the config's folder, `elsewhere` from the git top level. */
type EslintEnginesByFolder = { readonly inTheConfigFolder: EslintEngine; readonly elsewhere: EslintEngine }

/** The changed lines of the file a `fixed` call fixes, held in that call's async context. */
type LinesBeingFixed = AsyncLocalStorage<ChangedLines>

// ESLint reads comments only where suppressions are allowed, so it reports none elsewhere.
const UNUSED_SUPPRESSIONS_REPORTED: Linter.Config = { linterOptions: { reportUnusedDisableDirectives: 'error' } }

const enginesBuilt = new WeakMap<() => EslintEngine, EslintEngine>()

/** `cwd`: the folder ESLint reads the config's globs from, and refuses every file outside of. */
export function eslintEngineFor(cwd: string, config: readonly Linter.Config[], withheld: ReadonlyMap<string, string>): EslintEngine {
  const linesBeingFixed: LinesBeingFixed = new AsyncLocalStorage()
  const eslint = new ESLint({ cwd, overrideConfigFile: true, overrideConfig: [...config, UNUSED_SUPPRESSIONS_REPORTED], fix: fixOnTheLinesBeingFixed(linesBeingFixed, withheld) })
  return {
    isIgnored(path) {
      return eslintCall(() => eslint.isPathIgnored(path))
    },
    async allowsSuppressionsIn(path) {
      return readsInlineConfigUnder(await eslintCall(() => eslint.calculateConfigForFile(path)), path)
    },
    fixed(path, text, changed) {
      return linesBeingFixed.run(changed, () => lintedBy(eslint, path, text))
    },
    linted(path, text) {
      return lintedBy(eslint, path, text)
    },
  }
}

/**
 * ESLint takes its fix predicate once, as it builds the engine, and tells it the message alone: the lines
 * of the file a call fixes reach it through that call's async context. Outside a `fixed` call, nothing is fixed.
 */
function fixOnTheLinesBeingFixed(linesBeingFixed: Readonly<LinesBeingFixed>, withheld: ReadonlyMap<string, string>): (message: Readonly<Linter.LintMessage>) => boolean {
  return (message) => {
    const changed = linesBeingFixed.getStore()
    return changed !== undefined && eslintFixFilter(changed, withheld)(message)
  }
}

async function lintedBy(eslint: Readonly<ESLint>, path: string, text: string): Promise<ESLint.LintResult> {
  return onlyResultOf(await eslintCall(() => eslint.lintText(text, { filePath: path })), path)
}

/** ESLint warns of a legacy `.eslintignore` in its cwd as it builds an engine, so an engine no file needs is never built. */
export function eslintEngineBuiltOnFirstUse(build: () => EslintEngine): EslintEngine {
  function engine(): EslintEngine {
    return readOnce(enginesBuilt, build, (builder) => builder())
  }
  return {
    isIgnored(path) {
      return engine().isIgnored(path)
    },
    allowsSuppressionsIn(path) {
      return engine().allowsSuppressionsIn(path)
    },
    fixed(path, text, changed) {
      return engine().fixed(path, text, changed)
    },
    linted(path, text) {
      return engine().linted(path, text)
    },
  }
}

/**
 * A file in the config's folder goes to the engine run from there: rules reading paths from ESLint's cwd
 * (check-file's folder names, import-x's dependency globs) read it as before check linted other packages.
 */
export function eslintEngineByFolder(configFolder: string, { inTheConfigFolder, elsewhere }: EslintEnginesByFolder): EslintEngine {
  function engineFor(path: string): EslintEngine {
    return liesOutside(relative(configFolder, path)) ? elsewhere : inTheConfigFolder
  }
  return {
    isIgnored(path) {
      return engineFor(path).isIgnored(path)
    },
    allowsSuppressionsIn(path) {
      return engineFor(path).allowsSuppressionsIn(path)
    },
    fixed(path, text, changed) {
      return engineFor(path).fixed(path, text, changed)
    },
    linted(path, text) {
      return engineFor(path).linted(path, text)
    },
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
