import { configFileText, sourceImporting, standaloneSources } from '../factories/tsconfig-layout-factories.ts'
import type { ProjectFiles } from '../temp-projects.ts'

/**
 * A project's files, the directory the consumer gives as tsconfigRootDir (relative to the project),
 * and the TS files under it that no tsconfig takes in: the ones typescript-eslint's project service
 * finds no project for (TypeScript 5.7 and later, which search every ancestor config).
 */
export type TsconfigLayout = {
  readonly shape: string
  readonly files: ProjectFiles
  readonly tsconfigRootDir: string
  readonly outside: readonly string[]
  /** Whether a tsconfig takes in a TS file written at tsconfigRootDir itself, as a consumer's config files are. */
  readonly takesInTsFilesAtTsconfigRootDir: boolean
}

const PROJECT_ROOT = '.'

/** One layout per way a TS file comes to be in a tsconfig's project, or not (spec C3, R2). */
export const TSCONFIG_LAYOUTS: readonly TsconfigLayout[] = [
  {
    shape: 'a tsconfig.json including one directory, every TS extension on both sides of it',
    files: {
      'tsconfig.json': configFileText({ include: ['src'] }),
      ...standaloneSources(['src/a.ts', 'src/deep/b.tsx', 'src/c.mts', 'src/d.cts', 'src/e.d.ts']),
      ...standaloneSources(['scripts/f.ts', 'scripts/g.tsx', 'scripts/h.mts', 'scripts/i.cts', 'scripts/j.d.ts', 'k.ts']),
    },
    tsconfigRootDir: PROJECT_ROOT,
    outside: ['k.ts', 'scripts/f.ts', 'scripts/g.tsx', 'scripts/h.mts', 'scripts/i.cts', 'scripts/j.d.ts'],
    takesInTsFilesAtTsconfigRootDir: false,
  },
  {
    shape: 'no config file anywhere',
    files: standaloneSources(['a.ts', 'src/b.ts']),
    tsconfigRootDir: PROJECT_ROOT,
    outside: ['a.ts', 'src/b.ts'],
    takesInTsFilesAtTsconfigRootDir: false,
  },
  {
    shape: 'a jsconfig.json alone, including one directory',
    files: { 'jsconfig.json': configFileText({ include: ['src'] }), ...standaloneSources(['src/a.ts', 'scripts/b.ts']) },
    tsconfigRootDir: PROJECT_ROOT,
    outside: ['scripts/b.ts'],
    takesInTsFilesAtTsconfigRootDir: false,
  },
  {
    shape: 'a tsconfig.json beside a jsconfig.json, each including another directory: both count',
    files: {
      'tsconfig.json': configFileText({ include: ['src'] }),
      'jsconfig.json': configFileText({ include: ['lib'] }),
      ...standaloneSources(['src/a.ts', 'lib/b.ts', 'other/c.ts']),
    },
    tsconfigRootDir: PROJECT_ROOT,
    outside: ['other/c.ts'],
    takesInTsFilesAtTsconfigRootDir: false,
  },
  {
    shape: 'a solution-style tsconfig.json referencing the config that includes the file',
    files: {
      'tsconfig.json': configFileText({ files: [], references: [{ path: './tsconfig.app.json' }] }),
      'tsconfig.app.json': configFileText({ compilerOptions: appCompilerOptions(), include: ['src'] }),
      ...standaloneSources(['src/a.ts', 'scripts/b.ts']),
    },
    tsconfigRootDir: PROJECT_ROOT,
    outside: ['scripts/b.ts'],
    takesInTsFilesAtTsconfigRootDir: false,
  },
  {
    shape: 'references followed transitively, through a config that includes nothing itself',
    files: {
      'tsconfig.json': configFileText({ files: [], references: [{ path: './tsconfig.mid.json' }] }),
      'tsconfig.mid.json': configFileText({ compilerOptions: appCompilerOptions(), files: [], references: [{ path: './tsconfig.leaf.json' }] }),
      'tsconfig.leaf.json': configFileText({ compilerOptions: appCompilerOptions(), include: ['src'] }),
      ...standaloneSources(['src/a.ts', 'scripts/b.ts']),
    },
    tsconfigRootDir: PROJECT_ROOT,
    outside: ['scripts/b.ts'],
    takesInTsFilesAtTsconfigRootDir: false,
  },
  {
    shape: 'references left unloaded by disableReferencedProjectLoad',
    files: {
      'tsconfig.json': configFileText({
        compilerOptions: { disableReferencedProjectLoad: true },
        files: [],
        references: [{ path: './tsconfig.app.json' }],
      }),
      'tsconfig.app.json': configFileText({ compilerOptions: appCompilerOptions(), include: ['src'] }),
      ...standaloneSources(['src/a.ts', 'scripts/b.ts']),
    },
    tsconfigRootDir: PROJECT_ROOT,
    outside: ['scripts/b.ts', 'src/a.ts'],
    takesInTsFilesAtTsconfigRootDir: false,
  },
  {
    shape: "a nested tsconfig.json leaving out a file its ancestor's includes",
    files: {
      'tsconfig.json': configFileText({ exclude: ['generated'] }),
      'packages/app/tsconfig.json': configFileText({ include: ['src'] }),
      ...standaloneSources(['packages/app/src/a.ts', 'packages/app/scripts/b.ts', 'generated/c.ts']),
    },
    tsconfigRootDir: PROJECT_ROOT,
    outside: ['generated/c.ts'],
    takesInTsFilesAtTsconfigRootDir: true,
  },
  {
    shape: 'a nested tsconfig.json leaving out a file no ancestor includes either',
    files: {
      'tsconfig.json': configFileText({ include: ['src'] }),
      'packages/app/tsconfig.json': configFileText({ include: ['src'] }),
      ...standaloneSources(['packages/app/src/a.ts', 'packages/app/scripts/b.ts']),
    },
    tsconfigRootDir: PROJECT_ROOT,
    outside: ['packages/app/scripts/b.ts'],
    takesInTsFilesAtTsconfigRootDir: false,
  },
  {
    shape: 'a tsconfig.json above tsconfigRootDir, which the search never reaches',
    files: { 'tsconfig.json': configFileText(), ...standaloneSources(['packages/app/a.ts', 'packages/app/src/b.ts']) },
    tsconfigRootDir: 'packages/app',
    outside: ['a.ts', 'src/b.ts'],
    takesInTsFilesAtTsconfigRootDir: false,
  },
  {
    shape: 'a tsconfig.json extending a config whose include, read from its own directory, decides',
    files: {
      'tsconfig.json': configFileText({ extends: './configs/base.json' }),
      'configs/base.json': configFileText({ include: ['../src'] }),
      ...standaloneSources(['src/a.ts', 'scripts/b.ts']),
    },
    tsconfigRootDir: PROJECT_ROOT,
    outside: ['scripts/b.ts'],
    takesInTsFilesAtTsconfigRootDir: false,
  },
  {
    shape: 'a tsconfig.json listing its files one by one',
    files: { 'tsconfig.json': configFileText({ files: ['scripts/one.ts'] }), ...standaloneSources(['scripts/one.ts', 'scripts/two.ts']) },
    tsconfigRootDir: PROJECT_ROOT,
    outside: ['scripts/two.ts'],
    takesInTsFilesAtTsconfigRootDir: false,
  },
  {
    shape: 'a tsconfig.json excluding a directory inside the one it includes',
    files: {
      'tsconfig.json': configFileText({ include: ['src'], exclude: ['src/generated'] }),
      ...standaloneSources(['src/a.ts', 'src/generated/b.ts']),
    },
    tsconfigRootDir: PROJECT_ROOT,
    outside: ['src/generated/b.ts'],
    takesInTsFilesAtTsconfigRootDir: false,
  },
  {
    shape: 'a tsconfig.json in a sibling directory including the file, which the search never visits',
    files: {
      'packages/a/tsconfig.json': configFileText({ include: ['**/*', '../b/**/*'] }),
      ...standaloneSources(['packages/a/x.ts', 'packages/b/y.ts']),
    },
    tsconfigRootDir: PROJECT_ROOT,
    outside: ['packages/b/y.ts'],
    takesInTsFilesAtTsconfigRootDir: false,
  },
  {
    shape: 'directories named with glob syntax, inside and outside the tsconfig',
    files: {
      'tsconfig.json': configFileText({ include: ['src'] }),
      ...standaloneSources(['src/[slug]/a.ts', 'app/[id]/(group)/page.ts', 'app/+(x)/b.ts']),
    },
    tsconfigRootDir: PROJECT_ROOT,
    outside: ['app/+(x)/b.ts', 'app/[id]/(group)/page.ts'],
    takesInTsFilesAtTsconfigRootDir: false,
  },
  {
    shape: 'TS files under node_modules and .git, which are never listed',
    files: {
      'tsconfig.json': configFileText({ include: ['src'] }),
      ...standaloneSources(['src/a.ts', 'scripts/b.ts', 'node_modules/pkg/index.ts', '.git/hooks/c.ts', 'src/node_modules/d.ts']),
    },
    tsconfigRootDir: PROJECT_ROOT,
    outside: ['scripts/b.ts'],
    takesInTsFilesAtTsconfigRootDir: false,
  },
]

/**
 * D-h: a TS file no tsconfig lists, imported by one a tsconfig does. The project service finds it
 * through the importer's program; the computation reads only what each config lists, so the file
 * loses typed rules. Matching the service would need a full program (about 1.5 s on this repo, R2).
 */
export const IMPORTED_ONLY_LAYOUT = {
  files: {
    'tsconfig.json': configFileText({ include: ['src'] }),
    'src/a.ts': sourceImporting('../lib/helper.ts'),
    ...standaloneSources(['lib/helper.ts', 'scripts/b.ts']),
  },
  tsconfigRootDir: PROJECT_ROOT,
  importedOnly: 'lib/helper.ts',
  outsideForBoth: ['scripts/b.ts'],
} as const

/** A referenced project's options: TypeScript asks a referenced project to be composite. */
function appCompilerOptions(): Readonly<Record<string, unknown>> {
  return { composite: true, noEmit: false, emitDeclarationOnly: true, declaration: true }
}
