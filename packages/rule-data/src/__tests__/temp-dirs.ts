import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll } from 'vitest'

/**
 * A temp folder named from the prefix, made before the suite's tests and removed after them. Call it
 * at the top of a describe block, before the block's own hooks: Vitest runs `beforeAll` hooks in the
 * order they are registered and `afterAll` hooks in reverse, so the folder exists for every other hook.
 * The function returned reads the folder from a hook or a test.
 */
export function setUpTempDir(prefix: string): () => string {
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
