import { fileURLToPath } from 'node:url'
import { RuleTester } from '@typescript-eslint/rule-tester'
import { afterAll, describe, it } from 'vitest'

// vitest runs with `globals: false`, so the tester is handed its suite hooks.
RuleTester.afterAll = afterAll
RuleTester.describe = describe
RuleTester.it = it

// As in the shipped config: a case quoting a directive would otherwise fail on an unused-directive warning.
export const houseRuleTester = new RuleTester({
  languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
  linterOptions: { reportUnusedDisableDirectives: 'off' },
})

// Each case is `file.ts` in a folder whose tsconfig takes in no file, so the project service types it
// with that tsconfig as the default project.
export const houseTypedRuleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: { allowDefaultProject: ['*.ts'], defaultProject: 'tsconfig.json' },
      tsconfigRootDir: fileURLToPath(new URL('typed-project', import.meta.url)),
    },
  },
})
