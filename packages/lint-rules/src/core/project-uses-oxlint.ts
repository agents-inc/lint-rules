import { listsPackage, nearestPackageJsonPath, readPackageJsonFile } from './package-json-files.ts'

const OXLINT = 'oxlint'

/** Reads only the nearest package.json's `dependencies` and `devDependencies`, never node_modules: this package brings its own oxlint for sub-agents, so oxlint resolving says nothing about the team using it. */
export function projectUsesOxlint(tsconfigRootDir: string): boolean {
  const nearest = nearestPackageJsonPath(tsconfigRootDir)
  return nearest !== undefined && listsOxlint(nearest)
}

function listsOxlint(path: string): boolean {
  const { dependencies, devDependencies } = readPackageJsonFile(path)
  return listsPackage(dependencies, OXLINT) || listsPackage(devDependencies, OXLINT)
}
