// What the code reads of `agents-inc.lint.mts`. The types in index.ts check every name in it, so here a name is a
// plain string; a config nobody type-checks is read as it is written (owner, 2026-10-19).

import type { SuppressionMode } from '@workspace/rule-data'

export type Severity = 'error' | 'warn' | 'off'

export type RuleEntryInput = Severity | readonly [Severity, ...unknown[]]

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
  readonly allowSuppressions?: boolean
  readonly rules?: RuleSettingsInput
}

/** The consumer's config with one set as its `rulesets`. */
export type LintRulesInput = {
  readonly tsconfigRootDir: string
  readonly rulesets: RulesetsInput
  readonly ignores?: readonly string[]
  readonly allowSuppressions?: boolean
  readonly rules?: RuleSettingsInput
  readonly fileOverrides?: readonly FileOverrideInput[]
}

type RulesetSet = 'agentRulesets' | 'editorRulesets'

type TwoSetFileOverrideInput = {
  readonly files: readonly string[]
  /** A set left out keeps the top-level one for these files. */
  readonly agentRulesets?: Partial<RulesetsInput>
  readonly editorRulesets?: Partial<RulesetsInput>
  readonly allowSuppressions?: boolean
  readonly rules?: RuleSettingsInput
}

export type TwoSetLintRulesInput = {
  readonly tsconfigRootDir: string
  /** A list left out lists no ruleset, as `init` writes `editorRulesets: {}`. */
  readonly agentRulesets: Partial<RulesetsInput>
  readonly editorRulesets: Partial<RulesetsInput>
  readonly ignores?: readonly string[]
  readonly allowSuppressions?: boolean
  readonly rules?: RuleSettingsInput
  readonly fileOverrides?: readonly TwoSetFileOverrideInput[]
}

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

/** The severity alone, or the one leading the options. */
export function severityOf(entry: RuleEntryInput): Severity {
  return typeof entry === 'string' ? entry : entry[0]
}

/** Null for a severity alone, which keeps the options in force. */
export function optionsGivenBy(entry: RuleEntryInput): readonly unknown[] | null {
  if (typeof entry === 'string') return null
  const [, ...options] = entry
  return options.length === 0 ? null : options
}

/** Null where it is left out, so the earlier mode stands. */
export function suppressionModeSetBy(allowSuppressions: boolean | undefined): SuppressionMode | null {
  if (allowSuppressions === undefined) return null
  return allowSuppressions ? 'allowed' : 'banned'
}

export function listedRulesetNames({ quality, libs, runtimes, languages = [] }: RulesetsInput): ReadonlySet<string> {
  return new Set([...quality, ...Object.values(libs).flat(), ...runtimes, ...languages])
}
