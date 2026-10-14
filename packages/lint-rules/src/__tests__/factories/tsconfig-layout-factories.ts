import type { ProjectFiles } from '../temp-projects.ts'
import { buildTsconfig } from './tsconfig-factories.ts'

/** A tsconfig.json or jsconfig.json, with the keys that decide which files its project takes in. */
export type ConfigFile = {
  readonly extends?: string
  readonly compilerOptions?: Readonly<Record<string, unknown>>
  readonly include?: readonly string[]
  readonly exclude?: readonly string[]
  readonly files?: readonly string[]
  readonly references?: readonly { readonly path: string }[]
}

/** A TS module that imports nothing. */
const STANDALONE_SOURCE = 'export const value = 1\n'

/** The text of a config file, with a consumer's compiler options unless given. */
export function configFileText(fields: ConfigFile = {}): string {
  return `${JSON.stringify({ compilerOptions: buildTsconfig().compilerOptions, ...fields }, null, 2)}\n`
}

/** A standalone TS module at each path given. */
export function standaloneSources(paths: readonly string[]): ProjectFiles {
  return Object.fromEntries(paths.map((path) => [path, STANDALONE_SOURCE]))
}

/** A TS module importing the module at `imported`, a path relative to it written with its extension. */
export function sourceImporting(imported: string): string {
  return `import { value } from '${imported}'\nexport const doubled = value * 2\n`
}
