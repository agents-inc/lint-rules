import { dirname } from 'node:path'
import type { FileTest } from './eslint-file-types.ts'
import { doesNearestPackageJsonList } from './package-json-files.ts'
import { readOnce } from './read-once.ts'

const NEXT = 'next'

/** By absolute path, each folder answered as first asked: whether the file's own nearest package.json lists next. */
export function nextJsAppFileTest(): FileTest {
  const answers = new Map<string, boolean>()
  return (file) => readOnce(answers, dirname(file), isFolderInANextJsApp)
}

function isFolderInANextJsApp(folder: string): boolean {
  return doesNearestPackageJsonList(folder, NEXT)
}
