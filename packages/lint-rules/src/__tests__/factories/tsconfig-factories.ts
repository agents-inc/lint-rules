/** A consumer's tsconfig.json. With `include` left out, TypeScript takes every TS file beside and below it. */
export type Tsconfig = {
  readonly compilerOptions: Readonly<Record<string, unknown>>
  readonly include?: readonly string[]
  readonly exclude?: readonly string[]
}

// As a consumer on Node 22.18+ writes it: the config files import each other with their extensions.
const CONSUMER_COMPILER_OPTIONS = {
  target: 'ES2022',
  module: 'nodenext',
  moduleResolution: 'nodenext',
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  allowImportingTsExtensions: true,
}

/** TypeScript 6 loads Node's types only where a tsconfig lists them: `import.meta.dirname` is otherwise an error type. */
export function buildTsconfigListingNodeTypes(fields: Partial<Omit<Tsconfig, 'compilerOptions'>> = {}): Tsconfig {
  return { compilerOptions: { ...CONSUMER_COMPILER_OPTIONS, types: ['node'] }, ...fields }
}

// As a monorepo package built by a bundler writes it: imports name no extension.
const BUNDLER_COMPILER_OPTIONS = { target: 'ES2022', module: 'esnext', moduleResolution: 'bundler', strict: true, noEmit: true, skipLibCheck: true }

/** The compiler options given go after the bundler's; folders: src unless given. */
export function buildBundlerTsconfig(compilerOptions: Readonly<Record<string, unknown>> = {}, include: readonly string[] = ['src']): Tsconfig {
  return buildTsconfig({ compilerOptions: { ...BUNDLER_COMPILER_OPTIONS, ...compilerOptions }, include })
}

/** A tsconfig.json extending shared configs, by one path or several (TypeScript 5.0+). */
type TsconfigExtending = Partial<Tsconfig> & { readonly extends: string | readonly string[] }

export function buildTsconfig(fields: Partial<Tsconfig> = {}): Tsconfig {
  return { compilerOptions: CONSUMER_COMPILER_OPTIONS, ...fields }
}

/** `extends` first, then the keys given; no compiler options unless given. */
export function buildTsconfigExtending(extended: TsconfigExtending['extends'], fields: Partial<Tsconfig> = {}): TsconfigExtending {
  return { extends: extended, ...fields }
}

export function buildReactTsconfig(fields: Partial<Omit<Tsconfig, 'compilerOptions'>> = {}): Tsconfig {
  return { compilerOptions: { ...CONSUMER_COMPILER_OPTIONS, jsx: 'react-jsx' }, ...fields }
}

/** Each target relative to the tsconfig. */
export function buildTsconfigWithPaths(paths: Readonly<Record<string, readonly string[]>>, fields: Partial<Omit<Tsconfig, 'compilerOptions'>> = {}): Tsconfig {
  return { compilerOptions: { ...CONSUMER_COMPILER_OPTIONS, paths }, ...fields }
}
