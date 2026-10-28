import type { Rule } from 'eslint'
import { describe, expect, it } from 'vitest'
import { buildFakePlugin } from './factories/catalog-factories.ts'
import { changesSince, snapshotOf } from './plugin-snapshots.ts'

// The snapshot the "merging changes no plugin" spec compares: one blind to a change in place would
// let a merge that edits the registry's or a team's plugin pass.

/** A plugin whose parts a spec changes in place, each typed as present. */
function changeablePlugin() {
  const rules: Record<string, Rule.RuleModule> = { 'jsx-key': { create() { return {} } } }
  const meta = { name: 'plugin', version: '1.0.0' }
  return { rules, meta, plugin: { meta, rules } }
}

describe('changesSince', () => {
  it('finds none in a plugin left as it was', () => {
    const snapshot = snapshotOf(buildFakePlugin(['jsx-key'], { meta: { name: 'plugin', version: '1.0.0' } }))

    expect(changesSince(snapshot)).toStrictEqual([])
  })

  it('finds a rule added, and a rule replaced, in the rules object itself', () => {
    const { rules, plugin } = changeablePlugin()
    const snapshot = snapshotOf(plugin)
    // eslint-disable-next-line functional/immutable-data -- the spec changes the plugin in place, which is the change changesSince must find
    rules['jsx-key'] = { create() { return {} } }
    // eslint-disable-next-line functional/immutable-data -- the spec changes the plugin in place, which is the change changesSince must find
    rules['no-clone-element'] = { create() { return {} } }

    expect(changesSince(snapshot)).toStrictEqual(['rule jsx-key replaced', 'rule no-clone-element added'])
  })

  it('finds the meta changed in place', () => {
    const { meta, plugin } = changeablePlugin()
    const snapshot = snapshotOf(plugin)
    // eslint-disable-next-line functional/immutable-data -- the spec changes the plugin in place, which is the change changesSince must find
    meta.version = '2.0.0'

    expect(changesSince(snapshot)).toStrictEqual(['meta changed'])
  })

  it('finds a key of the plugin replaced by another object, though it holds the same rules', () => {
    const { plugin } = changeablePlugin()
    const snapshot = snapshotOf(plugin)
    // eslint-disable-next-line functional/immutable-data -- the spec changes the plugin in place, which is the change changesSince must find
    plugin.rules = { ...plugin.rules }

    expect(changesSince(snapshot)).toStrictEqual(['key rules replaced'])
  })
})
