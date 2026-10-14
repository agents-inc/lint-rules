import type { ESLint } from 'eslint'

type Entries = readonly (readonly [string, unknown])[]

/** What a plugin object holds when snapshotted: its own keys and rules, each by identity, and its meta as text. */
export type PluginSnapshot = {
  readonly plugin: ESLint.Plugin
  readonly keys: Entries
  readonly rules: Entries
  readonly meta: string
}

export function snapshotOf(plugin: ESLint.Plugin): PluginSnapshot {
  return {
    plugin,
    keys: Object.entries(plugin),
    rules: plugin.rules === undefined ? [] : Object.entries(plugin.rules),
    meta: JSON.stringify(plugin.meta),
  }
}

/**
 * Each change made to the plugin object since its snapshot, one line each: a key or rule added,
 * removed or replaced by another object, or the meta changed in place. None for a plugin left as
 * it was.
 */
export function changesSince(snapshot: PluginSnapshot): string[] {
  const now = snapshotOf(snapshot.plugin)
  return [
    ...differencesBetween('key', snapshot.keys, now.keys),
    ...differencesBetween('rule', snapshot.rules, now.rules),
    ...(now.meta === snapshot.meta ? [] : ['meta changed']),
  ]
}

function differencesBetween(label: string, before: Entries, after: Entries): string[] {
  const afterByKey = new Map(after)
  const beforeByKey = new Map(before)
  return [
    ...before.flatMap(([key, value]) => {
      if (!afterByKey.has(key)) return [`${label} ${key} removed`]
      return afterByKey.get(key) === value ? [] : [`${label} ${key} replaced`]
    }),
    ...after.flatMap(([key]) => (beforeByKey.has(key) ? [] : [`${label} ${key} added`])),
  ]
}
