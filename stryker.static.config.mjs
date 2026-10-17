// Second pass with `ignoreStatic` off, which Stryker's command line can't set. Its own incremental
// file, or incremental mode would reuse the first pass's Survived results without running them.
import { readFileSync } from 'node:fs'

const firstPass = JSON.parse(readFileSync(new URL('./stryker.config.json', import.meta.url), 'utf8'))

export default {
  ...firstPass,
  vitest: { ...firstPass.vitest, configFile: 'packages/lint-rules/vitest.mutation.in-process.config.ts' },
  ignoreStatic: false,
  incrementalFile: 'reports/stryker-incremental.static.json',
}
