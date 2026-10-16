import { buildTsconfig } from '../factories/tsconfig-factories.ts'
import type { RuleByItsNames } from '../findings-beside-the-team.ts'
import type { ProjectFiles } from '../temp-projects.ts'

// q61 (owner): one unused variable, on line 1, in a TS and a JS file in src/, in scripts/, and in a
// tool's config file at the root. Our redundancy ruleset ships no-unused-vars ignoring
// **/scripts/** and **/*.config.{ts,js,mjs,cjs}, so a consumer's `rules` naming typescript-eslint's
// version in its place decide whether those JS files are checked.

/** no-unused-vars under every name either engine reports it under: ESLint's two, and oxlint's code. */
export const NO_UNUSED_VARS: RuleByItsNames = {
  rule: 'no-unused-vars',
  names: ['no-unused-vars', '@typescript-eslint/no-unused-vars', 'eslint(no-unused-vars)'],
}

/** The files, each holding one unused variable. */
export const FILES_WITH_AN_UNUSED_VARIABLE = ['src/a.ts', 'src/a.js', 'scripts/a.ts', 'scripts/a.js', 'tool.config.js']

/** The setting a consumer's `rules` give either name. */
export const UNUSED_VARS_SETTING = ['error', { args: 'none' }] as const

function unusedVariableIn(name: string): string {
  return `const ${name} = 1\nexport {}\n`
}

/** The files with their unused variables, and a tsconfig taking in every TS file. */
export const unusedVariableFiles: ProjectFiles = {
  'tsconfig.json': JSON.stringify(buildTsconfig()),
  'src/a.ts': unusedVariableIn('unusedInSrcTs'),
  'src/a.js': unusedVariableIn('unusedInSrcJs'),
  'scripts/a.ts': unusedVariableIn('unusedInScriptsTs'),
  'scripts/a.js': unusedVariableIn('unusedInScriptsJs'),
  'tool.config.js': unusedVariableIn('unusedInToolConfigJs'),
}
