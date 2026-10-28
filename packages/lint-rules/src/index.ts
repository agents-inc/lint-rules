import {
  catalog,
  type LanguageRulesetName,
  type LibsRulesets,
  type QualityRulesetName,
  type RuleId,
  type RuntimeRulesetName,
  type SuppressionRuleId,
} from '@workspace/rule-data'
import { recordAgentSettings } from './agent-settings.ts'
import { type EditorParts, editorPartsOf } from './core/editor-parts.ts'
import { projectedOnto, type Severity } from './core/lint-rules-input.ts'
import { doesProjectUseOxlint } from './core/project-uses-oxlint.ts'
import { refuseATsconfigRootDirThatIsNoFolder } from './core/tsconfig-root-dir-folder.ts'

type RuleEntry = Severity | readonly [Severity, ...unknown[]]

/** Every rule ID but the ones `allowSuppressions` sets. */
type SettableRuleId = Exclude<RuleId, SuppressionRuleId>

/** The entry a rule takes, or, for a name it may not set, why. */
type RuleSettingOf<Id extends string> = Id extends SuppressionRuleId
  ? `${Id} is set by allowSuppressions`
  : Id extends SettableRuleId
    ? RuleEntry
    : `no shipped rule is called ${Id}`

type RuleSettings<Id extends string> = { readonly [id in Id]?: RuleSettingOf<id> }

type LibsDomain = keyof LibsRulesets

/** The rulesets a domain lists, or, for a name no libs domain has, why: a one-name list, so it is still a list of names. */
type DomainListOf<Domain extends string> = Domain extends LibsDomain
  ? NonNullable<LibsRulesets[Domain]>
  : readonly [`no libs domain is called ${Domain}`]

type LibsOf<Domain extends string> = { readonly [domain in Domain]?: DomainListOf<domain> }

/** Led by `/` (POSIX) or `\\` (a Windows share), or holding a Windows drive's `:\` or `:/`. */
type AbsolutePathWrittenOut = `/${string}` | `\\\\${string}` | `${string}:\\${string}` | `${string}:/${string}`

/** A `string`, such as `import.meta.dirname`, is left to the check made as the config loads. */
type AbsolutePath<Root extends string> = string extends Root
  ? Root
  : Root extends AbsolutePathWrittenOut
    ? Root
    : 'tsconfigRootDir is an absolute path: write import.meta.dirname'

type Rulesets<Domain extends string> = {
  readonly quality?: readonly QualityRulesetName[]
  readonly libs?: LibsOf<Domain>
  readonly runtimes?: readonly RuntimeRulesetName[]
  readonly languages?: readonly LanguageRulesetName[]
}

/** Neither engine reads a glob led by `/` as any file, so the types turn it into what to write instead. */
type FileGlob<Glob extends string> = Glob extends `/${infer FromTheRoot}` ? `files can't start with /: write ./${FromTheRoot}` : Glob

type AtLeastOneFileGlob<Glob extends string> = readonly [FileGlob<Glob>, ...FileGlob<Glob>[]]

type FileOverride<Glob extends string, AgentDomain extends string, EditorDomain extends string, Id extends string> = {
  /**
   * At least one glob, read from the config's folder, none led by `/`: `./x.ts` names the `x.ts` there.
   * A list held in a `string[]` may be empty, so write it inline or `as const`.
   */
  readonly files: AtLeastOneFileGlob<Glob>
  /** Replaces the top-level agent lists given here for these files; lists left out are inherited. */
  readonly agentRulesets?: Rulesets<AgentDomain>
  /** Replaces the top-level editor lists given here for these files; lists left out are inherited. */
  readonly editorRulesets?: Rulesets<EditorDomain>
  /** Whether sub-agents may add suppression comments to these files. Left out, the earlier setting stands. */
  readonly allowSuppressions?: boolean
  readonly rules?: RuleSettings<Id>
}

/**
 * The shape of `agents-inc.lint.mts`: only the rules this package ships, by their ESLint rule ID.
 * Each type parameter is the names written in one place, which `defineLintRules` infers: the entries' `files`
 * globs, `tsconfigRootDir`, each set's libs domains, and the rule IDs, at the top level and in the entries.
 * Left to their defaults, the rule IDs name the rules `allowSuppressions` sets too, so a value typed `LintRules`
 * refuses them in a const it holds. It checks such a const only on the names both its type and the const's list, so an
 * unknown name beside a known one goes unchecked, and so does every name and value under an index signature
 * (`Record<string, …>`, what `Object.fromEntries` returns), those rules included.
 */
export type LintRules<
  Glob extends string = string,
  Root extends string = string,
  AgentDomain extends string = LibsDomain,
  EditorDomain extends string = LibsDomain,
  Id extends string = RuleId,
  EntryAgentDomain extends string = LibsDomain,
  EntryEditorDomain extends string = LibsDomain,
  EntryId extends string = RuleId,
> = {
  /** The folder where typed rules find the project's tsconfigs; usually `import.meta.dirname`. */
  readonly tsconfigRootDir: AbsolutePath<Root>
  /** The rulesets sub-agents are checked against. */
  readonly agentRulesets: Rulesets<AgentDomain>
  /**
   * The rulesets merged into your own ESLint and oxlint configs. A rule your engine configs set
   * anywhere, even only off or for some files, is left to your setting in both engines.
   */
  readonly editorRulesets: Rulesets<EditorDomain>
  /** Files our rules skip, each read as a .gitignore line: `legacy/` is every `legacy` folder, `/a.js` the root `a.js` only. */
  readonly ignores?: readonly string[]
  /** Whether sub-agents may add suppression comments (`eslint-disable*`, `@ts-expect-error`, ...). Default false; the editor set always allows them. */
  readonly allowSuppressions?: boolean
  readonly rules?: RuleSettings<Id>
  readonly fileOverrides?: ReadonlyArray<FileOverride<Glob, EntryAgentDomain, EntryEditorDomain, EntryId>>
}

/** `LintRules` as the code below reads it: every rule ID it names takes a rule entry, as in the input types. */
type LintRulesRead = LintRules<string, string, LibsDomain, LibsDomain, SettableRuleId, LibsDomain, LibsDomain, SettableRuleId>

type DefinedLintRules = {
  /** The editor set's part for each engine; `oxlint` is undefined where the project does not list oxlint. */
  readonly editorRulesets: EditorParts
}

// TypeScript checks an object's keys against its type only where the object is written in place, so the names of
// each place `LintRules` lists are a type parameter inferred from that place alone, which the types check name by
// name, in a const given there too. A parameter two places shared would also take the names a value typed `LintRules`
// gives the other place, as a typed entry does for the entries beside it; one for the whole argument lets unknown names
// through. A value typed `LintRules` gives its own place every name and checks a const it holds only on the names both
// its type and the const's list, so of those names it refuses only the rules `allowSuppressions` sets, and not under an
// index signature, whose type lists no name (KNOWN GAP in define-lint-rules.test-d.ts). The argument is a
// `LintRulesRead` too, since TypeScript cannot tell that the generic one fits the input types the code below reads.
export function defineLintRules<
  Glob extends string,
  Root extends string,
  AgentDomain extends string,
  EditorDomain extends string,
  Id extends string,
  EntryAgentDomain extends string,
  EntryEditorDomain extends string,
  EntryId extends string,
>(
  lintRules: LintRules<Glob, Root, AgentDomain, EditorDomain, Id, EntryAgentDomain, EntryEditorDomain, EntryId> & LintRulesRead,
): DefinedLintRules {
  refuseATsconfigRootDirThatIsNoFolder(lintRules.tsconfigRootDir)
  const editorRulesets = editorPartsOf(lintRules, catalog, doesProjectUseOxlint(lintRules.tsconfigRootDir))
  recordAgentSettings(editorRulesets, projectedOnto('agentRulesets', lintRules))
  return { editorRulesets }
}
