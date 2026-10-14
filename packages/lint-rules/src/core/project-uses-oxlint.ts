import { listsPackage, nearestPackageJsonPath, readPackageJsonFile } from './package-json-files.ts'

const OXLINT = 'oxlint'

/**
 * Whether the package.json nearest to `tsconfigRootDir` lists oxlint under `dependencies` or
 * `devDependencies`, so a monorepo package whose own package.json lists none uses ESLint alone
 * (questions.md #32 D1, #40). Nothing above the nearest is read, and no package.json means no
 * oxlint. What node_modules holds is never read: this package brings an oxlint of its own for
 * sub-agents, so oxlint resolving says nothing about the team using it.
 */
export function projectUsesOxlint(tsconfigRootDir: string): boolean {
  const nearest = nearestPackageJsonPath(tsconfigRootDir)
  return nearest !== undefined && listsOxlint(nearest)
}

function listsOxlint(path: string): boolean {
  const { dependencies, devDependencies } = readPackageJsonFile(path)
  return listsPackage(dependencies, OXLINT) || listsPackage(devDependencies, OXLINT)
}
