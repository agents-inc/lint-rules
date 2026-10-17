import type { ProjectFacts } from '../../core/project-facts.ts'

/**
* No TS file outside every tsconfig, no tsconfig.json or jsconfig.json, and no React installed, unless given: a
* spec names only the facts its assertion depends on.
*/
export function buildProjectFacts(fields: Partial<ProjectFacts> = {}): ProjectFacts {
  return { tsFilesOutsideEveryTsconfig: [], tsconfigFiles: [], reactIsInstalled: false, ...fields }
}
