import { beforeAll, describe, expect, it } from 'vitest'
import { INSTALLED_TYPES_NODE, type ProcessResult, typeCheck } from './__tests__/config-file-loads.ts'
import { CONFIG_FILE } from './__tests__/factories/check-factories.ts'
import {
  buildFileOverridesModule,
  entryWithFiles,
  type FileOverridesModule,
  fileOverridesModuleText,
  positionInEntry,
  type SourcePosition,
} from './__tests__/factories/file-overrides-module-factories.ts'
import { buildTsconfigListingNodeTypes } from './__tests__/factories/tsconfig-factories.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { CONSUMER_INSTALL, type TempProjects } from './__tests__/temp-projects.ts'
import { tscErrorsIn } from './__tests__/tsc-errors.ts'

// What a team's tsc, and any editor running TypeScript, says of an entry's `files` that can name no file: the
// error is the refusal, read from the published types in dist (built first), as a consumer installs them.

const SLASH_LED_GLOB = "'/x.ts'"
const SAYS_HOW_TO_WRITE_IT = "files can't start with /: write ./x.ts"
// TypeScript's own words, for a list that must hold at least one glob.
const SAYS_IT_NEEDS_A_GLOB = 'Source has 0 element(s) but target requires 1.'
const NO_GLOB = '[]'
const FILES_KEY = 'files'
const TYPE_NOT_ASSIGNABLE = 'TS2322'
// tsc exits 2 where it reports errors and emits nothing.
const TSC_REPORTED_ERRORS = 2
const TSC_RUN_TIMEOUT_MS = 120_000

const SLASH_LED_GLOB_BESIDE_OTHER_ENTRIES = buildFileOverridesModule({
  entries: [entryWithFiles("['**/*.test.ts']"), entryWithFiles(`[${SLASH_LED_GLOB}]`), entryWithFiles("['apps/api/**']")],
})
const NO_GLOB_AT_ALL = buildFileOverridesModule({ entries: [entryWithFiles(NO_GLOB)] })
const SLASH_LED_GLOB_AFTER_ANOTHER = buildFileOverridesModule({ entries: [entryWithFiles(`['src/**', ${SLASH_LED_GLOB}]`)] })
const SLASH_LED_GLOB_AFTER_ANOTHER_AT = positionInEntry(SLASH_LED_GLOB_AFTER_ANOTHER, 0, SLASH_LED_GLOB)
const FILES_KEY_OF_THE_ENTRY_AFTER_ANOTHER_AT = positionInEntry(SLASH_LED_GLOB_AFTER_ANOTHER, 0, FILES_KEY)
const GLOBS_THE_TYPES_TAKE = buildFileOverridesModule({
  declarations: ["const LEGACY_GLOBS = ['legacy/**', './scripts/*.ts'] as const"],
  entries: [entryWithFiles("['x.ts']"), entryWithFiles("['./x.ts']"), entryWithFiles("['**/*.ts']"), entryWithFiles('LEGACY_GLOBS')],
  // A `/` in the top-level ignores anchors the glob at the root, as in a .gitignore line.
  topLevel: ["ignores: ['/a.js']"],
})

/** An error as a test reads it: where, its code, and whether its message says what it should. */
type ErrorRead = SourcePosition & { readonly file: string; readonly code: string; readonly says: boolean }

/** tsc over a project whose tsconfig takes in the config file alone, our package and Node's types installed. */
function typeCheckedConsumer(tempProjects: TempProjects, module: FileOverridesModule): ProcessResult {
  return typeCheck(
    tempProjects.create({
      files: { 'tsconfig.json': `${JSON.stringify(buildTsconfigListingNodeTypes({ include: [CONFIG_FILE] }))}\n`, [CONFIG_FILE]: fileOverridesModuleText(module) },
      linkedPackages: [...CONSUMER_INSTALL, INSTALLED_TYPES_NODE],
    }),
  )
}

function errorsSaying({ exitCode, stdout }: ProcessResult, text: string): { readonly exitCode: number | null; readonly errors: readonly ErrorRead[] } {
  return { exitCode, errors: tscErrorsIn(stdout).map(({ file, line, column, code, message }) => ({ file, line, column, code, says: message.includes(text) })) }
}

describe("tsc over agents-inc.lint.mts, an entry's files read through the published types", () => {
  const runs = setUpRunsBeforeTheSuite(
    (tempProjects) => ({
      slashLed: typeCheckedConsumer(tempProjects, SLASH_LED_GLOB_BESIDE_OTHER_ENTRIES),
      noGlob: typeCheckedConsumer(tempProjects, NO_GLOB_AT_ALL),
      taken: typeCheckedConsumer(tempProjects, GLOBS_THE_TYPES_TAKE),
    }),
    { timeoutMs: TSC_RUN_TIMEOUT_MS, whatFailed: 'tsc could not be run on the consumer projects before the suite' },
  )

  it('reports a glob led by / at that glob, saying to write it from ./, and nothing in the entries beside it', () => {
    expect(errorsSaying(runs().slashLed, SAYS_HOW_TO_WRITE_IT)).toStrictEqual({
      exitCode: TSC_REPORTED_ERRORS,
      errors: [{ file: CONFIG_FILE, ...positionInEntry(SLASH_LED_GLOB_BESIDE_OTHER_ENTRIES, 1, SLASH_LED_GLOB), code: TYPE_NOT_ASSIGNABLE, says: true }],
    })
  })

  it("reports a files list naming no glob at the entry's files key, in TypeScript's own words", () => {
    expect(errorsSaying(runs().noGlob, SAYS_IT_NEEDS_A_GLOB)).toStrictEqual({
      exitCode: TSC_REPORTED_ERRORS,
      errors: [{ file: CONFIG_FILE, ...positionInEntry(NO_GLOB_AT_ALL, 0, FILES_KEY), code: TYPE_NOT_ASSIGNABLE, says: true }],
    })
  })

  it('reports nothing for globs not led by /, a list held as const, and a top-level ignores value led by /', () => {
    expect(runs().taken).toStrictEqual({ exitCode: 0, stdout: '', stderr: '' })
  })
})

describe("tsc over agents-inc.lint.mts, a glob led by / after another glob of an entry's files", () => {
  const runs = setUpRunsBeforeTheSuite((tempProjects) => errorsSaying(typeCheckedConsumer(tempProjects, SLASH_LED_GLOB_AFTER_ANOTHER), SAYS_HOW_TO_WRITE_IT), {
    timeoutMs: TSC_RUN_TIMEOUT_MS,
    whatFailed: 'tsc could not be run on the consumer project, or its output read, before the suite',
  })
  // A run that failed throws here, before the tests, so only the assertion can fail inside it.fails.
  beforeAll(() => {
    runs()
  })

  it("reports it on the entry's files key, saying to write it from ./", () => {
    expect(runs()).toStrictEqual({
      exitCode: TSC_REPORTED_ERRORS,
      errors: [{ file: CONFIG_FILE, ...FILES_KEY_OF_THE_ENTRY_AFTER_ANOTHER_AT, code: TYPE_NOT_ASSIGNABLE, says: true }],
    })
  })

  // KNOWN GAP: TypeScript puts an error on an element of a list only at a position the target tuple names, and
  // `[glob, ...globs]` names the first alone, so a later glob led by / is reported at the entry's files key, the
  // text saying to write it from ./ on the third line of the error (measured, TypeScript 6.0.3 and 5.9.3).
  it.fails('reports it at that glob, saying to write it from ./', () => {
    expect(runs()).toStrictEqual({
      exitCode: TSC_REPORTED_ERRORS,
      errors: [{ file: CONFIG_FILE, ...SLASH_LED_GLOB_AFTER_ANOTHER_AT, code: TYPE_NOT_ASSIGNABLE, says: true }],
    })
  })
})
