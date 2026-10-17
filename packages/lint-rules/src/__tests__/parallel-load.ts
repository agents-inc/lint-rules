import { vi } from 'vitest'

/**
* For a test running an engine's CLI or another process, or loading the ESLint entry: a full parallel run slows
* each several-fold, past vitest's default 5 s.
*/
export const PARALLEL_LOAD_TIMEOUT_MS = 60_000

/** Call it at the top of a file whose every test runs an engine. */
export function allowEveryTestForParallelLoad(): void {
  vi.setConfig({ testTimeout: PARALLEL_LOAD_TIMEOUT_MS, hookTimeout: PARALLEL_LOAD_TIMEOUT_MS })
}
