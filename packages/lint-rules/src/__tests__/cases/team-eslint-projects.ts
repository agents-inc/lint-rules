import { TEAM_OXLINT_CONFIG_SETTING_NO_RULE } from '../team-configs-of-the-other-engine.ts'

// The files of a team project whose own ESLint config the editor part is merged into, linted by
// the real ESLint CLI. `team-config.mjs` holds the team's existing config; `team.eslint.config.mjs`
// lints with it alone, and `merged.eslint.config.mjs` with it merged with our editor part, naming
// the team's oxlint config, which sets no rule. The root config files are ignored by the team, so
// neither run lints them.

export const TEAM_ALONE_CONFIG_FILE = 'team.eslint.config.mjs'
export const MERGED_CONFIG_FILE = 'merged.eslint.config.mjs'
export const TEAM_CONFIG_MODULE = 'team-config.mjs'

export const FLOATING_PROMISE_FILE = 'src/floating.ts'
export const UNUSED_VARIABLE_FILE = 'src/unused.ts'
export const UNUSED_EXPRESSION_FILE = 'src/expression.ts'
/** A module in the tsconfig that a team typing only its .ts and .tsx files lints without types. */
export const TS_MODULE_FILE = 'src/tool.mts'
export const COMPONENT_FILE = 'src/component.tsx'
/** A root script outside the tsconfig: the file a team's `allowDefaultProject` exists for. */
export const ROOT_SCRIPT_FILE = 'scripts.js'
/** A TS script outside the tsconfig, in a folder a team lints without types. */
export const SCRIPT_FILE = 'scripts/build.ts'

export const teamAloneConfig = `import { teamConfig } from './${TEAM_CONFIG_MODULE}'

export default teamConfig
`

export const mergedConfig = `import { mergeEslintConfig } from '@agents-inc/lint-rules/eslint'
import { eslint } from './agents-inc.lint.mts'
import { teamConfig } from './${TEAM_CONFIG_MODULE}'

export default mergeEslintConfig(teamConfig, eslint, ${JSON.stringify(TEAM_OXLINT_CONFIG_SETTING_NO_RULE)})
`

/** typescript-eslint's recommended config, untyped: the team gives no type information. */
export const teamOnRecommended = `import tseslint from 'typescript-eslint'

export const teamConfig = [{ ignores: ['*.mjs', '*.mts'] }, ...tseslint.configs.recommended]
`

/** typescript-eslint's recommended config and eslint-plugin-react's, the raw plugin as the team registers it. */
export const teamOnRecommendedAndReact = `import react from 'eslint-plugin-react'
import tseslint from 'typescript-eslint'

export const teamConfig = [{ ignores: ['*.mjs', '*.mts'] }, ...tseslint.configs.recommended, react.configs.flat.recommended]
`

/** Typed linting through the project service, with a default project for the root script. */
export const teamOnProjectService = `import tseslint from 'typescript-eslint'

export const teamConfig = [
  { ignores: ['*.mjs', '*.mts'] },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: { allowDefaultProject: ['${ROOT_SCRIPT_FILE}'] }, tsconfigRootDir: import.meta.dirname },
    },
  },
]
`

/** Typed linting through the project service for .ts and .tsx files only: a .mts file is linted without types. */
export const teamTypingOnlyTsAndTsx = `import tseslint from 'typescript-eslint'

export const teamConfig = [
  { ignores: ['*.mjs', '*.mts'] },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
  },
]
`

/**
 * Typed linting through the project service, switched off again for the scripts folder with
 * typescript-eslint's disableTypeChecked: the scripts are linted without types.
 */
export const teamSwitchingTypesOffForScripts = `import tseslint from 'typescript-eslint'

export const teamConfig = [
  { ignores: ['*.mjs', '*.mts', '${ROOT_SCRIPT_FILE}'] },
  ...tseslint.configs.recommendedTypeChecked,
  { languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } } },
  { files: ['scripts/**'], ...tseslint.configs.disableTypeChecked },
]
`

/** Typed linting through the project service for the .ts and .tsx files under src only, named from its basePath. */
export const teamTypingSrcUnderBasePath = `import tseslint from 'typescript-eslint'

export const teamConfig = [
  { ignores: ['*.mjs', '*.mts'] },
  ...tseslint.configs.recommended,
  {
    basePath: 'src',
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
  },
]
`

/** Typed linting through \`project\`, the older way, which the project service may not sit beside. */
export const teamOnProject = `import tseslint from 'typescript-eslint'

export const teamConfig = [
  { ignores: ['*.mjs', '*.mts', '${ROOT_SCRIPT_FILE}'] },
  ...tseslint.configs.recommendedTypeChecked,
  { languageOptions: { parserOptions: { project: './tsconfig.json', tsconfigRootDir: import.meta.dirname } } },
]
`

export const floatingPromise = `async function save(): Promise<void> {}

export function run(): void {
  save()
}
`

export const unusedVariable = `const unused = 1

export {}
`

/** Draws no-unused-expressions, and typescript-eslint's extension of it, on line 3. */
export const unusedExpression = `const value = 1

value

export {}
`

/** Draws react/jsx-key, which oxlint runs for us, and react/react-in-jsx-scope, which we route to oxlint but do not ship. */
export const listWithoutKeys = `export const Items = ({ items }: { items: readonly string[] }) => (
  <ul>
    {items.map((item) => <li>{item}</li>)}
  </ul>
)
`

export const rootScript = `export const script = 1
`

/**
 * A team block whose `files` is a function, which ESLint 10 accepts though its types do not: a bare
 * `warn` of max-lines in every file under a legacy folder. Only JS can write it without a cast, as
 * a team's eslint.config.mjs does.
 */
export const teamBlockWithFunctionFiles = `export const teamConfig = [
  { name: 'team', files: [(filePath) => filePath.includes('/legacy/')], rules: { 'max-lines': 'warn' } },
]
`

/** A team block whose ignores hold a function, which ESLint's types leave out and its runtime takes: it leaves legacy out. */
export const teamBlockWithFunctionIgnores = `export const teamConfig = [
  { name: 'team', files: ['**/*.tsx'], ignores: [(filePath) => filePath.includes('/legacy/')], rules: { 'max-lines': 'warn' } },
]
`
