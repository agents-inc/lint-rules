import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'
import mutationConfig from './vitest.mutation.config.ts'

// Loaded by stryker.static.config.mjs alone, for the second pass over code that runs while modules
// load (docs/work/mutation-testing.md, "Known limits"). With `ignoreStatic` off, such a mutant is on
// before any test file loads and runs every test this config keeps. The integration tests and the
// tests of the built `dist/` are left out: their child processes saw the mutant in the first pass, and
// here each such mutant would rerun them.
export default mergeConfig(
  mutationConfig,
  defineConfig({
    test: {
      exclude: [...configDefaults.exclude, '**/*.integration.test.ts', 'src/dist.test.ts', 'src/dist-loading.test.ts'],
    },
  }),
)
