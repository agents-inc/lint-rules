// The consumer's config as the core reads it. Types are stripped when `agents-inc.lint.mts` loads,
// so every name here is a plain string, and `validateLintRules` narrows them at runtime.

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

/** One set projected onto the single `rulesets` the core builds from: see `projectedOnto`. */
export type FileOverrideInput = {
  readonly files: readonly string[]
  readonly rulesets?: Partial<RulesetsInput>
  /** Any value until `validateLintRules` has checked it is a boolean: a quoted 'false' is truthy. */
  readonly allowSuppressions?: unknown
  readonly rules?: RuleSettingsInput
}

/** The consumer's config with one set as its `rulesets`: what the core resolves and builds from. */
export type LintRulesInput = {
  readonly tsconfigRootDir: string
  readonly rulesets: RulesetsInput
  readonly ignores?: readonly string[]
  readonly allowSuppressions?: unknown
  readonly rules?: RuleSettingsInput
  readonly fileOverrides?: readonly FileOverrideInput[]
}

/** The two sets of rulesets: one for sub-agents, one a team merges into its own engine configs. */
export type RulesetSet = 'agentRulesets' | 'editorRulesets'

export type TwoSetFileOverrideInput = {
  readonly files: readonly string[]
  /** Either set, both or neither: a set left out keeps the top-level one for these files. */
  readonly agentRulesets?: Partial<RulesetsInput>
  readonly editorRulesets?: Partial<RulesetsInput>
  readonly allowSuppressions?: unknown
  readonly rules?: RuleSettingsInput
}

/** `agents-inc.lint.mts` as the core reads it: both sets, and the keys they share. */
export type TwoSetLintRulesInput = {
  readonly tsconfigRootDir: string
  /** A list a top-level set leaves out lists no ruleset, as `init` writes `editorRulesets: {}`. */
  readonly agentRulesets: Partial<RulesetsInput>
  readonly editorRulesets: Partial<RulesetsInput>
  readonly ignores?: readonly string[]
  readonly allowSuppressions?: unknown
  readonly rules?: RuleSettingsInput
  readonly fileOverrides?: readonly TwoSetFileOverrideInput[]
}

export const RULESET_SETS: readonly RulesetSet[] = ['agentRulesets', 'editorRulesets']

/**
 * The shared keys with the set given as `rulesets`, at the top level, each list it leaves out empty,
 * and in each entry that gives it; an entry that leaves the set out gets no `rulesets`, so it
 * inherits the top-level lists.
 */
export function projectedOnto(
  set: RulesetSet,
  { agentRulesets, editorRulesets, fileOverrides, ...shared }: TwoSetLintRulesInput,
): LintRulesInput {
  const rulesets = withEachListLeftOutEmpty({ agentRulesets, editorRulesets }[set])
  if (fileOverrides === undefined) return { ...shared, rulesets }
  return { ...shared, rulesets, fileOverrides: fileOverrides.map((entry) => entryProjectedOnto(set, entry)) }
}

/** A top-level set has nothing below it to inherit from, so a list it leaves out lists no ruleset. */
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

/** The severity an entry gives, or null when it gives none of `error`, `warn` or `off`. */
export function severityOf(entry: RuleEntryInput): Severity | null {
  const given = severityGivenBy(entry)
  return isSeverity(given) ? given : null
}

export function describeSeverity(entry: RuleEntryInput): string {
  return String(severityGivenBy(entry))
}

/** The options an entry gives, or null for a severity alone, which keeps the options in force. */
export function optionsGivenBy(entry: RuleEntryInput): readonly unknown[] | null {
  if (typeof entry === 'string') return null
  const [, ...options] = entry
  return options.length === 0 ? null : options
}

/** Left out, or a boolean: once types are stripped, any other value is truthy or falsy by accident. */
export function isAllowSuppressionsValue(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === 'boolean'
}

/** The mode `allowSuppressions` sets, or null where it is left out, so the mode before it stands. */
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
