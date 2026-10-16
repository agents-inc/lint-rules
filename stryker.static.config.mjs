// The second pass over code that runs while modules load (docs/work/mutation-testing.md, "Known
// limits"): stryker.config.json with `ignoreStatic` off, over the in-process tests only. Stryker's
// command line can only turn `ignoreStatic` on. The pass keeps its own incremental file, since
// incremental mode would otherwise reuse the first pass's Survived results here without running them.
import { readFileSync } from 'node:fs'

const firstPass = JSON.parse(readFileSync(new URL('./stryker.config.json', import.meta.url), 'utf8'))

export default {
  ...firstPass,
  vitest: { ...firstPass.vitest, configFile: 'packages/lint-rules/vitest.mutation.in-process.config.ts' },
  ignoreStatic: false,
  incrementalFile: 'reports/stryker-incremental.static.json',
}
