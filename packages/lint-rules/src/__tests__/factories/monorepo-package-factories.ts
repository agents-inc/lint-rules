import type { ProjectFiles } from '../temp-projects.ts'

// The packages of a monorepo, each in a folder of its own under packages/, and published under the
// repo's scope.

const PACKAGES_DIR = 'packages'
const REPO_SCOPE = '@repo'
const UNRELEASED = '0.0.0'
const PUBLISHED_SOURCE = ['src']

/** What a package.json npm may publish holds: its scoped name, its version, and the files it publishes. */
export type PublishedPackageJson = { readonly name: string; readonly version: string; readonly files: readonly string[] }

/** The package's folder, by its path from the monorepo's root. */
export function packageDirOf(packageName: string): string {
  return `${PACKAGES_DIR}/${packageName}`
}

/** A file of the package, by its path from the monorepo's root. */
export function fileInPackage(packageName: string, file: string): string {
  return `${packageDirOf(packageName)}/${file}`
}

/** The package's files, given by their paths in it, by their paths from the monorepo's root. */
export function filesUnderPackage(packageName: string, files: ProjectFiles): [string, string][] {
  return Object.entries(files).map(([file, text]) => [fileInPackage(packageName, file), text])
}

/** The package's package.json, publishing the files given: its src folder unless given. */
export function buildPublishedPackageJson(packageName: string, files: readonly string[] = PUBLISHED_SOURCE): PublishedPackageJson {
  return { name: `${REPO_SCOPE}/${packageName}`, version: UNRELEASED, files }
}
