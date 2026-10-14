import { vi } from 'vitest'

/**
 * The time a test or hook gets when it runs an engine's CLI or another process of its own, such as
 * the TypeScript project service, or loads the ESLint entry with its plugins: a full parallel run
 * slows each several-fold, past vitest's default 5 s.
 */
export const PARALLEL_LOAD_TIMEOUT_MS = 60_000

/** Gives every test and hook of the calling file that time. Call it at the top of a file whose every test runs an engine. */
export function allowEveryTestForParallelLoad(): void {
  vi.setConfig({ testTimeout: PARALLEL_LOAD_TIMEOUT_MS, hookTimeout: PARALLEL_LOAD_TIMEOUT_MS })
}
