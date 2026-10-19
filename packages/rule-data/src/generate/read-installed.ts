import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { findPackageJSON } from 'node:module'
import { dirname, resolve } from 'node:path'
import { promisify } from 'node:util'

import type { ESLint, Rule } from 'eslint'
import { builtinRules } from 'eslint/use-at-your-own-risk'

import type { OxlintCategory } from '../catalog.ts'
import { compareCodeUnits, foundOr } from '../collections.ts'
import { eslintPlugins } from '../eslint-plugins.ts'
import { isObject } from '../is-object.ts'
import { parseOxlintCategory } from '../parse-names.ts'
import { oxlintNameOf, ruleNameOf } from '../rule-id-parts.ts'
import type { InventoryVersions } from './build-inventory.ts'
import { eslintPluginPackageNames } from './eslint-plugin-package-names.ts'

export type InstalledOxlintRule = { oxlintName: string; typeAware: boolean; category: OxlintCategory }

export type InstalledEslintRule = {
  id: string
  deprecated: boolean
  typed: boolean
  /**
   * The core rule this one extends under another name, as its own meta says: present exactly when it
   * extends one (typescript-eslint's `only-throw-error` extends `no-throw-literal`).
   */
  extendsCoreRule?: string
  /**
   * Every other rule ID its plugin, or ESLint's core, binds to the rule's module object, sorted:
   * present exactly when there is one. One module under two names is one rule (@eslint-react binds
   * `x-no-missing-key` and `no-missing-key` to one).
   */
  sameModuleAs?: readonly string[]
}

export type InstalledEngines = {
  versions: InventoryVersions
  oxlintRules: readonly InstalledOxlintRule[]
  eslintRules: readonly InstalledEslintRule[]
}

/** One entry of `oxlint --rules --format=json`, reduced to the fields we read. */
type OxlintRuleListing = { scope: string; value: string; type_aware: boolean; category: string }

type RuleWithMeta = { meta?: { deprecated?: unknown; docs?: object | undefined } | undefined }

type RuleBinding = { readonly id: string; readonly rule: RuleWithMeta }

const OXLINT_PACKAGE = 'oxlint'
const OXLINT_BIN = 'oxlint'
const ESLINT_PACKAGE = 'eslint'
const OXLINT_LIST_RULES_ARGS = ['--rules', '--format=json']

const execFileAsync = promisify(execFile)

/** The rules and versions of the oxlint, ESLint and ESLint plugins installed beside this package. */
export async function readInstalledEngines(): Promise<InstalledEngines> {
  const [versions, oxlintRules] = await Promise.all([readVersions(), readOxlintRules()])
  return { versions, oxlintRules, eslintRules: readEslintRules(builtinRules, eslintPlugins) }
}

async function readVersions(): Promise<InventoryVersions> {
  const [oxlint, eslint, eslintPluginVersions] = await Promise.all([
    installedVersionOf(OXLINT_PACKAGE),
    installedVersionOf(ESLINT_PACKAGE),
    readEslintPluginVersions(),
  ])
  return { oxlint, eslint, eslintPlugins: eslintPluginVersions }
}

async function readEslintPluginVersions(): Promise<Readonly<Record<string, string>>> {
  const registeredPrefixes = Object.keys(eslintPlugins).toSorted(compareCodeUnits)
  return Object.fromEntries(await Promise.all(registeredPrefixes.map(prefixWithInstalledVersion)))
}

async function prefixWithInstalledVersion(prefix: string): Promise<readonly [string, string]> {
  return [prefix, await installedVersionOf(packageNameOf(prefix))]
}

function packageNameOf(prefix: string): string {
  return foundOr(eslintPluginPackageNames[prefix], `the plugin registered as ${prefix} has no package name in eslint-plugin-package-names.ts`)
}

async function readOxlintRules(): Promise<readonly InstalledOxlintRule[]> {
  const { stdout } = await execFileAsync(process.execPath, [await oxlintCliPath(), ...OXLINT_LIST_RULES_ARGS])
  return parseOxlintRuleListings(stdout).map(installedOxlintRuleOf)
}

/** oxlint's package exports no path to its CLI, so the CLI is found through the manifest's `bin`. */
async function oxlintCliPath(): Promise<string> {
  const manifest = await readManifest(OXLINT_PACKAGE)
  return resolve(dirname(manifestPathOf(OXLINT_PACKAGE)), oxlintBinOf(manifest))
}

function oxlintBinOf(manifest: object): string {
  const bin = 'bin' in manifest ? manifest.bin : undefined
  if (!isObject(bin) || !(OXLINT_BIN in bin) || typeof bin[OXLINT_BIN] !== 'string') {
    throw new Error(`oxlint's package.json has no bin.${OXLINT_BIN}`)
  }
  return bin[OXLINT_BIN]
}

function parseOxlintRuleListings(stdout: string): readonly OxlintRuleListing[] {
  const listed: unknown = JSON.parse(stdout)
  if (!Array.isArray(listed) || !listed.every(isOxlintRuleListing)) {
    throw new Error(`oxlint ${OXLINT_LIST_RULES_ARGS.join(' ')} printed something other than a rule list`)
  }
  return listed
}

function isOxlintRuleListing(value: unknown): value is OxlintRuleListing {
  return (
    isObject(value) &&
    'scope' in value &&
    typeof value.scope === 'string' &&
    'value' in value &&
    typeof value.value === 'string' &&
    'type_aware' in value &&
    typeof value.type_aware === 'boolean' &&
    'category' in value &&
    typeof value.category === 'string'
  )
}

function installedOxlintRuleOf({ scope, value, type_aware: typeAware, category }: OxlintRuleListing): InstalledOxlintRule {
  return { oxlintName: oxlintNameOf({ scope, ruleName: value }), typeAware, category: parseOxlintCategory(category) }
}

/** ESLint's core rules, then each plugin's under its prefix, each in the order it lists them. */
export function readEslintRules(
  coreRules: ReadonlyMap<string, Rule.RuleModule>,
  plugins: Readonly<Record<string, ESLint.Plugin>>,
): readonly InstalledEslintRule[] {
  const pluginBindings = Object.entries(plugins).map(([prefix, plugin]) => bindingsOfPlugin(prefix, plugin))
  return [bindingsOfCoreRules(coreRules), ...pluginBindings].flatMap(installedRulesBoundBy)
}

function bindingsOfCoreRules(coreRules: ReadonlyMap<string, Rule.RuleModule>): RuleBinding[] {
  return [...coreRules].map(([name, rule]) => ({ id: name, rule }))
}

function bindingsOfPlugin(prefix: string, plugin: ESLint.Plugin): RuleBinding[] {
  return Object.entries(rulesOf(prefix, plugin)).map(([name, rule]) => ({ id: `${prefix}/${name}`, rule }))
}

/** The rules of one plugin, or of ESLint's core, each with the other names that plugin binds its module to. */
function installedRulesBoundBy(bindings: readonly RuleBinding[]): InstalledEslintRule[] {
  return bindings.map(({ id, rule }) => installedEslintRule(id, rule, otherIdsBoundTo(rule, id, bindings)))
}

function otherIdsBoundTo(rule: RuleWithMeta, id: string, bindings: readonly RuleBinding[]): string[] {
  return bindings
    .filter((binding) => binding.rule === rule && binding.id !== id)
    .map((binding) => binding.id)
    .toSorted(compareCodeUnits)
}

function rulesOf(prefix: string, plugin: ESLint.Plugin): NonNullable<ESLint.Plugin['rules']> {
  return foundOr(plugin.rules, `the plugin registered as ${prefix} has no rules`)
}

function installedEslintRule(id: string, rule: RuleWithMeta, sameModuleAs: readonly string[]): InstalledEslintRule {
  const extendsCoreRule = coreRuleExtendedBy(id, rule)
  return {
    id,
    deprecated: isDeprecated(rule),
    typed: requiresTypeChecking(rule),
    ...(extendsCoreRule === null ? {} : { extendsCoreRule }),
    ...(sameModuleAs.length === 0 ? {} : { sameModuleAs }),
  }
}

/**
 * typescript-eslint's `extendsBaseRule`: true where the core rule has the rule's own name, the core
 * rule's name where it differs.
 */
function coreRuleExtendedBy(id: string, { meta }: RuleWithMeta): string | null {
  const docs = meta?.docs
  if (docs === undefined || !('extendsBaseRule' in docs)) return null
  const { extendsBaseRule } = docs
  if (extendsBaseRule === true) return ruleNameOf(id)
  return typeof extendsBaseRule === 'string' ? extendsBaseRule : null
}

function isDeprecated({ meta }: RuleWithMeta): boolean {
  return meta?.deprecated !== undefined && meta.deprecated !== false
}

/** typescript-eslint's flag. Some typed rules of other plugins lack it; the canonical list stores `typed`. */
function requiresTypeChecking({ meta }: RuleWithMeta): boolean {
  const docs = meta?.docs
  return docs !== undefined && 'requiresTypeChecking' in docs && docs.requiresTypeChecking === true
}

async function installedVersionOf(packageName: string): Promise<string> {
  const manifest = await readManifest(packageName)
  if (!('version' in manifest) || typeof manifest.version !== 'string') {
    throw new Error(`${packageName}'s package.json has no version`)
  }
  return manifest.version
}

async function readManifest(packageName: string): Promise<object> {
  const manifest: unknown = JSON.parse(await readFile(manifestPathOf(packageName), 'utf8'))
  if (!isObject(manifest)) throw new Error(`${packageName}'s package.json is not an object`)
  return manifest
}

function manifestPathOf(packageName: string): string {
  return foundOr(findPackageJSON(packageName, import.meta.url), `${packageName} is not installed`)
}
