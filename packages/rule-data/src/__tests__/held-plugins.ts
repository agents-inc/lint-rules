import { type Breach, breachesOf } from './breaches.ts'

/** A plugin left uninstalled while the card its install waits on is unanswered: its pin joins the installed ones once it is. */
export type HeldPlugin = {
  /** The card its install waits on. */
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

/** A card a build waits on: a question the owner answers, `q-` and lower-case words joined by hyphens. */
const QUESTION_CARD = /^q-[\da-z]+(?:-[\da-z]+)*$/u

/** `prefix: what is wrong` for each held plugin that is held for no card, or is installed anywhere rule-data installs a plugin. */
export function heldPluginsOutOfPlace(heldPlugins: readonly HeldPlugin[], installs: PluginInstalls): string[] {
  return heldPlugins.flatMap((heldPlugin) => wrongsOfAHeldPlugin(heldPlugin, installs).map((wrong) => `${heldPlugin.prefix}: ${wrong}`))
}

function wrongsOfAHeldPlugin(heldPlugin: HeldPlugin, { registry, packageNames, dependencies }: PluginInstalls): string[] {
  const { heldBy, packageName } = heldPlugin
  const breaches: ReadonlyArray<Breach<HeldPlugin>> = [
    [`is held for "${heldBy}", which is no card`, () => !QUESTION_CARD.test(heldBy)],
    [`is registered, though its install waits on card ${heldBy}`, ({ prefix }) => Object.hasOwn(registry, prefix)],
    [`has its package named, though its install waits on card ${heldBy}`, ({ prefix }) => Object.hasOwn(packageNames, prefix)],
    [`is a dependency of rule-data as ${packageName}, though its install waits on card ${heldBy}`, () => Object.hasOwn(dependencies, packageName)],
  ]
  return breachesOf(heldPlugin, breaches)
}
