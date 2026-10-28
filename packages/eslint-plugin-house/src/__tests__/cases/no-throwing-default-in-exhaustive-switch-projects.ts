type ProjectOnDisk = {
  // Each file's text, by its path from the project's folder.
  readonly files: Readonly<Record<string, string>>
  // The folder of the tsconfig the program is built from, from the project's folder.
  readonly configFolder: string
  // The file the rule lints, from the project's folder.
  readonly linted: string
}

const COMPILER_OPTIONS = '"target": "ES2022", "module": "ESNext", "moduleResolution": "bundler", "strict": true, "skipLibCheck": true'

const ENGINE_DECLARATIONS = `export type Engine = 'eslint' | 'oxlint'
export declare function readEngine(): Engine
`

const DUPLICATED_PACKAGE_MANIFEST = '{ "name": "dup", "version": "1.0.0", "types": "index.d.ts" }'

// One version of `dup` installed twice: TypeScript reads one copy and holds a redirect to it for the other.
export const projectHoldingAPackageInstalledTwice: ProjectOnDisk = {
  files: {
    'tsconfig.json': `{ "compilerOptions": { ${COMPILER_OPTIONS}, "noEmit": true }, "include": ["src"] }`,
    'node_modules/pkg-a/package.json': '{ "name": "pkg-a", "version": "1.0.0", "types": "index.d.ts" }',
    'node_modules/pkg-a/index.d.ts': "export { type Engine, readEngine } from 'dup'\n",
    'node_modules/pkg-a/node_modules/dup/package.json': DUPLICATED_PACKAGE_MANIFEST,
    'node_modules/pkg-a/node_modules/dup/index.d.ts': ENGINE_DECLARATIONS,
    'node_modules/pkg-b/package.json': '{ "name": "pkg-b", "version": "1.0.0", "types": "index.d.ts" }',
    'node_modules/pkg-b/index.d.ts': "export { type Engine, readEngine } from 'dup'\n",
    'node_modules/pkg-b/node_modules/dup/package.json': DUPLICATED_PACKAGE_MANIFEST,
    'node_modules/pkg-b/node_modules/dup/index.d.ts': ENGINE_DECLARATIONS,
    'src/bin.ts': `import { readEngine } from 'pkg-a'
import { type Engine } from 'pkg-b'

export function binOf(fallback: Engine): string {
  switch (readEngine()) {
    case 'eslint':
      return fallback
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`,
  },
  configFolder: '.',
  linted: 'src/bin.ts',
}

// A composite project importing the source of the one it references, built: TypeScript reads the built declarations.
export const projectReferencingABuiltProject: ProjectOnDisk = {
  files: {
    'lib/tsconfig.json': `{ "compilerOptions": { ${COMPILER_OPTIONS}, "composite": true, "rootDir": "src", "outDir": "dist" }, "include": ["src"] }`,
    'lib/src/engine.ts': `export type Engine = 'eslint' | 'oxlint'

export function readEngine(): Engine {
  return 'eslint'
}
`,
    'lib/dist/engine.d.ts': ENGINE_DECLARATIONS,
    'app/tsconfig.json': `{ "compilerOptions": { ${COMPILER_OPTIONS}, "composite": true, "rootDir": "src", "outDir": "dist" }, "include": ["src"], "references": [{ "path": "../lib" }] }`,
    'app/src/bin.ts': `import { readEngine } from '../../lib/src/engine'

export function binOf(): string {
  switch (readEngine()) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`,
  },
  configFolder: 'app',
  linted: 'app/src/bin.ts',
}
