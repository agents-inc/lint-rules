import type { Linter } from 'eslint'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import { JS_AND_TS_EXTENSIONS } from './eslint-file-types.ts'
import { isRecord } from './is-record.ts'
import type { ProjectFacts } from './project-facts.ts'

type Settings = NonNullable<Linter.Config['settings']>

/** Where a block gives a setting: under a key of its settings, or, where the value there is an object, under a key within it. */
export type SettingPath = { readonly key: string; readonly keyWithin: string | null }

/**
 * A setting of ours, and the team's settings it yields to: where a team block gives any of them, the
 * plugin would read ours in place of the team's, so a merge leaves ours out of that block's files
 * (decisions.md, 2026-10-14 "fix round 5 review"; O8).
 */
export type SettingOfOurs = { readonly path: SettingPath; readonly value: unknown; readonly yieldsTo: readonly SettingPath[] }

// functional/prefer-immutable-types reads these from settings and matches them as RegExps, which
// is why they live in this JS config: written as JSON strings they would never match. Each
// overrides the offending type rather than the declaration that mentions it (copied from the gate).
const IMMUTABILITY_TYPE_OVERRIDES = [
  { type: /^(React\.)?(ReactNode|ReactElement|ReactPortal|ReactFragment|JSX\.Element)$/u, to: 'Immutable' },
  { type: /^(React\.)?(CSSProperties|Properties(<.*>)?)$/u, to: 'Immutable' },
  { type: /^(HTML|SVG)\w*Element$/u, to: 'Immutable' },
  { type: /^(React\.)?(RefObject|MutableRefObject|Ref|ForwardedRef)<.*>$/u, to: 'Immutable' },
  { type: /^(React\.)?\w*(HTML|SVG|DOM)Attributes<.*>$/u, to: 'Immutable' },
  {
    type: /^(React\.)?(ComponentProps|ComponentPropsWithoutRef|ComponentPropsWithRef|ComponentType|FC|ElementType)<.*>$/u,
    to: 'Immutable',
  },
  { type: /^(StoryObj|Meta|StoryFn)<.*>$/u, to: 'Immutable' },
  { type: /^(RegExpMatchArray|RegExpExecArray)$/u, to: 'Immutable' },
]

// eslint-plugin-n resolves an import written without an extension by trying these in turn. Its
// default, for a JS file and for a TS file whose tsconfig does not allow importing TS extensions,
// holds no TS or JSX one (lib/util/get-try-extensions.js, 18.4.1), so a tsconfig path alias to a
// .ts or .tsx file (`@/…`) resolves to nothing. n/no-unpublished-import then measures the import
// from the folder the process runs in, and a package linted from a monorepo's root reports it
// unpublished (real run 3, case R-ALL-6). Each extension we lint comes first, as TypeScript and
// bundlers resolve `x` to x.ts before x.json; then the rest of the plugin's default.
const N_DEFAULT_TRY_EXTENSIONS = ['.js', '.json', '.node', '.mjs', '.cjs']
const EXTENSION_DOT = '.'

// eslint-plugin-n 18.4.1 reads each of its settings from settings.n, else from the older
// settings.node (lib/util/get-try-extensions.js, and every other lib/util/get-*.js reading one),
// but typescriptExtensionMap and tsconfigPath from settings.n wherever it is set at all, else from
// settings.node, as one object (lib/util/get-typescript-extension-map.js).
const ESLINT_PLUGIN_N_SETTINGS_KEY = 'n'
const ESLINT_PLUGIN_N_LEGACY_SETTINGS_KEY = 'node'
const N_SETTINGS_READ_AS_ONE_OBJECT = ['typescriptExtensionMap', 'tsconfigPath']

// import-x 4.17.1 resolves with import-x/resolver-next wherever it holds anything, and only where it
// does not with the first of the older import-x/resolver-legacy and import-x/resolver, else node's
// resolver given import-x/resolve (lib/utils/resolve.js, fullResolve).
const IMPORT_X_RESOLVER_NEXT = 'import-x/resolver-next'
const IMPORT_X_LEGACY_RESOLVERS = ['import-x/resolver-legacy', 'import-x/resolver', 'import-x/resolve']

// The files import-x parses for what a module exports: by default JS alone (import-x 4.17.1,
// lib/utils/ignore.js, getFileExtensions), so an import of a TS module drew no import-x/named report
// (#33 fix C). The key is built from import-x's settings prefix: its rule import-x/extensions has the
// same name, so a literal would read, to names-no-rule.test.ts, as the core naming a rule.
const IMPORT_X_SETTINGS_PREFIX = 'import-x'
const IMPORT_X_EXTENSIONS = `${IMPORT_X_SETTINGS_PREFIX}/extensions`
const TS_AND_JS_EXTENSIONS_IMPORT_X_PARSES = ['.ts', '.tsx', '.cts', '.mts', '.js', '.jsx', '.cjs', '.mjs']

// Without a version eslint-plugin-react warns on every run, and `detect` reads the React installed.
// Where none is, `detect` assumes this one and prints a warning saying so (ULTIMATE_LATEST_SEMVER in
// lib/util/version.js, 7.37.5, which the plugin does not export): given outright, the plugin
// behaves the same and prints nothing (spec-core.md C13).
const DETECT_THE_INSTALLED_REACT = 'detect'
const REACT_VERSION_ASSUMED_WITHOUT_REACT = '999.999.999'

/** The team's settings a setting of ours given whole under the key yields to, by that key; one under a key not here yields to none. */
const TEAM_SETTINGS_YIELDED_TO: ReadonlyMap<string, readonly SettingPath[]> = new Map([
  [IMPORT_X_RESOLVER_NEXT, [IMPORT_X_RESOLVER_NEXT, ...IMPORT_X_LEGACY_RESOLVERS].map(wholeSettingAt)],
])

/** Our settings for the project its facts describe. */
export function buildEslintSettings({ reactIsInstalled, tsconfigFiles }: ProjectFacts): Settings {
  return {
    [IMPORT_X_RESOLVER_NEXT]: [typeScriptResolverOf(tsconfigFiles)],
    [IMPORT_X_EXTENSIONS]: TS_AND_JS_EXTENSIONS_IMPORT_X_PARSES,
    immutability: { overrides: IMMUTABILITY_TYPE_OVERRIDES },
    [ESLINT_PLUGIN_N_SETTINGS_KEY]: { tryExtensions: nTryExtensions() },
    react: { version: reactIsInstalled ? DETECT_THE_INSTALLED_REACT : REACT_VERSION_ASSUMED_WITHOUT_REACT },
  }
}

/**
 * import-x resolves a module as TypeScript does with eslint-import-resolver-typescript, given every
 * tsconfig.json and jsconfig.json of the project, each file read with the one nearest it that takes
 * it in (#33 fix C; spec-core.md C1): an import without its extension, `.js` naming a `.ts` module,
 * and each package's own path aliases. Not one tsconfig for the root, which misses a package's
 * aliases, and not a `**` glob, which read tsconfigs in node_modules and crashed ESLint. Given more
 * than one, the resolver would print a warning once per process that the team cannot act on, since
 * we give it the list; that warning is off. With none, it reads the tsconfig in the process's cwd,
 * if any, and still resolves an import without its extension.
 */
function typeScriptResolverOf(tsconfigFiles: readonly string[]): ReturnType<typeof createTypeScriptImportResolver> {
  return createTypeScriptImportResolver({ project: [...tsconfigFiles], noWarnOnMultipleProjects: true })
}

/**
 * Our settings one by one, each with the team's it yields to. Each key of ours under settings.n is
 * one, yielding to the team's of that key under settings.n, and to settings.node's of any key we set
 * under settings.n or eslint-plugin-n reads as one object: where the team gives one of those, the
 * whole of our settings.n leaves its files, as any of it left there would hide the team's
 * settings.node from that reading. Each other setting is one under its key.
 */
export function settingsOfOurs(settings: Settings): SettingOfOurs[] {
  return Object.entries(settings).flatMap(([key, value]) =>
    key === ESLINT_PLUGIN_N_SETTINGS_KEY ? eslintPluginNSettingsOfOurs(value) : [{ path: wholeSettingAt(key), value, yieldsTo: teamSettingsYieldedTo(key) }],
  )
}

/** The settings given, as a block gives them: one given whole under its key, else those given within it, as one object. */
export function settingsGiving(settings: readonly SettingOfOurs[]): Settings {
  const keys = [...new Set(settings.map(({ path }) => path.key))]
  return Object.fromEntries(keys.map((key) => [key, valueGivenUnder(key, settings)]))
}

/** Whether the settings give a value at the path. A team's eslint.config.mjs is untyped, so any key of them may hold anything. */
export function givesTheSetting(settings: Readonly<Record<string, unknown>>, { key, keyWithin }: SettingPath): boolean {
  const value = settings[key]
  if (keyWithin === null) return value !== undefined
  return isRecord(value) && value[keyWithin] !== undefined
}

function eslintPluginNSettingsOfOurs(nSettings: unknown): SettingOfOurs[] {
  if (!isRecord(nSettings)) throw new Error(`our eslint-plugin-n settings under "${ESLINT_PLUGIN_N_SETTINGS_KEY}" are not an object`)
  const hidingTheTeamsLegacyObject = [...Object.keys(nSettings), ...N_SETTINGS_READ_AS_ONE_OBJECT].map((keyWithin) =>
    settingWithin(ESLINT_PLUGIN_N_LEGACY_SETTINGS_KEY, keyWithin),
  )
  return Object.entries(nSettings).map(([keyWithin, value]) => {
    const path = settingWithin(ESLINT_PLUGIN_N_SETTINGS_KEY, keyWithin)
    return { path, value, yieldsTo: [path, ...hidingTheTeamsLegacyObject] }
  })
}

function teamSettingsYieldedTo(key: string): readonly SettingPath[] {
  const yieldedTo = TEAM_SETTINGS_YIELDED_TO.get(key)
  return yieldedTo === undefined ? [] : yieldedTo
}

/** The setting given whole under the key, else the object of those given within it. */
function valueGivenUnder(key: string, settings: readonly SettingOfOurs[]): unknown {
  const underTheKey = settings.filter(({ path }) => path.key === key)
  const whole = underTheKey.find(({ path }) => path.keyWithin === null)
  if (whole !== undefined) return whole.value
  return Object.fromEntries(underTheKey.flatMap(({ path: { keyWithin }, value }) => (keyWithin === null ? [] : [[keyWithin, value]])))
}

function wholeSettingAt(key: string): SettingPath {
  return { key, keyWithin: null }
}

function settingWithin(key: string, keyWithin: string): SettingPath {
  return { key, keyWithin }
}

/** The extensions of the JS and TS files we lint, then eslint-plugin-n's other defaults: once each, as its schema requires. */
function nTryExtensions(): string[] {
  const ours = [...JS_AND_TS_EXTENSIONS].map((extension) => `${EXTENSION_DOT}${extension}`)
  return [...new Set([...ours, ...N_DEFAULT_TRY_EXTENSIONS])]
}
