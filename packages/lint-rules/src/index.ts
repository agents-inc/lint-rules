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
  /** Replaces the top-level agent lists given here for these files; lists left out are inherited. */
  readonly agentRulesets?: Rulesets
  /** Replaces the top-level editor lists given here for these files; lists left out are inherited. */
  readonly editorRulesets?: Rulesets
  /** Whether sub-agents may add suppression comments to these files. Left out, the earlier setting stands. */
  readonly allowSuppressions?: boolean
  readonly rules?: RuleSettings
}

/** The shape of `agents-inc.lint.mts`: only the rules this package ships, by their ESLint rule ID. */
export type LintRules = {
  /** The folder where typed rules find the project's tsconfigs; usually `import.meta.dirname`. */
  readonly tsconfigRootDir: string
  /** The rulesets sub-agents are checked against. */
  readonly agentRulesets: Rulesets
  /**
   * The rulesets merged into your own ESLint and oxlint configs. A rule your engine configs set
   * anywhere, even only off or for some files, is left to your setting in both engines.
   */
  readonly editorRulesets: Rulesets
  /** Files our rules skip, each read as a .gitignore line: `legacy/` is every `legacy` folder, `/a.js` the root `a.js` only. */
  readonly ignores?: readonly string[]
  /** Whether sub-agents may add suppression comments (`eslint-disable*`, `@ts-expect-error`, ...). Default false; the editor set always allows them. */
  readonly allowSuppressions?: boolean
  readonly rules?: RuleSettings
  readonly fileOverrides?: readonly FileOverride[]
}

type DefinedLintRules = {
  /** The editor set's part for each engine; `oxlint` is undefined where the project does not list oxlint. */
  readonly editorRulesets: EditorParts
}

// Not generic: a type parameter inferred from the argument let unknown names through.
export function defineLintRules(lintRules: LintRules): DefinedLintRules {
  validateLintRules(lintRules, catalog)
  const editorRulesets = editorPartsOf(lintRules, catalog, projectUsesOxlint(lintRules.tsconfigRootDir))
  recordAgentSettings(editorRulesets, projectedOnto('agentRulesets', lintRules))
  return { editorRulesets }
}
