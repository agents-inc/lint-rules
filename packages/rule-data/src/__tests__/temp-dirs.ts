import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll } from 'vitest'

/**
 * A temp folder made before the suite's tests and removed after them. Call it at the top of a describe
 * block, before the block's own hooks, so the folder exists for every other hook.
 */
export function setUpTempDir(prefix: string): () => string {
  // eslint-disable-next-line functional/no-let -- TS2588 as a const: beforeAll makes the folder and afterAll removes it, where setUpRunsBeforeTheSuite makes a value once and only reads it; and that helper is in lint-rules' tests, which rule-data cannot import (lint-rules depends on rule-data)
  let tempDir: string | undefined

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), prefix))
  })

  afterAll(async () => {
    await rm(suiteTempDir(), { recursive: true, force: true })
  })

  function suiteTempDir(): string {
    if (tempDir === undefined) throw new Error(`the temp dir made from ${prefix} was read outside the suite that set it up`)
    return tempDir
  }

  return suiteTempDir
}
