import { doesNearestPackageJsonList } from './package-json-files.ts'

const OXLINT = 'oxlint'

/** Reads only the nearest package.json's `dependencies` and `devDependencies`, never node_modules: this package brings its own oxlint for sub-agents, so oxlint resolving says nothing about the team using it. */
export function doesProjectUseOxlint(tsconfigRootDir: string): boolean {
  return doesNearestPackageJsonList(tsconfigRootDir, OXLINT)
}
