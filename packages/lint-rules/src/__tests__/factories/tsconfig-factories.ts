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

/** A tsconfig.json extending shared configs, by one path or several (TypeScript 5.0+). */
type TsconfigExtending = Partial<Tsconfig> & { readonly extends: string | readonly string[] }

export function buildTsconfig(fields: Partial<Tsconfig> = {}): Tsconfig {
  return { compilerOptions: CONSUMER_COMPILER_OPTIONS, ...fields }
}

/** A tsconfig.json as a monorepo package writes it: `extends` first, then the keys given, with no compiler options unless given. */
export function buildTsconfigExtending(extended: TsconfigExtending['extends'], fields: Partial<Tsconfig> = {}): TsconfigExtending {
  return { extends: extended, ...fields }
}

/** A consumer's tsconfig.json that also compiles JSX, as a React project's does. */
export function buildReactTsconfig(fields: Partial<Omit<Tsconfig, 'compilerOptions'>> = {}): Tsconfig {
  return { compilerOptions: { ...CONSUMER_COMPILER_OPTIONS, jsx: 'react-jsx' }, ...fields }
}
