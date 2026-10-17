import { ESLint } from 'eslint'
import { projectPathOf } from './project-paths.ts'

const EVERYTHING = '.'

/** As `eslint .` lints them under one block of global ignores, by path relative to the project; ESLint's default ignores apply too. */
export async function filesEslintLintsUnderGlobalIgnores(projectDir: string, ignores: readonly string[]): Promise<string[]> {
  const eslint = new ESLint({ cwd: projectDir, overrideConfigFile: true, overrideConfig: [{ ignores: [...ignores] }], errorOnUnmatchedPattern: false })
  const results = await eslint.lintFiles([EVERYTHING])
  return results.map(({ filePath }) => projectPathOf(filePath, projectDir))
}
