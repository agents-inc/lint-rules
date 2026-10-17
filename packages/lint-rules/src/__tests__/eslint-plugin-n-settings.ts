import { isRecord } from '../core/is-record.ts'

// eslint-plugin-n 18.4.1 reads the extensions it tries from a rule's options, then from
// settings.n, then from settings.node, each only where it holds a `tryExtensions` array
// (lib/util/get-try-extensions.js, getTryExtensions).
const SETTINGS_KEYS_IN_THE_ORDER_READ = ['n', 'node'] as const
const TRY_EXTENSIONS = 'tryExtensions'

// It reads typescriptExtensionMap and tsconfigPath otherwise: from settings.n wherever settings.n is
// set at all, whatever keys it holds, and from settings.node only where it is not
// (lib/util/get-typescript-extension-map.js, getTypescriptExtensionMap: `settings.n ?? settings.node`).
const SETTINGS_READ_AS_ONE_OBJECT = ['typescriptExtensionMap', 'tsconfigPath'] as const
const [N_SETTINGS_KEY, LEGACY_SETTINGS_KEY] = SETTINGS_KEYS_IN_THE_ORDER_READ

/** The first `tryExtensions` array of settings.n and settings.node; undefined where neither holds one. */
export function tryExtensionsEslintPluginNReads(settings: unknown): string[] | undefined {
  if (!isRecord(settings)) return undefined
  return SETTINGS_KEYS_IN_THE_ORDER_READ.map((key) => tryExtensionsIn(settings[key])).find((extensions) => extensions !== undefined)
}

/** From settings.n where it is set, else settings.node. */
export function typescriptSettingsEslintPluginNReads(settings: unknown): Readonly<Record<string, unknown>> {
  if (!isRecord(settings)) return {}
  const readFrom = settingsReadAsOneObjectIn(settings)
  if (!isRecord(readFrom)) return {}
  return Object.fromEntries(SETTINGS_READ_AS_ONE_OBJECT.flatMap((key) => (readFrom[key] === undefined ? [] : [[key, readFrom[key]]])))
}

/** settings.n where it is neither undefined nor null, as `??` reads it, else settings.node. */
function settingsReadAsOneObjectIn(settings: Readonly<Record<string, unknown>>): unknown {
  const nSettings = settings[N_SETTINGS_KEY]
  return nSettings === undefined || nSettings === null ? settings[LEGACY_SETTINGS_KEY] : nSettings
}

function tryExtensionsIn(pluginSettings: unknown): string[] | undefined {
  if (!isRecord(pluginSettings)) return undefined
  const extensions = pluginSettings[TRY_EXTENSIONS]
  return Array.isArray(extensions) ? extensions.map(String) : undefined
}
