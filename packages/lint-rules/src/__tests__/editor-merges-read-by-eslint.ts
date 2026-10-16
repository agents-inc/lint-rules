import type { Linter } from 'eslint'
import { mergeEslintConfig } from '../eslint.ts'
import { defineLintRules, type LintRules } from '../index.ts'
import { createProjectListingOxlint } from './factories/package-json-factories.ts'
import { EMPTY_TSCONFIG_ROOT_DIR } from './factories/lint-rules-factories.ts'
import { writeTeamOxlintConfigSettingNoRule } from './team-configs-of-the-other-engine.ts'
import type { TempProjects } from './temp-projects.ts'

/** A project an editor part is read in, by its name in full and the folder its lint rules are rooted at. */
export type EditorProject = { readonly project: string; readonly tsconfigRootDir: string }

/** Our editor ESLint part of the lint rules given, merged into the team's blocks, naming a team oxlint config that sets no rule where the project uses oxlint. */
export function ourEditorEslintPartMergedInto(teamBlocks: readonly Linter.Config[], lintRules: LintRules): Linter.Config[] {
  const { eslint } = defineLintRules(lintRules).editorRulesets
  return mergeEslintConfig([...teamBlocks], eslint, writeTeamOxlintConfigSettingNoRule(eslint))
}

/**
 * A project whose package.json lists oxlint, made in the temp projects given, and one whose package.json
 * lists no oxlint, each named in full for a title, which $-interpolation would cut short.
 */
export function editorProjectsIn(tempProjects: TempProjects): readonly EditorProject[] {
  return [
    { project: 'a project whose package.json lists oxlint', tsconfigRootDir: createProjectListingOxlint(tempProjects) },
    { project: 'a project whose package.json lists no oxlint', tsconfigRootDir: EMPTY_TSCONFIG_ROOT_DIR },
  ]
}
