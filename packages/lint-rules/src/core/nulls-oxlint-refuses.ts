import type { ExternalPluginEntry, OxlintConfig, OxlintOverride } from 'oxlint'
import { isRecord } from './is-record.ts'

// Where oxlint refuses null in a config and in each config it extends (measured, 1.87), which a config read from JSON or
// an untyped module can hold all the same. It takes null at $schema, plugins and jsPlugins, every option, an override's
// env, globals, plugins and jsPlugins, and a settings key no plugin of its reads. A rule's options and a plugin's
// settings are not walked: oxlint refuses null there for some rules and settings and takes it for others.

/** As `overrides[0].rules["no-debugger"]`, and what to write there instead. */
type NullRefused = { readonly location: string; readonly advice: string }

type Holder = Readonly<Record<string, unknown>>

type KeyOf<Holding> = keyof Holding & string

type KeyRefusingNull<Holding> = { readonly key: KeyOf<Holding>; readonly advice: string }

/** `prefix` leads to the value walked, as `overrides[0].`. */
type NullsInside = (value: unknown, prefix: string) => NullRefused[]

const AN_OBJECT = 'an object'
const AN_ARRAY = 'an array'
const A_SEVERITY = 'a severity, as "off", "warn" or "error"'
const TRUE_OR_FALSE = 'true or false'
const READONLY_WRITABLE_OR_OFF = '"readonly", "writable" or "off"'
// A rule's severity, where its entry is a list: its options follow.
const SEVERITY_SLOT = 0
const REMOVE_IT_FROM_THE_LIST = 'remove it from the list'

// In the order a refusal names them.
const KEYS_OF_A_CONFIG: ReadonlyArray<KeyRefusingNull<OxlintConfig>> = [
  { key: 'options', advice: leaveItOutOrGiveIt(AN_OBJECT) },
  { key: 'categories', advice: leaveItOutOrGiveIt(AN_OBJECT) },
  { key: 'env', advice: leaveItOutOrGiveIt(AN_OBJECT) },
  { key: 'extends', advice: leaveItOutOrGiveIt(AN_ARRAY) },
  { key: 'globals', advice: leaveItOutOrGiveIt(AN_OBJECT) },
  { key: 'ignorePatterns', advice: leaveItOutOrGiveIt(AN_ARRAY) },
  { key: 'overrides', advice: leaveItOutOrGiveIt(AN_ARRAY) },
  { key: 'rules', advice: leaveItOutOrGiveIt(AN_OBJECT) },
  { key: 'settings', advice: leaveItOutOrGiveIt(AN_OBJECT) },
]

const KEYS_OF_AN_OVERRIDE: ReadonlyArray<KeyRefusingNull<OxlintOverride>> = [
  { key: 'files', advice: 'give it an array of the globs it applies to, as oxlint requires files in an override' },
  { key: 'excludeFiles', advice: leaveItOutOrGiveIt(AN_ARRAY) },
  { key: 'rules', advice: leaveItOutOrGiveIt(AN_OBJECT) },
]

const KEYS_OF_A_JS_PLUGIN: ReadonlyArray<KeyRefusingNull<Exclude<ExternalPluginEntry, string>>> = [
  { key: 'name', advice: "give it the plugin's name, or write the entry as its specifier alone" },
  { key: 'specifier', advice: 'give it the package name or path oxlint loads the plugin from' },
]

// The settings key of each plugin of oxlint's that reads settings.
const PLUGINS_SETTINGS_KEYS: ReadonlySet<string> = new Set(['jest', 'jsdoc', 'jsx-a11y', 'next', 'react', 'vitest'])

/** What a merge refusing the config says after the file it names: the first null oxlint refuses in it or in a config it extends as an object, at any depth. */
export function nullOxlintRefusesIn(config: Readonly<OxlintConfig>): string | undefined {
  const [first] = nullsInAConfig(config, '')
  return first === undefined ? undefined : refusalOf(first)
}

function refusalOf({ location, advice }: NullRefused): string {
  return `${location} is null, which oxlint refuses: ${advice}`
}

/** `at` leads to the config, as `extends[0].`. */
function nullsInAConfig(config: unknown, at: string): NullRefused[] {
  if (!isRecord(config)) return []
  return [
    ...nullsAtItsKeys(config, KEYS_OF_A_CONFIG, at),
    ...nullEntriesIn(config, 'categories', at, leaveItOutOrGiveIt(A_SEVERITY)),
    ...nullsInWhatItStates(config, at),
    ...nullsInPluginSettings(config, at),
    ...nullsInAList(config, 'ignorePatterns', at),
    ...nullsInAList(config, 'overrides', at, nullsInAnOverride),
    ...nullsInAList(config, 'extends', at, nullsInAConfig),
  ]
}

function nullsInAnOverride(override: unknown, prefix: string): NullRefused[] {
  if (!isRecord(override)) return []
  return [
    ...nullsAtItsKeys(override, KEYS_OF_AN_OVERRIDE, prefix),
    ...nullsInAList(override, 'files', prefix),
    ...nullsInAList(override, 'excludeFiles', prefix),
    ...nullsInWhatItStates(override, prefix),
  ]
}

/** A config and an override each state these. */
function nullsInWhatItStates(holder: Holder, prefix: string): NullRefused[] {
  return [
    ...nullsInRules(holder, prefix),
    ...nullEntriesIn(holder, 'env', prefix, leaveItOutOrGiveIt(TRUE_OR_FALSE)),
    ...nullEntriesIn(holder, 'globals', prefix, leaveItOutOrGiveIt(READONLY_WRITABLE_OR_OFF)),
    ...nullsInAList(holder, 'plugins', prefix),
    ...nullsInAList(holder, 'jsPlugins', prefix, nullsInAJsPlugin),
  ]
}

/** One written as its specifier alone holds no null. */
function nullsInAJsPlugin(entry: unknown, prefix: string): NullRefused[] {
  return isRecord(entry) ? nullsAtItsKeys(entry, KEYS_OF_A_JS_PLUGIN, prefix) : []
}

function nullsAtItsKeys<Holding>(holder: Holder, keys: ReadonlyArray<KeyRefusingNull<Holding>>, prefix: string): NullRefused[] {
  return keys.flatMap(({ key, advice }) => refusedWhereNull(holder[key], `${prefix}${key}`, advice))
}

function nullsInRules(holder: Holder, prefix: string): NullRefused[] {
  const rules = `${prefix}rules`
  return entriesOf(holder.rules).flatMap(([ruleKey, entry]) => nullsInARuleEntry(entry, entryIn(rules, ruleKey)))
}

function nullsInARuleEntry(entry: unknown, location: string): NullRefused[] {
  const atTheRule = refusedWhereNull(entry, location, leaveItOutOrGiveIt(A_SEVERITY))
  const atItsListedSeverity = refusedWhereNull(severityListedIn(entry), slotIn(location, SEVERITY_SLOT), `give it ${A_SEVERITY}`)
  return [...atTheRule, ...atItsListedSeverity]
}

function nullsInPluginSettings(config: Holder, at: string): NullRefused[] {
  const settings = `${at}settings`
  return entriesOf(config.settings)
    .filter(([key]) => PLUGINS_SETTINGS_KEYS.has(key))
    .flatMap(([plugin, value]) => refusedWhereNull(value, entryIn(settings, plugin), leaveItOutOrGiveIt(AN_OBJECT)))
}

function nullEntriesIn(holder: Holder, key: KeyOf<OxlintConfig>, prefix: string, advice: string): NullRefused[] {
  const map = `${prefix}${key}`
  return entriesOf(holder[key]).flatMap(([entryKey, value]) => refusedWhereNull(value, entryIn(map, entryKey), advice))
}

/** A null slot is refused, and `nullsInside` walks each other slot. */
function nullsInAList(holder: Holder, key: KeyOf<OxlintConfig> | KeyOf<OxlintOverride>, prefix: string, nullsInside: NullsInside = nothingRefusedInside): NullRefused[] {
  const list = `${prefix}${key}`
  return slotsOf(holder[key]).flatMap((slot, index) => nullsInASlot(slot, slotIn(list, index), nullsInside))
}

function nullsInASlot(slot: unknown, location: string, nullsInside: NullsInside): NullRefused[] {
  return slot === null ? [{ location, advice: REMOVE_IT_FROM_THE_LIST }] : nullsInside(slot, `${location}.`)
}

function nothingRefusedInside(): NullRefused[] {
  return []
}

function refusedWhereNull(value: unknown, location: string, advice: string): NullRefused[] {
  return value === null ? [{ location, advice }] : []
}

function severityListedIn(ruleEntry: unknown): unknown {
  return slotsOf(ruleEntry).at(SEVERITY_SLOT)
}

function entriesOf(value: unknown): Array<[string, unknown]> {
  return isRecord(value) ? Object.entries(value) : []
}

function slotsOf(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : []
}

function entryIn(location: string, key: string): string {
  return `${location}[${JSON.stringify(key)}]`
}

function slotIn(location: string, index: number): string {
  return `${location}[${String(index)}]`
}

function leaveItOutOrGiveIt(takes: string): string {
  return `leave it out or give it ${takes}`
}
