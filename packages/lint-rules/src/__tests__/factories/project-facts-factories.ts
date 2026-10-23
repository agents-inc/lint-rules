import type { FileTest } from '../../core/eslint-file-types.ts'
import type { ProjectFacts } from '../../core/project-facts.ts'

const PATH_SEPARATOR = '/'

/**
* No TS file outside every tsconfig and no tsconfig.json or jsconfig.json, unless given: a spec names only the
* facts its assertion depends on.
*/
export function buildProjectFacts(fields: Partial<ProjectFacts> = {}): ProjectFacts {
  return { isOutsideEveryTsconfig: isOutsideNoTsconfig, tsconfigFiles: [], ...fields }
}

function isOutsideNoTsconfig(): boolean {
  return false
}

/** ESLint asks by absolute path, from a folder the spec leaves to the oracle: a path ending in one of those given. */
export function outsideEveryTsconfigAmong(files: readonly string[]): FileTest {
  return (file) => files.some((relativePath) => file.endsWith(`${PATH_SEPARATOR}${relativePath}`))
}
