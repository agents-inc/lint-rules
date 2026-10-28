import type { ProjectFiles } from '../temp-projects.ts'

// Each package in its own folder under packages/, published under the repo's scope.

const PACKAGES_DIR = 'packages'
const REPO_SCOPE = '@repo'
const UNRELEASED = '0.0.0'
const PUBLISHED_SOURCE = ['src']

export type PublishedPackageJson = { readonly name: string; readonly version: string; readonly files: readonly string[] }

export function packageDirOf(packageName: string): string {
  return `${PACKAGES_DIR}/${packageName}`
}

export function fileInPackage(packageName: string, file: string): string {
  return `${packageDirOf(packageName)}/${file}`
}

/** Paths given in the package, returned from the monorepo's root. */
export function filesUnderPackage(packageName: string, files: ProjectFiles): Array<[string, string]> {
  return Object.entries(files).map(([file, text]) => [fileInPackage(packageName, file), text])
}

/** Publishing src unless given. */
export function buildPublishedPackageJson(packageName: string, files: readonly string[] = PUBLISHED_SOURCE): PublishedPackageJson {
  return { name: `${REPO_SCOPE}/${packageName}`, version: UNRELEASED, files }
}
