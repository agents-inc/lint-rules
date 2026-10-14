import { relative, sep } from 'node:path'
import { ESLint } from 'eslint'

const EVERYTHING = '.'
const GLOB_SEPARATOR = '/'

/**
 * The files of the project the real ESLint lints, as `eslint .` does, under a config of one block of
 * global ignores, by path relative to the project: ESLint's default ignores apply too.
 */
export async function filesEslintLintsUnderGlobalIgnores(projectDir: string, ignores: readonly string[]): Promise<string[]> {
  const eslint = new ESLint({ cwd: projectDir, overrideConfigFile: true, overrideConfig: [{ ignores: [...ignores] }], errorOnUnmatchedPattern: false })
  const results = await eslint.lintFiles([EVERYTHING])
  return results.map(({ filePath }) => relative(projectDir, filePath).split(sep).join(GLOB_SEPARATOR))
}
