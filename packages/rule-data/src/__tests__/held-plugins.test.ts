import { describe, expect, it } from 'vitest'

import { buildRulesPlugin } from './factories/eslint-plugin-factories.ts'
import { type HeldPlugin, heldPluginsOutOfPlace, type PluginInstalls } from './held-plugins.ts'

const HELD_BY = 'q-held'
const PINNED_VERSION = '1.0.0'
const INSTALLED_NOWHERE: PluginInstalls = { registry: {}, packageNames: {}, dependencies: {} }

function heldPluginOf(prefix: string, heldBy: string): HeldPlugin {
  return { heldBy, prefix, packageName: `eslint-plugin-${prefix}` }
}

describe('heldPluginsOutOfPlace', () => {
  it('names a held plugin that is registered, one whose package is named, and one rule-data depends on, beside one installed nowhere', () => {
    const registered = heldPluginOf('registered', HELD_BY)
    const named = heldPluginOf('named', HELD_BY)
    const aDependency = heldPluginOf('a-dependency', HELD_BY)
    const installs: PluginInstalls = {
      registry: { [registered.prefix]: buildRulesPlugin(['some-rule']) },
      packageNames: { [named.prefix]: named.packageName },
      dependencies: { [aDependency.packageName]: PINNED_VERSION },
    }

    expect(heldPluginsOutOfPlace([heldPluginOf('installed-nowhere', HELD_BY), registered, named, aDependency], installs)).toStrictEqual([
      `registered: is registered, though card ${HELD_BY} left it out`,
      `named: has its package named, though card ${HELD_BY} left it out`,
      `a-dependency: is a dependency of rule-data as eslint-plugin-a-dependency, though card ${HELD_BY} left it out`,
    ])
  })

  it('names a held plugin whose card is empty, an accepting card, in a sentence, trailed or capitalised, beside one held for a card with a digit', () => {
    const heldPlugins = [
      heldPluginOf('card-with-digit', 'q-r4-held'),
      heldPluginOf('card-empty', ''),
      heldPluginOf('card-accepting', 'rc-card-accepting'),
      heldPluginOf('card-in-a-sentence', `card ${HELD_BY}`),
      heldPluginOf('card-trailed', `${HELD_BY}.`),
      heldPluginOf('card-capitalised', 'q-lint-Held'),
    ]

    expect(heldPluginsOutOfPlace(heldPlugins, INSTALLED_NOWHERE)).toStrictEqual([
      'card-empty: is held for "", which is no card',
      'card-accepting: is held for "rc-card-accepting", which is no card',
      `card-in-a-sentence: is held for "card ${HELD_BY}", which is no card`,
      `card-trailed: is held for "${HELD_BY}.", which is no card`,
      'card-capitalised: is held for "q-lint-Held", which is no card',
    ])
  })
})
