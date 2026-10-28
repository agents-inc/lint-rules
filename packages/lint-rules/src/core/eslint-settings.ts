import type { Linter } from 'eslint'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import { JS_AND_TS_EXTENSIONS } from './eslint-file-types.ts'
import { isRecord } from './is-record.ts'
import type { ProjectFacts } from './project-facts.ts'
import { REACT_VERSION } from './react-version.ts'

type Settings = NonNullable<Linter.Config['settings']>

/** `keyWithin` names a key inside an object-valued setting. */
export type SettingPath = { readonly key: string; readonly keyWithin: string | null }

/** Where a team block gives any setting this yields to, the plugin would read ours in its place, so a merge leaves ours out of that block's files. */
export type SettingOfOurs = { readonly path: SettingPath; readonly value: unknown; readonly yieldsTo: readonly SettingPath[] }

type ImmutabilityTypeOverride = { readonly type: RegExp; readonly to: string }

// functional/prefer-immutable-types matches these as RegExps, so they must be written here, not as JSON strings.
const IMMUTABILITY_TYPE_OVERRIDES: readonly ImmutabilityTypeOverride[] = [
  { type: /^(?:React\.)?(?:ReactNode|ReactElement|ReactPortal|ReactFragment|JSX\.Element)$/u, to: 'Immutable' },
  { type: /^(?:React\.)?(?:CSSProperties|Properties(?:<.*>)?)$/u, to: 'Immutable' },
  { type: /^(?:HTML|SVG)\w*Element$/u, to: 'Immutable' },
  { type: /^(?:React\.)?(?:RefObject|MutableRefObject|Ref|ForwardedRef)<.*>$/u, to: 'Immutable' },
  { type: /^(?:React\.)?\w*(?:HTML|SVG|DOM)Attributes<.*>$/u, to: 'Immutable' },
  {
    type: /^(?:React\.)?(?:ComponentProps|ComponentPropsWithoutRef|ComponentPropsWithRef|ComponentType|FC|ElementType)<.*>$/u,
    to: 'Immutable',
  },
  { type: /^(?:StoryObj|Meta|StoryFn)<.*>$/u, to: 'Immutable' },
  { type: /^(?:RegExpMatchArray|RegExpExecArray)$/u, to: 'Immutable' },
]

// eslint-plugin-n's default try-extensions hold no TS or JSX one (18.4.1), so a tsconfig path alias to a .ts
// file resolves to nothing and n/no-unpublished-import reports it. Our extensions come first, as TypeScript
// resolves `x` to x.ts before x.json; then the rest of the plugin's default.
const N_DEFAULT_TRY_EXTENSIONS: readonly string[] = ['.js', '.json', '.node', '.mjs', '.cjs']
const EXTENSION_DOT = '.'

// eslint-plugin-n 18.4.1 reads each setting from settings.n, else settings.node, but typescriptExtensionMap
// and tsconfigPath from whichever of the two is set at all, as one object.
const ESLINT_PLUGIN_N_SETTINGS_KEY = 'n'
const ESLINT_PLUGIN_N_LEGACY_SETTINGS_KEY = 'node'
const N_SETTINGS_READ_AS_ONE_OBJECT: readonly string[] = ['typescriptExtensionMap', 'tsconfigPath']

// import-x 4.17.1 uses import-x/resolver-next wherever it holds anything, and only otherwise the older resolver keys.
const IMPORT_X_RESOLVER_NEXT = 'import-x/resolver-next'
const IMPORT_X_LEGACY_RESOLVERS: readonly string[] = ['import-x/resolver-legacy', 'import-x/resolver', 'import-x/resolve']

// import-x parses only JS for exports by default, so an import of a TS module drew no import-x/named report.
// Built from a prefix: the literal would read, to names-no-rule.test.ts, as naming the rule import-x/extensions.
const IMPORT_X_SETTINGS_PREFIX = 'import-x'
const IMPORT_X_EXTENSIONS = `${IMPORT_X_SETTINGS_PREFIX}/extensions`
const TS_AND_JS_EXTENSIONS_IMPORT_X_PARSES: readonly string[] = ['.ts', '.tsx', '.cts', '.mts', '.js', '.jsx', '.cjs', '.mjs']

/** A setting of ours under a key not here yields to none. */
const TEAM_SETTINGS_YIELDED_TO: ReadonlyMap<string, readonly SettingPath[]> = new Map([
  [IMPORT_X_RESOLVER_NEXT, [IMPORT_X_RESOLVER_NEXT, ...IMPORT_X_LEGACY_RESOLVERS].map(wholeSettingAt)],
])

export function buildEslintSettings({ tsconfigFiles }: ProjectFacts): Settings {
  return {
    [IMPORT_X_RESOLVER_NEXT]: [typeScriptResolverOf(tsconfigFiles)],
    [IMPORT_X_EXTENSIONS]: TS_AND_JS_EXTENSIONS_IMPORT_X_PARSES,
    immutability: { overrides: IMMUTABILITY_TYPE_OVERRIDES },
    [ESLINT_PLUGIN_N_SETTINGS_KEY]: { tryExtensions: nTryExtensions() },
    react: { version: REACT_VERSION },
  }
}

/** Resolves imports as TypeScript does, given every tsconfig.json and jsconfig.json of the project: one root tsconfig misses packages' aliases, and a `**` glob read tsconfigs in node_modules and crashed ESLint. */
function typeScriptResolverOf(tsconfigFiles: readonly string[]): ReturnType<typeof createTypeScriptImportResolver> {
  return createTypeScriptImportResolver({ project: [...tsconfigFiles], noWarnOnMultipleProjects: true })
}

/** Each key of ours under settings.n yields to the team's settings.n of that key and to any settings.node the plugin reads as one object with it; where the team gives one, all of our settings.n leaves its files. */
export function settingsOfOurs(settings: Readonly<Settings>): SettingOfOurs[] {
  return Object.entries(settings).flatMap(([key, value]) => settingsOfOursUnder(key, value))
}

function settingsOfOursUnder(key: string, value: unknown): SettingOfOurs[] {
  if (key === ESLINT_PLUGIN_N_SETTINGS_KEY) return eslintPluginNSettingsOfOurs(value)
  return [{ path: wholeSettingAt(key), value, yieldsTo: teamSettingsYieldedTo(key) }]
}

export function settingsGiving(settings: readonly SettingOfOurs[]): Settings {
  const keys = [...new Set(settings.map(({ path }) => path.key))]
  return Object.fromEntries(keys.map((key) => [key, valueGivenUnder(key, settings)]))
}

/** A team's eslint.config.mjs is untyped, so any key may hold anything. */
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

function valueGivenUnder(key: string, settings: readonly SettingOfOurs[]): unknown {
  const underTheKey = settings.filter(({ path }) => path.key === key)
  const whole = underTheKey.find(({ path }) => path.keyWithin === null)
  if (whole !== undefined) return whole.value
  return Object.fromEntries(underTheKey.flatMap(entryWithinTheKey))
}

/** None for a whole setting. */
function entryWithinTheKey({ path: { keyWithin }, value }: SettingOfOurs): Array<[string, unknown]> {
  return keyWithin === null ? [] : [[keyWithin, value]]
}

function wholeSettingAt(key: string): SettingPath {
  return { key, keyWithin: null }
}

function settingWithin(key: string, keyWithin: string): SettingPath {
  return { key, keyWithin }
}

/** Once each, as its schema requires. */
function nTryExtensions(): string[] {
  const ours = [...JS_AND_TS_EXTENSIONS].map((extension) => `${EXTENSION_DOT}${extension}`)
  return [...new Set([...ours, ...N_DEFAULT_TRY_EXTENSIONS])]
}
