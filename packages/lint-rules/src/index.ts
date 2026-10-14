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
import { projectUsesOxlint } from './core/project-uses-oxlint.ts'
import { validateLintRules } from './core/validate-lint-rules.ts'

type RuleEntry = Severity | readonly [Severity, ...unknown[]]

/** `allowSuppressions` is the one place that sets the rules it decides. */
type SettableRuleId = Exclude<RuleId, SuppressionRuleId>

type RuleSettings = { readonly [id in SettableRuleId]?: RuleEntry }

type Rulesets = {
  readonly quality?: readonly QualityRulesetName[]
  readonly libs?: LibsRulesets
  readonly runtimes?: readonly RuntimeRulesetName[]
  readonly languages?: readonly LanguageRulesetName[]
}

type FileOverride = {
  readonly files: readonly string[]
  /** A list given here replaces the agent set's top-level one for these files; a list left out is inherited. */
  readonly agentRulesets?: Rulesets
  /** A list given here replaces the editor set's top-level one for these files; a list left out is inherited. */
  readonly editorRulesets?: Rulesets
  /** Whether sub-agents may add suppression comments to these files. Left out, the setting before this entry stands. */
  readonly allowSuppressions?: boolean
  readonly rules?: RuleSettings
}

/** The shape of `agents-inc.lint.mts`: only the rules this package ships, by their ESLint rule ID. */
export type LintRules = {
  /** The absolute path of an existing folder, where the typed rules find the project's tsconfigs: `import.meta.dirname`. */
  readonly tsconfigRootDir: string
  /** What sub-agents are checked against. A list left out lists no ruleset. */
  readonly agentRulesets: Rulesets
  /**
   * What a team merges into its own ESLint and oxlint configs, through `editorRulesets` on the
   * result. A list left out lists no ruleset.
   *
   * Your engine configs override the editor set. If your `eslint.config.mjs` or `oxlint.config.mts`
   * sets a rule anywhere (in any block or override, in a preset you extend, or through an oxlint
   * category you write on), the editor set drops that rule from both engines, in every file, and your
   * setting decides it. That includes a rule you only turn off, or set for some files. A core rule
   * and typescript-eslint's version of it count as one rule. Each merge reads your other engine's
   * config from the path you pass it.
   * oxlint's own `correctness: warn`, which runs where your oxlint config leaves correctness out,
   * sets no rule: where it would run oxlint's copy of a rule the editor set runs in ESLint, the
   * oxlint merge turns that copy off.
   */
  readonly editorRulesets: Rulesets
  readonly ignores?: readonly string[]
  /**
   * Whether sub-agents may add suppression comments (`eslint-disable*`, `oxlint-disable*`, inline
   * rule config, `@ts-expect-error` with a description). Default false: every one is reported. The
   * editor set always allows them.
   */
  readonly allowSuppressions?: boolean
  readonly rules?: RuleSettings
  readonly fileOverrides?: readonly FileOverride[]
}

/** What `defineLintRules` returns: the editor set's part for each engine, as plain data. */
type DefinedLintRules = {
  /** `oxlint` is undefined where the package.json nearest to `tsconfigRootDir` does not list oxlint. */
  readonly editorRulesets: EditorParts
}

// Not generic: a type parameter inferred from the argument let unknown names through.
export function defineLintRules(lintRules: LintRules): DefinedLintRules {
  validateLintRules(lintRules, catalog)
  const editorRulesets = editorPartsOf(lintRules, catalog, projectUsesOxlint(lintRules.tsconfigRootDir))
  recordAgentSettings(editorRulesets, projectedOnto('agentRulesets', lintRules))
  return { editorRulesets }
}
