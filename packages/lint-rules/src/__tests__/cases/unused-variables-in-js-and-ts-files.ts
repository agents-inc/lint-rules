import { buildTsconfig } from '../factories/tsconfig-factories.ts'
import type { RuleByItsNames } from '../findings-beside-the-team.ts'
import type { ProjectFiles } from '../temp-projects.ts'

// One unused variable, on line 1, in a TS and a JS file in src/, in scripts/, and in a root tool config,
// which our no-unused-vars checks like any other file; and in a story, which it ships ignoring.

/** no-unused-vars under every name either engine reports it under: ESLint's two, and oxlint's code. */
export const NO_UNUSED_VARS: RuleByItsNames = {
  rule: 'no-unused-vars',
  names: ['no-unused-vars', '@typescript-eslint/no-unused-vars', 'eslint(no-unused-vars)'],
}

export const FILES_WITH_AN_UNUSED_VARIABLE = ['src/a.ts', 'src/a.js', 'scripts/a.ts', 'scripts/a.js', 'tool.config.js']

export const STORY_WITH_AN_UNUSED_VARIABLE = 'src/a.stories.ts'

/** The setting a consumer's `rules` give either name. */
export const UNUSED_VARS_SETTING = ['error', { args: 'none' }] as const

function unusedVariableIn(name: string): string {
  return `const ${name} = 1\nexport {}\n`
}

/** With a tsconfig taking in every TS file. */
export const unusedVariableFiles: ProjectFiles = {
  'tsconfig.json': JSON.stringify(buildTsconfig()),
  'src/a.ts': unusedVariableIn('unusedInSrcTs'),
  'src/a.js': unusedVariableIn('unusedInSrcJs'),
  'scripts/a.ts': unusedVariableIn('unusedInScriptsTs'),
  'scripts/a.js': unusedVariableIn('unusedInScriptsJs'),
  'tool.config.js': unusedVariableIn('unusedInToolConfigJs'),
  [STORY_WITH_AN_UNUSED_VARIABLE]: unusedVariableIn('unusedInStory'),
}
