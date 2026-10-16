import { describe, expect, it } from 'vitest'
import { readsInlineConfigUnder } from './eslint-run.ts'

// The agent build has ESLint read no inline config where suppressions are banned, so the config ESLint
// computes for a file says whether suppressions are allowed there (q-c15). It always fills in
// `linterOptions` (measured, ESLint 10.12), so a config without it is no config ESLint gave.

const LINTED_FILE = '/project/src/a.ts'

describe('readsInlineConfigUnder', () => {
  it.each([
    { kind: 'suppressions allowed', config: { linterOptions: { noInlineConfig: false } }, reads: true },
    { kind: 'suppressions banned', config: { linterOptions: { noInlineConfig: true } }, reads: false },
  ])('reads what the config ESLint computed says: $kind', ({ config, reads }) => {
    expect(readsInlineConfigUnder(config, LINTED_FILE)).toBe(reads)
  })

  it.each([
    { kind: 'no config', config: undefined },
    { kind: 'no linterOptions', config: {} },
    { kind: 'linterOptions without noInlineConfig', config: { linterOptions: {} } },
  ])('refuses a config that says nothing of inline config, naming the file: $kind', ({ config }) => {
    expect(() => readsInlineConfigUnder(config, LINTED_FILE)).toThrowError(new Error(`ESLint failed: its config for ${LINTED_FILE} says nothing of inline config`))
  })
})
