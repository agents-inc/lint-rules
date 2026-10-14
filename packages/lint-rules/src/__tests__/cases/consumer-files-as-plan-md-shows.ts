import { buildPackageJsonListingOxlint, packageJsonText } from '../factories/package-json-factories.ts'
import { buildTsconfig } from '../factories/tsconfig-factories.ts'
import type { ProjectFiles } from '../temp-projects.ts'

// The files a team has once `init` has run and it merges the editor set into its own configs, as
// plan.md ("Files `init` adds or changes") shows them, with the real run's empty team configs. Real
// run 3 (case C1) installed the built package beside them and ran both engines from the project.

/** The two keys a case varies in `agents-inc.lint.mts`: each as its value's source text, null where the key is left out. */
export type AgentsIncLintKeys = { readonly tsconfigRootDir: string | null; readonly editorRulesets: string | null }

/** plan.md's values of the two keys. */
export const AS_PLAN_MD_SHOWS: AgentsIncLintKeys = { tsconfigRootDir: 'import.meta.dirname', editorRulesets: '{}' }

const EDITOR_RULESETS_COMMENT = '   // add the rulesets people\'s editors should show'

// Real run 3, case C1's src/planted.ts: a classic loop, a debugger statement, an explicit any, a
// floating promise and a loose equality; then a prototype builtin called on an object, which
// oxlint runs for our correctness ruleset outside its own correctness category.
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
const ESLINT_CONFIG_TEXT = `// eslint.config.mjs
import { mergeEslintConfig } from '@agents-inc/lint-rules/eslint'
import { eslint } from './agents-inc.lint.mts'

const theirExistingConfig = []

export default mergeEslintConfig(theirExistingConfig, eslint, { oxlintConfig: 'oxlint.config.mts' })
`

// plan.md's oxlint config, with the team's existing config an empty one.
const OXLINT_CONFIG_TEXT = `// oxlint.config.mts
import { mergeOxlintConfig } from '@agents-inc/lint-rules/oxlint'
import { defineConfig } from 'oxlint'
import { oxlint } from './agents-inc.lint.mts'

const theirExistingConfig = {}

export default defineConfig(mergeOxlintConfig(theirExistingConfig, oxlint, { eslintConfig: 'eslint.config.mjs' }))
`

/** The oxlint config file the team's oxlint loads. */
export const OXLINT_CONFIG_FILE = 'oxlint.config.mts'

/** The file every case plants its problems in. */
export const PLANTED_FILE = 'src/planted.ts'

/**
 * `agents-inc.lint.mts` as plan.md shows `init` writing it, verbatim with the keys as plan.md gives
 * them; a key given another value keeps its line, and a key left out loses it.
 */
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

/**
 * A project whose package.json lists oxlint, its tsconfig taking in src/, the problems of real run
 * 3's case C1 planted in src/, and the files plan.md shows: `agents-inc.lint.mts` with the keys given,
 * and the team's two configs merging its parts.
 */
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
