import type { ProjectFacts } from '../../core/project-facts.ts'

/**
 * What the walk of tsconfigRootDir reads, for a builder's spec: no TS file outside every tsconfig,
 * no tsconfig.json or jsconfig.json, and no React installed, unless given (spec-core.md C12). A new
 * fact the builders take is added here, so a spec names only the facts its assertion depends on.
 */
export function buildProjectFacts(fields: Partial<ProjectFacts> = {}): ProjectFacts {
  return { tsFilesOutsideEveryTsconfig: [], tsconfigFiles: [], reactIsInstalled: false, ...fields }
}
