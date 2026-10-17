import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'
import mutationConfig from './vitest.mutation.config.ts'

// For stryker.static.config.mjs: a static mutant runs every test kept here, so the child-process
// tests, which already saw it in the first pass, are left out.
export default mergeConfig(
  mutationConfig,
  defineConfig({
    test: {
      exclude: [...configDefaults.exclude, '**/*.integration.test.ts', 'src/dist.test.ts', 'src/dist-loading.test.ts'],
    },
  }),
)
