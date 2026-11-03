import { beforeAll, describe, expect, it } from 'vitest'
import { type ProcessResult, typeCheckedConsumer } from './__tests__/config-file-loads.ts'
import { CONFIG_FILE } from './__tests__/factories/check-factories.ts'
import {
  buildFileOverridesModule,
  entryWithFiles,
  type FileOverridesModule,
  fileOverridesModuleText,
  positionInEntry,
} from './__tests__/factories/file-overrides-module-factories.ts'
import { PARALLEL_LOAD_TIMEOUT_MS } from './__tests__/parallel-load.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import type { TempProjects } from './__tests__/temp-projects.ts'
import { errorsSaying, TSC_REPORTED_ERRORS, TSC_RUN_TIMEOUT_MS, TYPE_NOT_ASSIGNABLE } from './__tests__/tsc-errors.ts'

// What a team's tsc, and any editor running TypeScript, says of an entry's `files` that can name no file: the
// error is the refusal, read from the published types in dist (built first), as a consumer installs them.

const SLASH_LED_GLOB = "'/x.ts'"
const SAYS_HOW_TO_WRITE_IT = "files can't start with /: write ./x.ts"
// TypeScript's own words, for a list that must hold at least one glob.
const SAYS_IT_NEEDS_A_GLOB = 'Source has 0 element(s) but target requires 1.'
const NO_GLOB = '[]'
const FILES_KEY = 'files'

const SLASH_LED_GLOB_BESIDE_OTHER_ENTRIES = buildFileOverridesModule({
  entries: [entryWithFiles("['**/*.test.ts']"), entryWithFiles(`[${SLASH_LED_GLOB}]`), entryWithFiles("['apps/api/**']")],
})
const NO_GLOB_AT_ALL = buildFileOverridesModule({ entries: [entryWithFiles(NO_GLOB)] })
const SLASH_LED_GLOB_AFTER_ANOTHER = buildFileOverridesModule({ entries: [entryWithFiles(`['src/**', ${SLASH_LED_GLOB}]`)] })
const GLOBS_THE_TYPES_TAKE = buildFileOverridesModule({
  declarations: ["const LEGACY_GLOBS = ['legacy/**', './scripts/*.ts'] as const"],
  entries: [entryWithFiles("['x.ts']"), entryWithFiles("['./x.ts']"), entryWithFiles("['**/*.ts']"), entryWithFiles('LEGACY_GLOBS')],
  // A `/` in the top-level ignores anchors the glob at the root, as in a .gitignore line.
  topLevel: ["ignores: ['/a.js']"],
})

function typeCheckedConfigFile(tempProjects: TempProjects, module: FileOverridesModule): ProcessResult {
  return typeCheckedConsumer(tempProjects, { [CONFIG_FILE]: fileOverridesModuleText(module) })
}

describe("tsc over agents-inc.lint.mts, an entry's files read through the published types", () => {
  const runs = setUpRunsBeforeTheSuite(
    (tempProjects) => ({
      slashLed: typeCheckedConfigFile(tempProjects, SLASH_LED_GLOB_BESIDE_OTHER_ENTRIES),
      noGlob: typeCheckedConfigFile(tempProjects, NO_GLOB_AT_ALL),
      taken: typeCheckedConfigFile(tempProjects, GLOBS_THE_TYPES_TAKE),
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
  const runs = setUpRunsBeforeTheSuite((tempProjects) => errorsSaying(typeCheckedConfigFile(tempProjects, SLASH_LED_GLOB_AFTER_ANOTHER), SAYS_HOW_TO_WRITE_IT), {
    timeoutMs: TSC_RUN_TIMEOUT_MS,
    whatFailed: 'tsc could not be run on the consumer project, or its output read, before the suite',
  })
  const positions = setUpRunsBeforeTheSuite(
    () => ({ ofTheGlob: positionInEntry(SLASH_LED_GLOB_AFTER_ANOTHER, 0, SLASH_LED_GLOB), ofTheFilesKey: positionInEntry(SLASH_LED_GLOB_AFTER_ANOTHER, 0, FILES_KEY) }),
    { timeoutMs: PARALLEL_LOAD_TIMEOUT_MS, whatFailed: "the positions in the entry's text could not be found before the suite" },
  )
  // A run or a reading that failed throws here, before the tests, so only the assertion can fail inside it.fails.
  beforeAll(() => {
    runs()
    positions()
  })

  it("reports it on the entry's files key, saying to write it from ./", () => {
    expect(runs()).toStrictEqual({
      exitCode: TSC_REPORTED_ERRORS,
      errors: [{ file: CONFIG_FILE, ...positions().ofTheFilesKey, code: TYPE_NOT_ASSIGNABLE, says: true }],
    })
  })

  // KNOWN GAP: TypeScript puts an error on an element of a list only at a position the target tuple names, and
  // `[glob, ...globs]` names the first alone, so a later glob led by / is reported at the entry's files key, the
  // text saying to write it from ./ on the third line of the error (measured, TypeScript 6.0.3 and 5.9.3).
  it.fails('reports it at that glob, saying to write it from ./', () => {
    expect(runs()).toStrictEqual({
      exitCode: TSC_REPORTED_ERRORS,
      errors: [{ file: CONFIG_FILE, ...positions().ofTheGlob, code: TYPE_NOT_ASSIGNABLE, says: true }],
    })
  })
})
