import { dirname } from 'node:path'
import type { FileTest } from './eslint-file-types.ts'
import { listsPackage, nearestPackageJsonPath, readPackageJsonFile } from './package-json-files.ts'
import { readOnce } from './read-once.ts'

const NEXT = 'next'

/** By absolute path, each folder answered as first asked: whether the file's own nearest package.json lists next. Reads manifests alone, never node_modules, as doesProjectUseOxlint does. */
export function nextJsAppFileTest(): FileTest {
  const answers = new Map<string, boolean>()
  return (file) => readOnce(answers, dirname(file), isFolderInANextJsApp)
}

function isFolderInANextJsApp(folder: string): boolean {
  const nearest = nearestPackageJsonPath(folder)
  return nearest !== undefined && listsNext(nearest)
}

function listsNext(path: string): boolean {
  const { dependencies, devDependencies } = readPackageJsonFile(path)
  return listsPackage(dependencies, NEXT) || listsPackage(devDependencies, NEXT)
}
