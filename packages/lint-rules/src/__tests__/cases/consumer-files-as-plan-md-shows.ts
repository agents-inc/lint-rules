import { buildPackageJsonListingOxlint, packageJsonText } from '../factories/package-json-factories.ts'
import { buildTsconfig } from '../factories/tsconfig-factories.ts'
import type { ProjectFiles } from '../temp-projects.ts'

// The files a team has once `init` has run and it merges the editor set into its own configs, as plan.md shows
// them, with empty team configs.

/** The two keys a case varies in `agents-inc.lint.mts`: each as its value's source text, null where the key is left out. */
export type AgentsIncLintKeys = { readonly tsconfigRootDir: string | null; readonly editorRulesets: string | null }

export const AS_PLAN_MD_SHOWS: AgentsIncLintKeys = { tsconfigRootDir: 'import.meta.dirname', editorRulesets: '{}' }

const EDITOR_RULESETS_COMMENT = '   // add the rulesets people\'s editors should show'

// A classic loop, a debugger statement, an explicit any, a floating promise and a loose equality; then a prototype
// builtin called on an object, which oxlint runs for our correctness ruleset outside its correctness category.
const PLANTED_SOURCE = `export function sum(values: readonly number[]): number {
  let total = 0
  for (let index = 0; index < values.length; index++) {
    total += values[index] ?? 0
  }
  return total
}

export function pause(): void {
  debugger
}

export const loose: any = JSON.parse('1')

async function load(): Promise<number> {
  return 1
}

export function start(): void {
  load()
}

export function same(left: number, right: string): boolean {
  return left == Number(right)
}

export function owns(record: object, key: string): boolean {
  return record.hasOwnProperty(key)
}
`

// plan.md's eslint.config.mjs, with the team's existing config an empty one.
export const ESLINT_CONFIG_TEXT = `// eslint.config.mjs
import { mergeEslintConfig } from '@agents-inc/lint-rules/eslint'
import { eslint } from './agents-inc.lint.mts'

const theirExistingConfig = []

export default mergeEslintConfig(theirExistingConfig, eslint, { oxlintConfig: 'oxlint.config.mts' })
`

// plan.md's oxlint config, with the team's existing config an empty one.
export const OXLINT_CONFIG_TEXT = `// oxlint.config.mts
import { mergeOxlintConfig } from '@agents-inc/lint-rules/oxlint'
import { defineConfig } from 'oxlint'
import { oxlint } from './agents-inc.lint.mts'

const theirExistingConfig = {}

export default defineConfig(mergeOxlintConfig(theirExistingConfig, oxlint, { eslintConfig: 'eslint.config.mjs' }))
`

export const OXLINT_CONFIG_FILE = 'oxlint.config.mts'

export const PLANTED_FILE = 'src/planted.ts'

/** Verbatim as plan.md shows `init` writing it: a key given another value keeps its line; one left out loses it. */
export function agentsIncLintTextAsPlanMdShows({ tsconfigRootDir, editorRulesets }: AgentsIncLintKeys): string {
  const tsconfigRootDirLine = tsconfigRootDir === null ? '' : `  tsconfigRootDir: ${tsconfigRootDir},\n`
  const editorRulesetsLine = editorRulesets === null ? '' : `  editorRulesets: ${editorRulesets},${EDITOR_RULESETS_COMMENT}\n`
  return `import { defineLintRules } from '@agents-inc/lint-rules'

const config = defineLintRules({
${tsconfigRootDirLine}
  agentRulesets: {
    quality: [
      'correctness',
      'type-safety',
      'security',
      'accessibility',
      'performance',
      'complexity',
      'declarative',
      'immutability',
      'modern-js',
      'redundancy',
      'modules',
      'import-order',
      'naming',
      'comments',
      'ordering',
      'conventions',
      'tests',
    ],
    libs: {
      ui: ['react'],
      testing: ['vitest', 'testing-library', 'storybook'],
      forms: ['react-hook-form'],
      styling: ['css-modules'],
    },
    runtimes: [
      'node',
      'browser',
    ],
    languages: [],   // no JSON, Markdown or CSS rules exist yet
  },

${editorRulesetsLine}
  ignores: [],

  rules: {},

  fileOverrides: [],
})

export const { eslint, oxlint } = config.editorRulesets
`
}

/** A project listing oxlint, with the planted problems in src/ and the files plan.md shows. */
export function consumerFilesAsPlanMdShows(keys: AgentsIncLintKeys): ProjectFiles {
  return {
    'package.json': packageJsonText(buildPackageJsonListingOxlint()),
    'tsconfig.json': JSON.stringify(buildTsconfig({ include: ['src'] })),
    [PLANTED_FILE]: PLANTED_SOURCE,
    'agents-inc.lint.mts': agentsIncLintTextAsPlanMdShows(keys),
    'eslint.config.mjs': ESLINT_CONFIG_TEXT,
    [OXLINT_CONFIG_FILE]: OXLINT_CONFIG_TEXT,
  }
}
