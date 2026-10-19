import { existsSync, statSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import type { Catalog, RulesetDefinition, RulesetList } from '@workspace/rule-data'
import { consumerConfigFiles } from '@workspace/rule-data/consumer-config-files'
import { isSuppressionRoute, rulesetNamed } from './catalog-lookups.ts'
import { configErrorIn } from './config-error.ts'
import {
  describeSeverity,
  isAllowSuppressionsValue,
  RULESET_SETS,
  type RuleSettingsInput,
  type RulesetsInput,
  severityOf,
  type TwoSetFileOverrideInput,
  type TwoSetLintRulesInput,
} from './lint-rules-input.ts'
import { quotedOrDescribed } from './value-descriptions.ts'

type FlatRulesetList = Exclude<RulesetList, 'libs'>

type RulesetSlot = { readonly label: string; readonly holds: (ruleset: RulesetDefinition) => boolean }

/** Throws on the first problem, naming the file, the value and its path in the config. */
export function validateLintRules(lintRules: TwoSetLintRulesInput, catalog: Catalog): void {
  const { tsconfigRootDir, allowSuppressions, rules = {}, fileOverrides = [] } = lintRules
  const [firstProblem] = [
    ...tsconfigRootDirProblems(tsconfigRootDir, 'tsconfigRootDir'),
    ...RULESET_SETS.flatMap((set) => rulesetSetProblems(lintRules[set], set, catalog)),
    ...allowSuppressionsProblems(allowSuppressions, 'allowSuppressions'),
    ...ruleSettingProblems(rules, 'rules', catalog),
    ...fileOverrides.flatMap((fileOverride, index) =>
      fileOverrideProblems(fileOverride, `fileOverrides[${index}]`, catalog),
    ),
  ]
  if (firstProblem !== undefined) throw configErrorIn(consumerConfigFiles.lintRules, firstProblem)
}

/** Types are stripped, so the value may be missing or no string. A relative or missing folder would otherwise surface later as an error blaming another file, or as none. */
function tsconfigRootDirProblems(tsconfigRootDir: unknown, path: string): string[] {
  if (tsconfigRootDir === undefined) return [`${path}: missing`]
  if (typeof tsconfigRootDir !== 'string') return [`${path}: ${quotedOrDescribed(tsconfigRootDir)} is not a string`]
  if (!isAbsolute(tsconfigRootDir)) return [`${path}: "${tsconfigRootDir}" is not an absolute path`]
  if (!existsSync(tsconfigRootDir)) return [`${path}: "${tsconfigRootDir}" does not exist`]
  if (!statSync(tsconfigRootDir).isDirectory()) return [`${path}: "${tsconfigRootDir}" is not a folder`]
  return []
}

/** Types are stripped, so a required set may still be missing. */
function rulesetSetProblems(rulesets: Partial<RulesetsInput> | undefined, path: string, catalog: Catalog): string[] {
  if (rulesets === undefined) return [`${path}: missing`]
  return rulesetProblems(rulesets, path, catalog)
}

function fileOverrideProblems(entry: TwoSetFileOverrideInput, path: string, catalog: Catalog): string[] {
  const { allowSuppressions, rules = {} } = entry
  return [
    ...RULESET_SETS.flatMap((set) => rulesetProblems(entry[set] ?? {}, `${path}.${set}`, catalog)),
    ...allowSuppressionsProblems(allowSuppressions, `${path}.allowSuppressions`),
    ...ruleSettingProblems(rules, `${path}.rules`, catalog),
  ]
}

function allowSuppressionsProblems(allowSuppressions: unknown, path: string): string[] {
  if (isAllowSuppressionsValue(allowSuppressions)) return []
  return [`${path}: ${quotedOrDescribed(allowSuppressions)} is not true or false`]
}

function rulesetProblems(
  { quality, libs, runtimes, languages }: Partial<RulesetsInput>,
  path: string,
  catalog: Catalog,
): string[] {
  return [
    ...flatListProblems(quality, 'quality', `${path}.quality`, catalog),
    ...libsProblems(libs, `${path}.libs`, catalog),
    ...flatListProblems(runtimes, 'runtimes', `${path}.runtimes`, catalog),
    ...flatListProblems(languages, 'languages', `${path}.languages`, catalog),
  ]
}

function flatListProblems(
  names: readonly string[] | undefined,
  list: FlatRulesetList,
  path: string,
  catalog: Catalog,
): string[] {
  if (names === undefined) return []
  return rulesetNameProblems(names, flatListSlot(list), path, catalog)
}

function libsProblems(libs: RulesetsInput['libs'] | undefined, path: string, catalog: Catalog): string[] {
  if (libs === undefined) return []
  const knownDomains = libsDomainsOf(catalog)
  return Object.entries(libs).flatMap(([domain, names]) => {
    if (!knownDomains.has(domain)) return [`${path}: unknown domain "${domain}"`]
    return rulesetNameProblems(names, libsDomainSlot(domain), `${path}.${domain}`, catalog)
  })
}

function rulesetNameProblems(names: readonly string[], slot: RulesetSlot, path: string, catalog: Catalog): string[] {
  return names.flatMap((name) => {
    const ruleset = rulesetNamed(name, catalog)
    if (ruleset === undefined) return [`${path}: unknown ruleset "${name}"`]
    if (!slot.holds(ruleset)) return [`${path}: "${name}" is not a ${slot.label} ruleset`]
    return []
  })
}

/** `allowSuppressions` is the one place that sets the rules it decides. */
function ruleSettingProblems(rules: RuleSettingsInput, path: string, catalog: Catalog): string[] {
  return Object.entries(rules).flatMap(([id, entry]) => {
    const route = catalog.rules.get(id)
    if (route === undefined) return [`${path}: unknown rule ID "${id}"`]
    if (isSuppressionRoute(route)) return [`${path}: "${id}" is set by allowSuppressions`]
    if (severityOf(entry) === null) return [`${path}: invalid severity ${describeSeverity(entry)} for "${id}"`]
    return []
  })
}

function flatListSlot(list: FlatRulesetList): RulesetSlot {
  return { label: list, holds: (ruleset) => ruleset.list === list }
}

function libsDomainSlot(domain: string): RulesetSlot {
  return { label: domain, holds: (ruleset) => ruleset.list === 'libs' && ruleset.domain === domain }
}

function libsDomainsOf(catalog: Catalog): ReadonlySet<string | null> {
  return new Set(catalog.rulesets.filter((ruleset) => ruleset.list === 'libs').map((ruleset) => ruleset.domain))
}
