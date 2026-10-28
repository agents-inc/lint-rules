import { type Breach, breachesOf } from './breaches.ts'

/** A plugin left uninstalled by the owner's answer to a card. */
export type HeldPlugin = {
  /** The card whose answer left it out. */
  readonly heldBy: string
  readonly prefix: string
  readonly packageName: string
}

/** Where rule-data installs a plugin: its registry and package names, by prefix, and its own dependencies, by package. */
export type PluginInstalls = {
  readonly registry: Readonly<Record<string, unknown>>
  readonly packageNames: Readonly<Record<string, string>>
  readonly dependencies: Readonly<Record<string, string>>
}

/** A card: a question the owner answers, `q-` and lower-case words joined by hyphens. */
const QUESTION_CARD = /^q-[\da-z]+(?:-[\da-z]+)*$/u

/** `prefix: what is wrong` for each held plugin that is held for no card, or is installed anywhere rule-data installs a plugin. */
export function heldPluginsOutOfPlace(heldPlugins: readonly HeldPlugin[], installs: PluginInstalls): string[] {
  return heldPlugins.flatMap((heldPlugin) => wrongsOfAHeldPlugin(heldPlugin, installs).map((wrong) => `${heldPlugin.prefix}: ${wrong}`))
}

function wrongsOfAHeldPlugin(heldPlugin: HeldPlugin, { registry, packageNames, dependencies }: PluginInstalls): string[] {
  const { heldBy, packageName } = heldPlugin
  const breaches: ReadonlyArray<Breach<HeldPlugin>> = [
    [`is held for "${heldBy}", which is no card`, () => !QUESTION_CARD.test(heldBy)],
    [`is registered, though card ${heldBy} left it out`, ({ prefix }) => Object.hasOwn(registry, prefix)],
    [`has its package named, though card ${heldBy} left it out`, ({ prefix }) => Object.hasOwn(packageNames, prefix)],
    [`is a dependency of rule-data as ${packageName}, though card ${heldBy} left it out`, () => Object.hasOwn(dependencies, packageName)],
  ]
  return breachesOf(heldPlugin, breaches)
}
