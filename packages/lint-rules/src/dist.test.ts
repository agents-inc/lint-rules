import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire, isBuiltin } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { PARALLEL_LOAD_TIMEOUT_MS } from './__tests__/parallel-load.ts'

// Reads the build output, so `turbo test` builds this package first (see turbo.json).
const PACKAGE_DIR = fileURLToPath(new URL('..', import.meta.url))
const DIST_DIR = join(PACKAGE_DIR, 'dist')
const ENTRY_FILES = ['eslint.d.mts', 'eslint.mjs', 'index.d.mts', 'index.mjs', 'oxlint.d.mts', 'oxlint.mjs']
const BUILT_MODULE = /\.(?:mjs|d\.mts)$/u
const DECLARATION_FILE = /\.d\.mts$/u
const PRIVATE_WORKSPACE_SCOPE = '@workspace/'
// The internal lookup `check` will use: no consumer may reach it (spec §6).
const INTERNAL_HOOK = 'agentSettingsOf'
// Owner, 2026-10-11: the merge functions, one per engine subpath, beside defineLintRules.
const PUBLIC_ENTRIES = [
  { entry: 'index.mjs', declarations: 'index.d.mts', exported: 'defineLintRules' },
  { entry: 'eslint.mjs', declarations: 'eslint.d.mts', exported: 'mergeEslintConfig' },
  { entry: 'oxlint.mjs', declarations: 'oxlint.d.mts', exported: 'mergeOxlintConfig' },
]
const PUBLIC_SUBPATHS = ['.', './eslint', './oxlint']
// A message of the TypeScript compiler's own, in the module `typescript` resolves to: inlined, the
// compiler would carry it into the build.
const TYPESCRIPT_COMPILER = createRequire(import.meta.url).resolve('typescript')
const TYPESCRIPT_COMPILER_TEXT = "Cannot find name '{0}'."

type PackageManifest = {
  dependencies: Readonly<Record<string, string>>
  peerDependencies: Readonly<Record<string, string>>
  exports: Readonly<Record<string, unknown>>
}

function readManifest(): PackageManifest {
  return JSON.parse(readFileSync(join(PACKAGE_DIR, 'package.json'), 'utf8')) as PackageManifest
}

function builtModules(): string[] {
  return readdirSync(DIST_DIR)
    .filter((file) => BUILT_MODULE.test(file))
    .sort()
}

function readBuilt(file: string): string {
  return readFileSync(join(DIST_DIR, file), 'utf8')
}

/** The names a built entry exports at runtime, sorted. */
async function runtimeExportsOf(entry: string): Promise<string[]> {
  const loaded: Readonly<Record<string, unknown>> = await import(pathToFileURL(join(DIST_DIR, entry)).href)
  return Object.keys(loaded).toSorted()
}

// TypeScript's own scan of a module's imports, re-exports and dynamic imports.
function specifiersImportedBy(file: string): string[] {
  return ts.preProcessFile(readBuilt(file), true, true).importedFiles.map((imported) => imported.fileName)
}

function isBarePackageImport(specifier: string): boolean {
  return !specifier.startsWith('.') && !specifier.startsWith('/') && !isBuiltin(specifier)
}

function isDeclaredIn(declared: readonly string[], specifier: string): boolean {
  return declared.some((name) => specifier === name || specifier.startsWith(`${name}/`))
}

describe('the import check', () => {
  it('counts a package import as bare, and a relative path or a Node builtin as not', () => {
    expect(['eslint', '@eslint/compat', './chunk.mjs', '/abs/x.mjs', 'node:fs', 'fs'].filter(isBarePackageImport)).toStrictEqual([
      'eslint',
      '@eslint/compat',
    ])
  })

  it('counts a package or one of its subpaths as declared, and a lookalike name as not', () => {
    const declared = ['eslint', '@eslint/compat']

    expect(
      ['eslint', 'eslint/use-at-your-own-risk', '@eslint/compat', 'eslint-plugin-x', '@eslint/js'].filter((specifier) =>
        isDeclaredIn(declared, specifier),
      ),
    ).toStrictEqual(['eslint', 'eslint/use-at-your-own-risk', '@eslint/compat'])
  })
})

describe('the built package', () => {
  it('has an ES module and its declarations for each entry point', () => {
    expect(ENTRY_FILES.filter((file) => !existsSync(join(DIST_DIR, file)))).toStrictEqual([])
  })

  it('inlines every private @workspace package rather than importing it', () => {
    const modules = builtModules()

    expect(modules).toEqual(expect.arrayContaining(ENTRY_FILES))
    expect(modules.filter((file) => readBuilt(file).includes(PRIVATE_WORKSPACE_SCOPE))).toStrictEqual([])
  })

  it('imports only packages its manifest declares as dependencies or peer dependencies', () => {
    const { dependencies, peerDependencies } = readManifest()
    const declared = [...Object.keys(dependencies), ...Object.keys(peerDependencies)]
    const modules = builtModules()
    const undeclaredImports = modules.flatMap((file) =>
      specifiersImportedBy(file)
        .filter((specifier) => isBarePackageImport(specifier) && !isDeclaredIn(declared, specifier))
        .map((specifier) => `${file}: ${specifier}`),
    )

    expect(modules).toEqual(expect.arrayContaining(ENTRY_FILES))
    expect(undeclaredImports).toStrictEqual([])
  })
})

describe('the public surface of the built package', () => {
  it('lists only the three entry points in its package.json exports: no subpath reaches the internal hook', () => {
    expect(Object.keys(readManifest().exports)).toStrictEqual(PUBLIC_SUBPATHS)
  })

  // Importing eslint.mjs loads every ESLint plugin.
  it.each(PUBLIC_ENTRIES)('exports from $entry only $exported', { timeout: PARALLEL_LOAD_TIMEOUT_MS }, async ({ entry, exported }) => {
    expect(await runtimeExportsOf(entry)).toStrictEqual([exported])
  })

  it("names the internal hook in no declaration file, while each entry's declarations name its public function", () => {
    const declarations = builtModules().filter((file) => DECLARATION_FILE.test(file))

    expect({
      namingTheHook: declarations.filter((file) => readBuilt(file).includes(INTERNAL_HOOK)),
      namingTheirFunction: PUBLIC_ENTRIES.filter(({ declarations: file, exported }) => readBuilt(file).includes(exported)).map(
        ({ entry }) => entry,
      ),
    }).toStrictEqual({ namingTheHook: [], namingTheirFunction: PUBLIC_ENTRIES.map(({ entry }) => entry) })
  })
})

// Spec C3: the computation of the TS files outside every tsconfig uses the TypeScript typescript-eslint
// resolves, the consumer's own, which the package declares as a peer and never ships.
describe('TypeScript, in the built package', () => {
  it("is never inlined: its compiler's text is in the TypeScript it resolves and in no built module", () => {
    expect({
      inTheCompiler: readFileSync(TYPESCRIPT_COMPILER, 'utf8').includes(TYPESCRIPT_COMPILER_TEXT),
      inBuiltModules: builtModules().filter((file) => readBuilt(file).includes(TYPESCRIPT_COMPILER_TEXT)),
    }).toStrictEqual({ inTheCompiler: true, inBuiltModules: [] })
  })
})
