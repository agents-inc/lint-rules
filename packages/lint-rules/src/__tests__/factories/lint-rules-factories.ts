import { mkdirSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { resolveRuleLayers } from '../../core/resolve-rule-layers.ts'
import type { validateLintRules } from '../../core/validate-lint-rules.ts'
import type { LintRules } from '../../index.ts'

/** Types are stripped when the consumer's config loads, so the core takes string-typed names it narrows at runtime. */
type LintRulesInput = Parameters<typeof resolveRuleLayers>[0]
type RulesetsInput = LintRulesInput['rulesets']
type FileOverrideInput = NonNullable<LintRulesInput['fileOverrides']>[number]

type TwoSetLintRulesInput = Parameters<typeof validateLintRules>[0]
type TwoSetRulesetsInput = TwoSetLintRulesInput['agentRulesets']
type TwoSetFileOverrideInput = NonNullable<TwoSetLintRulesInput['fileOverrides']>[number]

type Rulesets = LintRules['agentRulesets']

type RulesetSets = { readonly agentRulesets?: Partial<Rulesets>; readonly editorRulesets?: Partial<Rulesets> }

type TwoSetRulesetSets = {
  readonly agentRulesets?: Partial<TwoSetRulesetsInput>
  readonly editorRulesets?: Partial<TwoSetRulesetsInput>
}

type SharedFields = Partial<Omit<LintRules, 'tsconfigRootDir' | 'agentRulesets' | 'editorRulesets'>>

export type LintRulesPiece = Pick<SharedFields, 'rules' | 'fileOverrides'>

// One folder for every spec of a test file, in the file's own temp dir.
const EMPTY_TSCONFIG_ROOT_DIR_NAME = 'lint-rules-empty-tsconfig-root'

/** `tsconfigRootDir` must name an existing absolute folder; empty, so the project lists no oxlint and has no TS file. */
export const EMPTY_TSCONFIG_ROOT_DIR = existingEmptyFolder(join(tmpdir(), EMPTY_TSCONFIG_ROOT_DIR_NAME))

const NO_RULESETS = { quality: [], libs: {}, runtimes: [] } as const satisfies Rulesets

/** A ruleset added to the data and missing here turns gate-equivalence red; one removed is a type error. */
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

/** Lists left out are empty, so a spec names every ruleset its assertion depends on. */
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

export function buildConsumerLintRules(tsconfigRootDir: string, rulesetSets: RulesetSets, fields: SharedFields = {}): LintRules {
  return { tsconfigRootDir, ...buildConsumerSettings(rulesetSets, fields) }
}

/** Leaves out `tsconfigRootDir`, for a file that gives it as `import.meta.dirname`, as `init` writes it. */
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

/** A list left out of a given set is empty; a set left out leaves every list out. */
export function buildConsumerLintRulesLeavingListsOut(
  tsconfigRootDir: string,
  { agentRulesets = {}, editorRulesets = {} }: RulesetSets,
  fields: SharedFields = {},
): LintRules {
  return { tsconfigRootDir, agentRulesets, editorRulesets, ...fields }
}

/** The types refuse it; stripped of them, it reaches the runtime check. */
export function buildConsumerLintRulesWithoutTsconfigRootDir(): Omit<LintRules, 'tsconfigRootDir'> {
  return { agentRulesets: EVERY_RULESET, editorRulesets: EVERY_RULESET }
}

/** A later piece's setting of a rule wins, and entries keep the order given. */
export function buildConsumerLintRulesFrom(tsconfigRootDir: string, pieces: readonly LintRulesPiece[]): LintRules {
  const rules = pieces.reduce<NonNullable<LintRules['rules']>>((joined, { rules: pieceRules = {} }) => ({ ...joined, ...pieceRules }), {})
  const fileOverrides = pieces.flatMap(({ fileOverrides: entries = [] }) => entries)
  return buildConsumerLintRules(tsconfigRootDir, {}, { rules, fileOverrides })
}

function qualityRulesetInBothSets(ruleset: NonNullable<Rulesets['quality']>[number]): RulesetSets {
  return { agentRulesets: { quality: [ruleset] }, editorRulesets: { quality: [ruleset] } }
}

export const MODULES_IN_BOTH_SETS = qualityRulesetInBothSets('modules')
export const CORRECTNESS_IN_BOTH_SETS = qualityRulesetInBothSets('correctness')
export const REDUNDANCY_IN_BOTH_SETS = qualityRulesetInBothSets('redundancy')

export function buildEveryRulesetLintRules(tsconfigRootDir: string, fields: SharedFields = {}): LintRules {
  return { tsconfigRootDir, agentRulesets: EVERY_RULESET, editorRulesets: EVERY_RULESET, ...fields }
}

/** The types refuse it; stripped of them, it reaches the runtime check. */
export function buildConsumerLintRulesWithoutEditorRulesets(tsconfigRootDir: string): Omit<LintRules, 'editorRulesets'> {
  return { tsconfigRootDir, agentRulesets: EVERY_RULESET }
}

/** The types refuse it; stripped of them, it reaches the runtime check. */
export function buildConsumerLintRulesWithoutAgentRulesets(tsconfigRootDir: string): Omit<LintRules, 'agentRulesets'> {
  return { tsconfigRootDir, editorRulesets: EVERY_RULESET }
}

/** Throws where the folder holds anything, which could give a spec a package.json or a TS file. */
function existingEmptyFolder(path: string): string {
  mkdirSync(path, { recursive: true })
  const entries = readdirSync(path)
  if (entries.length > 0) throw new Error(`${path} should be empty, and holds ${entries.join(', ')}`)
  return path
}
