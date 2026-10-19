import type { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import { type EslintEngineCall, eslintEngineRecording, wholeFileChanged } from '../../__tests__/factories/check-factories.ts'
import { type EslintEngine, eslintEngineBuiltOnFirstUse, eslintEngineByFolder, eslintEngineFor, readsInlineConfigUnder } from './eslint-run.ts'

// ESLint always fills in `linterOptions` (10.12), so a config without it is no config ESLint gave.

const PROJECT_DIR = '/project'
const LINTED_FILE = '/project/src/a.ts'
const CONFIG_FOLDER = '/repo/packages/web'
const LINTED_TEXT = 'export const a = 1\n'
// ESLint refuses an empty `files`, with a TypeError of its own (measured, ESLint 10.12).
const A_CONFIG_ESLINT_REFUSES: Linter.Config = { files: [] }
const ESLINT_REFUSING_IT = 'Config (unnamed): Key "files": Expected value to be a non-empty array at user-defined index 0.'

const FILES_BY_PLACE = [
  { place: 'in the config folder', path: '/repo/packages/web/src/a.ts', engine: 'config folder' },
  { place: 'in another package', path: '/repo/packages/api/src/a.ts', engine: 'git top level' },
  { place: "in a folder whose name starts with the config folder's", path: '/repo/packages/web-admin/src/a.ts', engine: 'git top level' },
  { place: 'at the git top level', path: '/repo/a.ts', engine: 'git top level' },
]

const CALLS: readonly { readonly method: keyof EslintEngine; readonly call: (engine: EslintEngine, path: string) => Promise<unknown> }[] = [
  { method: 'isIgnored', call: (engine, path) => engine.isIgnored(path) },
  { method: 'allowsSuppressionsIn', call: (engine, path) => engine.allowsSuppressionsIn(path) },
  { method: 'fixed', call: (engine, path) => engine.fixed(path, LINTED_TEXT, wholeFileChanged()) },
  { method: 'linted', call: (engine, path) => engine.linted(path, LINTED_TEXT) },
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
    expect(() => readsInlineConfigUnder(config, LINTED_FILE)).toThrowError(
      expect.objectContaining({ name: 'TypeError', message: `ESLint failed: its config for ${LINTED_FILE} says nothing of inline config` }),
    )
  })
})

describe('eslintEngineFor', () => {
  // No type check comes before this error, so it stays an Error, whatever ESLint threw.
  it('throws an Error saying ESLint failed where ESLint refuses the config', async () => {
    const engine = eslintEngineFor(PROJECT_DIR, [A_CONFIG_ESLINT_REFUSES], new Map())

    await expect(engine.isIgnored(LINTED_FILE)).rejects.toThrowError(expect.objectContaining({ name: 'Error', message: `ESLint failed: ${ESLINT_REFUSING_IT}` }))
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
