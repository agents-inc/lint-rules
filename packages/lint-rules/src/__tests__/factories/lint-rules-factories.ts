import { mkdirSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { resolveRuleLayers } from '../../core/resolve-rule-layers.ts'
import type { validateLintRules } from '../../core/validate-lint-rules.ts'
import type { LintRules } from '../../index.ts'

/**
 * The core takes the consumer's config in a string-typed shape: types are stripped when
 * `agents-inc.lint.mts` loads, so the core narrows names at runtime, and a spec can hand it an
 * unknown name without a cast. `LintRules` is the strictly typed shape a consumer writes.
 *
 * Two string-typed shapes: the two-set one `validateLintRules` reads (`agentRulesets` and
 * `editorRulesets`), and the single-set one the builders and `resolveRuleLayers` read, which is
 * one set projected onto `rulesets`.
 */
type LintRulesInput = Parameters<typeof resolveRuleLayers>[0]
type RulesetsInput = LintRulesInput['rulesets']
type FileOverrideInput = NonNullable<LintRulesInput['fileOverrides']>[number]

type TwoSetLintRulesInput = Parameters<typeof validateLintRules>[0]
type TwoSetRulesetsInput = TwoSetLintRulesInput['agentRulesets']
type TwoSetFileOverrideInput = NonNullable<TwoSetLintRulesInput['fileOverrides']>[number]

type Rulesets = LintRules['agentRulesets']

/** The sets a spec names; a set left out lists no ruleset. */
type RulesetSets = { readonly agentRulesets?: Partial<Rulesets>; readonly editorRulesets?: Partial<Rulesets> }

type TwoSetRulesetSets = {
  readonly agentRulesets?: Partial<TwoSetRulesetsInput>
  readonly editorRulesets?: Partial<TwoSetRulesetsInput>
}

type SharedFields = Partial<Omit<LintRules, 'tsconfigRootDir' | 'agentRulesets' | 'editorRulesets'>>

/** The settings a piece of a consumer's file adds: rules, and entries. */
export type LintRulesPiece = Pick<SharedFields, 'rules' | 'fileOverrides'>

// One folder for every spec of a test file, in the file's own temp dir.
const EMPTY_TSCONFIG_ROOT_DIR_NAME = 'lint-rules-empty-tsconfig-root'

/**
 * An existing folder that holds nothing: no package.json, so the project lists no oxlint, and no TS
 * file. `tsconfigRootDir` must name an existing folder by an absolute path (decisions.md, 2026-10-14
 * "real run 3 ... triage"), so a spec that reads no file still gives one.
 */
export const EMPTY_TSCONFIG_ROOT_DIR = existingEmptyFolder(join(tmpdir(), EMPTY_TSCONFIG_ROOT_DIR_NAME))

const NO_RULESETS = { quality: [], libs: {}, runtimes: [] } as const satisfies Rulesets

/**
 * Every ruleset of the real catalog listed, the opt-in ones too, as a team that lists them writes
 * the file. A ruleset added to the data and missing here turns gate-equivalence red; a name removed
 * from it is a type error.
 */
export const EVERY_RULESET = {
  quality: [
    'correctness',
    'type-safety',
    'security',
    'accessibility',
    'performance',
    'complexity',
    'declarative',
    'immutability',
    'modern-js',
    'redundancy',
    'modules',
    'import-order',
    'naming',
    'comments',
    'ordering',
    'conventions',
    'tests',
  ],
  libs: {
    ui: ['react'],
    testing: ['vitest', 'testing-library', 'storybook'],
    forms: ['react-hook-form'],
    styling: ['css-modules', 'class-names'],
  },
  runtimes: ['node', 'browser'],
  languages: [],
} as const satisfies Rulesets

/** The single-set shape the core builds from. Lists left out are empty, so a spec names every ruleset its assertion depends on. */
export function buildLintRules(
  rulesets: Partial<RulesetsInput>,
  fields: Partial<Omit<LintRulesInput, 'rulesets'>> = {},
): LintRulesInput {
  return {
    tsconfigRootDir: EMPTY_TSCONFIG_ROOT_DIR,
    rulesets: { quality: [], libs: {}, runtimes: [], ...rulesets },
    ...fields,
  }
}

export function buildFileOverride(
  files: readonly string[],
  fields: Omit<FileOverrideInput, 'files'>,
): FileOverrideInput {
  return { files, ...fields }
}

/** The two-set shape `validateLintRules` reads. A set left out lists no ruleset. */
export function buildTwoSetLintRules(
  { agentRulesets = {}, editorRulesets = {} }: TwoSetRulesetSets,
  fields: Partial<Omit<TwoSetLintRulesInput, 'agentRulesets' | 'editorRulesets'>> = {},
): TwoSetLintRulesInput {
  return {
    tsconfigRootDir: EMPTY_TSCONFIG_ROOT_DIR,
    agentRulesets: { quality: [], libs: {}, runtimes: [], ...agentRulesets },
    editorRulesets: { quality: [], libs: {}, runtimes: [], ...editorRulesets },
    ...fields,
  }
}

export function buildTwoSetFileOverride(
  files: readonly string[],
  fields: Omit<TwoSetFileOverrideInput, 'files'>,
): TwoSetFileOverrideInput {
  return { files, ...fields }
}

/** The strictly typed shape a consumer writes, for the public entries. A set left out lists no ruleset. */
export function buildConsumerLintRules(tsconfigRootDir: string, rulesetSets: RulesetSets, fields: SharedFields = {}): LintRules {
  return { tsconfigRootDir, ...buildConsumerSettings(rulesetSets, fields) }
}

/**
 * The strictly typed shape a consumer writes, but `tsconfigRootDir`, for a file that gives it as
 * `import.meta.dirname`, as `init` writes it. A set left out lists no ruleset.
 */
export function buildConsumerSettings(
  { agentRulesets = {}, editorRulesets = {} }: RulesetSets,
  fields: SharedFields = {},
): Omit<LintRules, 'tsconfigRootDir'> {
  return {
    agentRulesets: { ...NO_RULESETS, ...agentRulesets },
    editorRulesets: { ...NO_RULESETS, ...editorRulesets },
    ...fields,
  }
}

/**
 * A consumer's file whose sets give only the lists given, as plan.md's `editorRulesets: {}` does: a
 * list left out of a top-level set is empty (decisions.md, 2026-10-14 "real run 3 ... triage"). A set
 * left out of the arguments leaves every list out.
 */
export function buildConsumerLintRulesLeavingListsOut(
  tsconfigRootDir: string,
  { agentRulesets = {}, editorRulesets = {} }: RulesetSets,
  fields: SharedFields = {},
): LintRules {
  return { tsconfigRootDir, agentRulesets, editorRulesets, ...fields }
}

/** A consumer's file that leaves out `tsconfigRootDir`: the types refuse it, and stripped of them it reaches the runtime check. */
export function buildConsumerLintRulesWithoutTsconfigRootDir(): Omit<LintRules, 'tsconfigRootDir'> {
  return { agentRulesets: EVERY_RULESET, editorRulesets: EVERY_RULESET }
}

/**
 * A consumer's file listing no ruleset, its `rules` and `fileOverrides` joined from pieces in order:
 * a later piece's setting of a rule wins, and entries keep the order given.
 */
export function buildConsumerLintRulesFrom(tsconfigRootDir: string, pieces: readonly LintRulesPiece[]): LintRules {
  const rules = pieces.reduce<NonNullable<LintRules['rules']>>((joined, { rules: pieceRules = {} }) => ({ ...joined, ...pieceRules }), {})
  const fileOverrides = pieces.flatMap(({ fileOverrides: entries = [] }) => entries)
  return buildConsumerLintRules(tsconfigRootDir, {}, { rules, fileOverrides })
}

/** One quality ruleset, listed in both the agent and the editor set. */
function qualityRulesetInBothSets(ruleset: NonNullable<Rulesets['quality']>[number]): RulesetSets {
  return { agentRulesets: { quality: [ruleset] }, editorRulesets: { quality: [ruleset] } }
}

export const MODULES_IN_BOTH_SETS = qualityRulesetInBothSets('modules')
export const CORRECTNESS_IN_BOTH_SETS = qualityRulesetInBothSets('correctness')
export const REDUNDANCY_IN_BOTH_SETS = qualityRulesetInBothSets('redundancy')

/** Every ruleset listed in both sets, as `init` writes the file. */
export function buildEveryRulesetLintRules(tsconfigRootDir: string, fields: SharedFields = {}): LintRules {
  return { tsconfigRootDir, agentRulesets: EVERY_RULESET, editorRulesets: EVERY_RULESET, ...fields }
}

/** A consumer's file that leaves out `editorRulesets`: the types refuse it, and stripped of them it reaches the runtime check. */
export function buildConsumerLintRulesWithoutEditorRulesets(tsconfigRootDir: string): Omit<LintRules, 'editorRulesets'> {
  return { tsconfigRootDir, agentRulesets: EVERY_RULESET }
}

/** A consumer's file that leaves out `agentRulesets`: the types refuse it, and stripped of them it reaches the runtime check. */
export function buildConsumerLintRulesWithoutAgentRulesets(tsconfigRootDir: string): Omit<LintRules, 'agentRulesets'> {
  return { tsconfigRootDir, editorRulesets: EVERY_RULESET }
}

/** The folder, made where it is missing: throws where it holds anything, which could give a spec a package.json or a TS file. */
function existingEmptyFolder(path: string): string {
  mkdirSync(path, { recursive: true })
  const entries = readdirSync(path)
  if (entries.length > 0) throw new Error(`${path} should be empty, and holds ${entries.join(', ')}`)
  return path
}
