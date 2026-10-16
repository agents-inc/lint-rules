import type { ESLint, Linter } from 'eslint'

/** The config's block of the name given: throws where no block has it. */
export function blockNamed(config: readonly Linter.Config[], name: string): Linter.Config {
  const block = config.find((candidate) => candidate.name === name)
  if (block === undefined) throw new Error(`no block named ${name}`)
  return block
}

/** The plugin registered under the prefix: throws where none is. */
export function pluginRegisteredUnder(plugins: Readonly<Record<string, ESLint.Plugin>>, prefix: string): ESLint.Plugin {
  const plugin = plugins[prefix]
  if (plugin === undefined) throw new Error(`no ESLint plugin is registered under ${prefix}`)
  return plugin
}
