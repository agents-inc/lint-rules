import type { ProjectFiles } from '../temp-projects.ts'
import { buildTsconfig } from './tsconfig-factories.ts'

/** A tsconfig.json or jsconfig.json, with the keys that decide which files its project takes in. */
export type ConfigFile = {
  readonly extends?: string
  readonly compilerOptions?: Readonly<Record<string, unknown>>
  readonly include?: readonly string[]
  readonly exclude?: readonly string[]
  readonly files?: readonly string[]
  readonly references?: ReadonlyArray<{ readonly path: string }>
}

const STANDALONE_SOURCE = 'export const value = 1\n'

/** With a consumer's compiler options unless given. */
export function configFileText(fields: ConfigFile = {}): string {
  return `${JSON.stringify({ compilerOptions: buildTsconfig().compilerOptions, ...fields }, null, 2)}\n`
}

export function standaloneSources(paths: readonly string[]): ProjectFiles {
  return Object.fromEntries(paths.map((path) => [path, STANDALONE_SOURCE]))
}

/** `imported` is relative, written with its extension. */
export function sourceImporting(imported: string): string {
  return `import { value } from '${imported}'\nexport const doubled = value * 2\n`
}

/** An ES module requiring the module at `required` through createRequire: TypeScript reads no import there. */
export function esModuleRequiring(required: string): string {
  return `import { createRequire } from 'node:module'\nconst require = createRequire(import.meta.url)\nexport const loaded: unknown = require('${required}')\n`
}

/** A JavaScript module requiring the module at `required`: TypeScript reads an import there, in a JavaScript file. */
export function javaScriptRequiring(required: string): string {
  return `const loaded = require('${required}')\nexport default [loaded]\n`
}
