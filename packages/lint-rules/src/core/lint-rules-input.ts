// Types are stripped when `agents-inc.lint.mts` loads, so every name here is a plain string until
// `validateLintRules` narrows it.

import type { SuppressionMode } from '@workspace/rule-data'

const SEVERITIES = ['error', 'warn', 'off'] as const

export type Severity = (typeof SEVERITIES)[number]

export type RuleEntryInput = string | readonly unknown[]

export type RuleSettingsInput = Readonly<Record<string, RuleEntryInput>>

export type RulesetsInput = {
  readonly quality: readonly string[]
  readonly libs: Readonly<Record<string, readonly string[]>>
  readonly runtimes: readonly string[]
  readonly languages?: readonly string[]
}

export type FileOverrideInput = {
  readonly files: readonly string[]
  readonly rulesets?: Partial<RulesetsInput>
  /** A quoted 'false' is truthy, so it stays unknown until validated. */
  readonly allowSuppressions?: unknown
  readonly rules?: RuleSettingsInput
}

/** The consumer's config with one set as its `rulesets`. */
export type LintRulesInput = {
  readonly tsconfigRootDir: string
  readonly rulesets: RulesetsInput
  readonly ignores?: readonly string[]
  readonly allowSuppressions?: unknown
  readonly rules?: RuleSettingsInput
  readonly fileOverrides?: readonly FileOverrideInput[]
}

export type RulesetSet = 'agentRulesets' | 'editorRulesets'

export type TwoSetFileOverrideInput = {
  readonly files: readonly string[]
  /** A set left out keeps the top-level one for these files. */
  readonly agentRulesets?: Partial<RulesetsInput>
  readonly editorRulesets?: Partial<RulesetsInput>
  readonly allowSuppressions?: unknown
  readonly rules?: RuleSettingsInput
}

export type TwoSetLintRulesInput = {
  readonly tsconfigRootDir: string
  /** A list left out lists no ruleset, as `init` writes `editorRulesets: {}`. */
  readonly agentRulesets: Partial<RulesetsInput>
  readonly editorRulesets: Partial<RulesetsInput>
  readonly ignores?: readonly string[]
  readonly allowSuppressions?: unknown
  readonly rules?: RuleSettingsInput
  readonly fileOverrides?: readonly TwoSetFileOverrideInput[]
}

export const RULESET_SETS: readonly RulesetSet[] = ['agentRulesets', 'editorRulesets']

/** An entry that leaves the set out gets no `rulesets`, so it inherits the top-level lists. */
export function projectedOnto(
  set: RulesetSet,
  { agentRulesets, editorRulesets, fileOverrides, ...shared }: TwoSetLintRulesInput,
): LintRulesInput {
  const rulesets = withEachListLeftOutEmpty({ agentRulesets, editorRulesets }[set])
  if (fileOverrides === undefined) return { ...shared, rulesets }
  return { ...shared, rulesets, fileOverrides: fileOverrides.map((entry) => entryProjectedOnto(set, entry)) }
}

/** A top-level set has nothing to inherit from, so a list it leaves out is empty. */
function withEachListLeftOutEmpty({ quality = [], libs = {}, runtimes = [], ...optionalLists }: Partial<RulesetsInput>): RulesetsInput {
  return { quality, libs, runtimes, ...optionalLists }
}

function entryProjectedOnto(
  set: RulesetSet,
  { agentRulesets, editorRulesets, ...shared }: TwoSetFileOverrideInput,
): FileOverrideInput {
  const rulesets = { agentRulesets, editorRulesets }[set]
  return rulesets === undefined ? shared : { ...shared, rulesets }
}

/** Null when it gives none of `error`, `warn` or `off`. */
export function severityOf(entry: RuleEntryInput): Severity | null {
  const given = severityGivenBy(entry)
  return isSeverity(given) ? given : null
}

export function describeSeverity(entry: RuleEntryInput): string {
  return String(severityGivenBy(entry))
}

/** Null for a severity alone, which keeps the options in force. */
export function optionsGivenBy(entry: RuleEntryInput): readonly unknown[] | null {
  if (typeof entry === 'string') return null
  const [, ...options] = entry
  return options.length === 0 ? null : options
}

/** Once types are stripped, any other value is truthy or falsy by accident. */
export function isAllowSuppressionsValue(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === 'boolean'
}

/** Null where it is left out, so the earlier mode stands. */
export function suppressionModeSetBy(allowSuppressions: unknown): SuppressionMode | null {
  if (!isAllowSuppressionsValue(allowSuppressions)) {
    throw new Error(`allowSuppressions: "${String(allowSuppressions)}" is not true or false`)
  }
  if (allowSuppressions === undefined) return null
  return allowSuppressions ? 'allowed' : 'banned'
}

export function listedRulesetNames({ quality, libs, runtimes, languages = [] }: RulesetsInput): ReadonlySet<string> {
  return new Set([...quality, ...Object.values(libs).flat(), ...runtimes, ...languages])
}

function severityGivenBy(entry: RuleEntryInput): unknown {
  return typeof entry === 'string' ? entry : entry[0]
}

function isSeverity(value: unknown): value is Severity {
  return SEVERITIES.some((severity) => severity === value)
}
