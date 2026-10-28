import { join } from 'node:path'
import type { Linter } from 'eslint'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { aLegacyEslintignoreIn, type EslintEngineCall, eslintEngineRecording, wholeFileChanged } from '../../__tests__/factories/check-factories.ts'
import { setUpTempProjects } from '../../__tests__/temp-projects.ts'
import { type EslintEngine, eslintEngineBuiltOnFirstUse, eslintEngineByFolder, eslintEngineFor, readsInlineConfigUnder } from './eslint-run.ts'

// ESLint always fills in `linterOptions` (10.12), so a config without it is no config ESLint gave.

const PROJECT_DIR = '/project'
const LINTED_FILE = '/project/src/a.ts'
const CONFIG_FOLDER = '/repo/packages/web'
const LINTED_TEXT = 'export const a = 1\n'
// ESLint refuses an empty `files`, with a TypeError of its own (measured, ESLint 10.12).
const A_CONFIG_ESLINT_REFUSES: Linter.Config = { files: [] }
const ESLINT_REFUSING_IT = 'Config (unnamed): Key "files": Expected value to be a non-empty array at user-defined index 0.'
// The type ESLint gives the warning it emits where it finds a `.eslintignore` in its cwd as it is built (10.12).
const ESLINTIGNORE_WARNING_TYPE = 'ESLintIgnoreWarning'
const FILES_READ_TWICE = ['src/a.js', 'src/b.js', 'src/a.js']
// As the agent build does: ESLint says where suppressions are allowed only where a config sets it.
const A_CONFIG_SAYING_WHERE_SUPPRESSIONS_ARE_ALLOWED: readonly Linter.Config[] = [{ linterOptions: { noInlineConfig: true } }]

const FILES_BY_PLACE = [
  { place: 'in the config folder', path: '/repo/packages/web/src/a.ts', engine: 'config folder' },
  { place: 'in another package', path: '/repo/packages/api/src/a.ts', engine: 'git top level' },
  { place: "in a folder whose name starts with the config folder's", path: '/repo/packages/web-admin/src/a.ts', engine: 'git top level' },
  { place: 'at the git top level', path: '/repo/a.ts', engine: 'git top level' },
]

const CALLS: ReadonlyArray<{ readonly method: keyof EslintEngine; readonly call: (engine: EslintEngine, path: string) => Promise<unknown> }> = [
  { method: 'isIgnored', call(engine, path) { return engine.isIgnored(path) } },
  { method: 'allowsSuppressionsIn', call(engine, path) { return engine.allowsSuppressionsIn(path) } },
  { method: 'fixed', call(engine, path) { return engine.fixed(path, LINTED_TEXT, wholeFileChanged()) } },
  { method: 'linted', call(engine, path) { return engine.linted(path, LINTED_TEXT) } },
]

describe('readsInlineConfigUnder', () => {
  it.each([
    { kind: 'suppressions allowed', config: { linterOptions: { noInlineConfig: false } }, reads: true },
    { kind: 'suppressions banned', config: { linterOptions: { noInlineConfig: true } }, reads: false },
  ])('reads what the config ESLint computed says: $kind', ({ config, reads }) => {
    expect(readsInlineConfigUnder(config, LINTED_FILE)).toBe(reads)
  })

  // An error that follows a type check is a TypeError.
  it.each([
    { kind: 'no config', config: undefined },
    { kind: 'no linterOptions', config: {} },
    { kind: 'linterOptions without noInlineConfig', config: { linterOptions: {} } },
  ])('throws a TypeError naming the file where the config says nothing of inline config: $kind', ({ config }) => {
    expect(() => readsInlineConfigUnder(config, LINTED_FILE)).toThrow(
      expect.objectContaining({ name: 'TypeError', message: `ESLint failed: its config for ${LINTED_FILE} says nothing of inline config` }),
    )
  })
})

const tempProjects = setUpTempProjects()

/** The type of each warning emitted while every call is made on every file, each awaited before the next, as check makes them. */
async function warningsWhileEachCallIsMade(dir: string): Promise<unknown[]> {
  const emitted = vi.spyOn(process, 'emitWarning').mockImplementation(() => undefined)
  const engine = eslintEngineFor(dir, A_CONFIG_SAYING_WHERE_SUPPRESSIONS_ARE_ALLOWED, new Map())
  const everyCall = FILES_READ_TWICE.flatMap((file) => CALLS.map(({ call }) => () => call(engine, join(dir, file))))
  await everyCall.reduce<Promise<unknown>>(async (previous, next) => {
    await previous
    return next()
  }, Promise.resolve())
  return emitted.mock.calls.map(([, type]) => type)
}

describe('eslintEngineFor', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // No type check comes before this error, so it stays an Error, whatever ESLint threw.
  it('throws an Error saying ESLint failed where ESLint refuses the config', async () => {
    const engine = eslintEngineFor(PROJECT_DIR, [A_CONFIG_ESLINT_REFUSES], new Map())

    await expect(engine.isIgnored(LINTED_FILE)).rejects.toThrow(expect.objectContaining({ name: 'Error', message: `ESLint failed: ${ESLINT_REFUSING_IT}` }))
  })

  // check runs one engine per folder, so a team's legacy .eslintignore costs one warning on stderr, not one per file.
  it('warns of a legacy .eslintignore in its folder once, however many files it then reads, fixes and lints', async () => {
    const dir = tempProjects.create({ files: aLegacyEslintignoreIn() })

    expect(await warningsWhileEachCallIsMade(dir)).toStrictEqual([ESLINTIGNORE_WARNING_TYPE])
  })

  it('warns of nothing where its folder holds no .eslintignore, beside that one', async () => {
    const dir = tempProjects.create({ files: {} })

    expect(await warningsWhileEachCallIsMade(dir)).toStrictEqual([])
  })
})

describe('eslintEngineByFolder', () => {
  it.each(CALLS)("hands $method on a file in the config folder to that folder's engine, and on any other file to the git top level's", async ({ method, call }) => {
    const calls: EslintEngineCall[] = []
    const engine = eslintEngineByFolder(CONFIG_FOLDER, { inTheConfigFolder: eslintEngineRecording('config folder', calls), elsewhere: eslintEngineRecording('git top level', calls) })

    await Promise.all(FILES_BY_PLACE.map(({ path }) => call(engine, path)))

    expect(calls).toStrictEqual(FILES_BY_PLACE.map(({ path, engine: named }) => ({ engine: named, method, path })))
  })
})

describe('eslintEngineBuiltOnFirstUse', () => {
  it.each(CALLS)('builds no engine before a call, builds it on the first, $method, and hands every call to that one engine', async ({ method, call }) => {
    const builds: string[] = []
    const calls: EslintEngineCall[] = []
    const engine = eslintEngineBuiltOnFirstUse(() => {
      // eslint-disable-next-line functional/immutable-data -- the stand-in build records each time it runs, which the test reads after the calls: what it returns is the engine eslintEngineBuiltOnFirstUse keeps
      builds.push('built')
      return eslintEngineRecording('built on first use', calls)
    })
    const buildsBeforeACall = [...builds]

    await call(engine, LINTED_FILE)
    await call(engine, LINTED_FILE)

    expect({ buildsBeforeACall, builds, calls }).toStrictEqual({
      buildsBeforeACall: [],
      builds: ['built'],
      calls: [
        { engine: 'built on first use', method, path: LINTED_FILE },
        { engine: 'built on first use', method, path: LINTED_FILE },
      ],
    })
  })
})
