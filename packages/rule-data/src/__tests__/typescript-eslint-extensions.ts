import type { ESLint } from 'eslint'
import typescriptEslint from 'typescript-eslint'

import { eslintPlugins } from '../eslint-plugins.ts'
import { isObject } from '../is-object.ts'

/** A typescript-eslint rule that extends an ESLint core rule, as its own meta says. */
export type TypescriptEslintExtension = {
  /** Its rule ID: `@typescript-eslint/no-unused-vars`. */
  readonly id: string
  /** The core rule it extends: `no-unused-vars`. */
  readonly coreRule: string
  /** Deprecated with the core rule named as its replacement, so it checks nothing the core rule does not. */
  readonly replacedByCoreRule: boolean
}

/** A config typescript-eslint exports that a team extends, by its export name. */
export type TypescriptEslintConfigName = 'recommended' | 'strict'

const TYPESCRIPT_ESLINT_PREFIX = '@typescript-eslint'
const OFF_SEVERITIES: ReadonlySet<unknown> = new Set(['off', 0])

/**
 * Every typescript-eslint rule that extends a core rule (`meta.docs.extendsBaseRule`), sorted by ID.
 * Read from the installed plugin, not from our data.
 */
export function typescriptEslintExtensions(): TypescriptEslintExtension[] {
  return Object.entries(typescriptEslintRules())
    .flatMap(([name, rule]) => extensionOf(name, rule))
    .toSorted((first, second) => first.id.localeCompare(second.id))
}

/** The installed typescript-eslint plugin's rules, by rule name, as registered under its prefix. */
export function typescriptEslintRules(): NonNullable<ESLint.Plugin['rules']> {
  const plugin = eslintPlugins[TYPESCRIPT_ESLINT_PREFIX]
  if (plugin?.rules === undefined) throw new Error(`no plugin with rules is registered under ${TYPESCRIPT_ESLINT_PREFIX}`)
  return plugin.rules
}

/**
 * The extension rule IDs the config turns on, sorted. A later block of the config wins over an
 * earlier one, as ESLint reads it.
 */
export function extensionIdsTurnedOnBy(configName: TypescriptEslintConfigName): string[] {
  const extensionIds = new Set(typescriptEslintExtensions().map(({ id }) => id))
  const finalEntries = new Map(typescriptEslint.configs[configName].flatMap(({ rules = {} }) => Object.entries(rules)))
  return [...finalEntries]
    .filter(([id, entry]) => extensionIds.has(id) && turnsOn(entry))
    .map(([id]) => id)
    .toSorted()
}

function extensionOf(name: string, rule: unknown): TypescriptEslintExtension[] {
  const coreRule = coreRuleExtendedBy(name, rule)
  if (coreRule === null) return []
  return [{ id: `${TYPESCRIPT_ESLINT_PREFIX}/${name}`, coreRule, replacedByCoreRule: replacementsOf(rule).includes(coreRule) }]
}

/** `extendsBaseRule` is true where the core rule has the same name, and the core rule's name where it differs. */
function coreRuleExtendedBy(name: string, rule: unknown): string | null {
  const meta = metaOf(rule)
  if (meta === null || !('docs' in meta) || !isObject(meta.docs) || !('extendsBaseRule' in meta.docs)) return null
  const { extendsBaseRule } = meta.docs
  if (extendsBaseRule === true) return name
  return typeof extendsBaseRule === 'string' ? extendsBaseRule : null
}

/** The rule names a deprecated rule's `meta.deprecated.replacedBy` gives, in ESLint's DeprecatedInfo shape. */
function replacementsOf(rule: unknown): string[] {
  const meta = metaOf(rule)
  if (meta === null || !('deprecated' in meta) || !isObject(meta.deprecated) || !('replacedBy' in meta.deprecated)) return []
  const { replacedBy } = meta.deprecated
  return Array.isArray(replacedBy) ? replacedBy.flatMap(replacementRuleName) : []
}

function replacementRuleName(replacement: unknown): string[] {
  if (!isObject(replacement) || !('rule' in replacement) || !isObject(replacement.rule)) return []
  return 'name' in replacement.rule && typeof replacement.rule.name === 'string' ? [replacement.rule.name] : []
}

function metaOf(rule: unknown): object | null {
  return isObject(rule) && 'meta' in rule && isObject(rule.meta) ? rule.meta : null
}

function turnsOn(entry: unknown): boolean {
  return !OFF_SEVERITIES.has(Array.isArray(entry) ? entry[0] : entry)
}
