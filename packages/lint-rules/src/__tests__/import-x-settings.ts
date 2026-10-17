import { isRecord } from '../core/is-record.ts'

// import-x 4.17.1 resolves an import with settings['import-x/resolver-next'] wherever it holds
// anything; else with the first of 'import-x/resolver-legacy' and 'import-x/resolver' that holds
// anything; else with its node resolver given 'import-x/resolve' (lib/utils/resolve.js, fullResolve).
const RESOLVER_NEXT = 'import-x/resolver-next'
const LEGACY_RESOLVER_KEYS = ['import-x/resolver-legacy', 'import-x/resolver'] as const
const NODE_RESOLVER_OPTIONS = 'import-x/resolve'
const UNNAMED = 'unnamed'

/** resolver-next's resolvers by name, or the legacy setting read instead, by its key and value. */
export type ResolversImportXReads =
  | { readonly key: typeof RESOLVER_NEXT; readonly names: readonly string[] }
  | { readonly key: (typeof LEGACY_RESOLVER_KEYS)[number] | typeof NODE_RESOLVER_OPTIONS; readonly value: unknown }

/** As fullResolve chooses them. */
export function resolversImportXReads(settings: unknown): ResolversImportXReads {
  const given = isRecord(settings) ? settings : {}
  const next = given[RESOLVER_NEXT]
  if (holdsAnything(next)) return { key: RESOLVER_NEXT, names: (Array.isArray(next) ? next : [next]).map(nameOfResolver) }
  const legacyKey = LEGACY_RESOLVER_KEYS.find((key) => holdsAnything(given[key]))
  return legacyKey === undefined ? { key: NODE_RESOLVER_OPTIONS, value: given[NODE_RESOLVER_OPTIONS] } : { key: legacyKey, value: given[legacyKey] }
}

/** Whether import-x's `if (value)` and `||` take the value. */
function holdsAnything(value: unknown): boolean {
  return Boolean(value)
}

function nameOfResolver(resolver: unknown): string {
  if (!isRecord(resolver)) return UNNAMED
  const { name } = resolver
  return typeof name === 'string' ? name : UNNAMED
}
