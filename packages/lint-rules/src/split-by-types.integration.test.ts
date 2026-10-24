import { catalog, routeOf } from '@workspace/rule-data'
import { ESLint, type Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import { buildFileOverride, buildLintRules, buildTwoSetFileOverride, buildTwoSetLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { lintRulesPackageVersion } from './__tests__/factories/package-json-factories.ts'
import { buildProjectFacts } from './__tests__/factories/project-facts-factories.ts'
import { buildTeamBlockSwitchingTypesOffAsDisableTypeCheckedDoes, buildTeamTypedEslintBlock } from './__tests__/factories/team-config-factories.ts'
import { buildTsconfig } from './__tests__/factories/tsconfig-factories.ts'
import { NO_RULE_SET_BY_THE_TEAMS_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'
import { buildEslintConfig } from './core/build-eslint-config.ts'
import { editorPartsOf } from './core/editor-parts.ts'
import type { LintRulesInput, TwoSetLintRulesInput } from './core/lint-rules-input.ts'
import { mergeEslintPart } from './core/merge-eslint-config.ts'
import { projectFactsOf } from './core/project-facts.ts'
import { eslintPluginRegistry } from './eslint-plugin-registry.ts'

// Where an untyped rule and its typed partner are both on, the untyped one is off wherever our typed
// blocks run the typed one, so each file gets one report; it keeps its setting in any layer where the
// typed one is off. Blocks layer, so three pitfalls get a case each.

/** Each pair's code, one finding each, on the line given: the same lines in each file's TS and JS form. */
const TS_SOURCE = `export function isOn(flag: boolean): boolean {
  return Boolean(flag) === true
}
export function run(): number {
  if (true) {
    return 1
  }
  return 2
}
export function fail(): never {
  throw 'x'
}
`
const JS_SOURCE = `export function isOn(flag) {
  return Boolean(flag) === true
}
export function run() {
  if (true) {
    return 1
  }
  return 2
}
export function fail() {
  throw 'x'
}
`
const FILES = {
  typedTs: 'src/a.ts',
  js: 'src/a.js',
  untypedTs: 'scripts/a.ts',
  legacyTypedTs: 'legacy/a.ts',
  legacyJs: 'legacy/a.js',
  featureTypedTs: 'src/feature/a.ts',
  featureJs: 'src/feature/a.js',
} as const
const LEGACY_FILES = 'legacy/**'
const FEATURE_FILES = 'src/feature/**'
const SRC_FILES = 'src/**'
const ERROR = 2
const SEVERITY_NAMES: Readonly<Record<number, string>> = { 1: 'warn', 2: 'error' }

/** An untyped rule and the typed rule it is off beside wherever that one runs with type information. */
type SplitByTypesPair = { readonly untyped: string; readonly typed: string }

// The untyped rule of each pair: the catalog gives the typed one, read in each test.
/** Both in redundancy, both run by ESLint. `flag === true` draws each, where flag is a boolean. */
const BOOLEAN_COMPARISON = 'unicorn/no-unnecessary-boolean-comparison'
/** The untyped rule in correctness, the typed one in redundancy. `if (true)` draws each. */
const CONSTANT_CONDITION = 'no-constant-condition'
/** Both in correctness, both run by ESLint, and typescript-eslint's extension of the core rule. `throw 'x'` draws each. */
const THROW_LITERAL = 'no-throw-literal'

/** The untyped rule and the typed rule the catalog records it split by types with. */
function pairSplitting(untyped: string): SplitByTypesPair {
  const { shipped } = routeOf(untyped, catalog)
  if (shipped === null || shipped.splitByTypesWith === null) throw new Error(`${untyped}: the catalog records no typed rule it is split by types with`)
  return { untyped, typed: shipped.splitByTypesWith }
}

const tempProjects = setUpTempProjects()
// The tsconfig takes in src/ and legacy/, so scripts/a.ts is a TS file outside every tsconfig.
const PROJECT_DIR = tempProjects.create({
  files: {
    'tsconfig.json': JSON.stringify(buildTsconfig({ include: ['src', 'legacy'] })),
    ...Object.fromEntries(Object.values(FILES).map((file) => [file, file.endsWith('.ts') ? TS_SOURCE : JS_SOURCE])),
  },
})

/** Each file's findings of the pair's two rules, as `line rule severity`, sorted. */
type PairFindings = Readonly<Record<string, readonly string[]>>

async function pairFindingsWith(config: Linter.Config[], { untyped, typed }: SplitByTypesPair, files: readonly string[]): Promise<PairFindings> {
  const results = await new ESLint({ cwd: PROJECT_DIR, overrideConfigFile: true, overrideConfig: config }).lintFiles([...files])
  return Object.fromEntries(
    files.map((file) => {
      const result = results.find(({ filePath }) => filePath.endsWith(`/${file}`))
      if (result === undefined) throw new Error(`ESLint did not lint ${file}`)
      const fatal = result.messages.filter(({ fatal: isFatal }) => isFatal === true).map(({ message }) => `fatal: ${message}`)
      const ofThePair = result.messages
        .filter(({ ruleId }) => ruleId === untyped || ruleId === typed)
        .map(({ line, ruleId, severity }) => `${String(line)} ${String(ruleId)} ${severityNameOf(severity)}`)
      return [file, [...fatal, ...ofThePair].toSorted()]
    }),
  )
}

function severityNameOf(severity: number): string {
  const name = SEVERITY_NAMES[severity]
  if (name === undefined) throw new Error(`ESLint reported a message at severity ${String(severity)}`)
  return name
}

/** The pair's finding on its line, by the rule given, at error unless given. */
function finding(pair: SplitByTypesPair, by: 'untyped' | 'typed', severity: number = ERROR): string {
  return `${String(LINE_OF[pair.untyped])} ${pair[by]} ${severityNameOf(severity)}`
}

const LINE_OF: Readonly<Record<string, number>> = {
  [BOOLEAN_COMPARISON]: 2,
  [CONSTANT_CONDITION]: 5,
  [THROW_LITERAL]: 11,
}

function agentBuildOf(lintRules: LintRulesInput): Linter.Config[] {
  return buildEslintConfig(lintRules, catalog, eslintPluginRegistry, buildProjectFacts({ isOutsideEveryTsconfig: projectFactsOf(PROJECT_DIR).isOutsideEveryTsconfig }))
}

function rootedAtTheProject(lintRules: LintRulesInput): LintRulesInput {
  return { ...lintRules, tsconfigRootDir: PROJECT_DIR }
}

const REDUNDANCY = { quality: ['redundancy'] }

describe('a pair split by types, in the agent build', () => {
  it("draws one report per file: the typed rule's in a typed TS file, the untyped rule's in a JS file and in a TS file outside every tsconfig", async () => {
    const pair = pairSplitting(BOOLEAN_COMPARISON)
    const config = agentBuildOf(rootedAtTheProject(buildLintRules(REDUNDANCY)))

    expect(await pairFindingsWith(config, pair, [FILES.typedTs, FILES.js, FILES.untypedTs])).toStrictEqual({
      [FILES.typedTs]: [finding(pair, 'typed')],
      [FILES.js]: [finding(pair, 'untyped')],
      [FILES.untypedTs]: [finding(pair, 'untyped')],
    })
  })

  it('runs the untyped rule in a typed TS file where the rules turn the typed rule off', async () => {
    const pair = pairSplitting(BOOLEAN_COMPARISON)
    const config = agentBuildOf(rootedAtTheProject(buildLintRules(REDUNDANCY, { rules: { [pair.typed]: 'off' } })))

    expect(await pairFindingsWith(config, pair, [FILES.typedTs, FILES.js])).toStrictEqual({
      [FILES.typedTs]: [finding(pair, 'untyped')],
      [FILES.js]: [finding(pair, 'untyped')],
    })
  })

  // Pitfall 2: the entry states nothing of the untyped rule, so the top level's typed block, which
  // states it off, would stand in the entry's typed files.
  it("runs the untyped rule in the typed TS files of an entry turning the typed rule off, and the typed rule elsewhere", async () => {
    const pair = pairSplitting(BOOLEAN_COMPARISON)
    const config = agentBuildOf(rootedAtTheProject(buildLintRules(REDUNDANCY, { fileOverrides: [buildFileOverride([LEGACY_FILES], { rules: { [pair.typed]: 'off' } })] })))

    expect(await pairFindingsWith(config, pair, [FILES.typedTs, FILES.legacyTypedTs, FILES.legacyJs])).toStrictEqual({
      [FILES.typedTs]: [finding(pair, 'typed')],
      [FILES.legacyTypedTs]: [finding(pair, 'untyped')],
      [FILES.legacyJs]: [finding(pair, 'untyped')],
    })
  })

  // Pitfall 1: the entry's plain block comes after the top level's typed block, so the untyped rule
  // it restates would run beside the typed rule in the entry's typed files.
  it("runs the typed rule alone in the typed TS files of an entry setting the untyped rule to warn, and the untyped rule at warn in its JS files", async () => {
    const pair = pairSplitting(BOOLEAN_COMPARISON)
    const config = agentBuildOf(rootedAtTheProject(buildLintRules(REDUNDANCY, { fileOverrides: [buildFileOverride([FEATURE_FILES], { rules: { [pair.untyped]: 'warn' } })] })))

    expect(await pairFindingsWith(config, pair, [FILES.featureTypedTs, FILES.featureJs, FILES.typedTs])).toStrictEqual({
      [FILES.featureTypedTs]: [finding(pair, 'typed')],
      [FILES.featureJs]: [finding(pair, 'untyped', 1)],
      [FILES.typedTs]: [finding(pair, 'typed')],
    })
  })

  it("splits them in the files of an entry adding the typed rule's ruleset, which the top level lacks, and runs neither elsewhere", async () => {
    const pair = pairSplitting(BOOLEAN_COMPARISON)
    const config = agentBuildOf(rootedAtTheProject(buildLintRules({}, { fileOverrides: [buildFileOverride([SRC_FILES], { rulesets: REDUNDANCY })] })))

    expect(await pairFindingsWith(config, pair, [FILES.typedTs, FILES.js, FILES.untypedTs, FILES.legacyTypedTs])).toStrictEqual({
      [FILES.typedTs]: [finding(pair, 'typed')],
      [FILES.js]: [finding(pair, 'untyped')],
      [FILES.untypedTs]: [],
      [FILES.legacyTypedTs]: [],
    })
  })
})

describe('a pair split by types across two rulesets, in the agent build', () => {
  it("runs the untyped rule in the typed TS files of an entry dropping the typed rule's ruleset, and the typed rule alone in the other typed TS files", async () => {
    const pair = pairSplitting(CONSTANT_CONDITION)
    const config = agentBuildOf(
      rootedAtTheProject(buildLintRules({ quality: ['correctness', 'redundancy'] }, { fileOverrides: [buildFileOverride([LEGACY_FILES], { rulesets: { quality: ['correctness'] } })] })),
    )

    expect(await pairFindingsWith(config, pair, [FILES.typedTs, FILES.js, FILES.legacyTypedTs, FILES.legacyJs])).toStrictEqual({
      [FILES.typedTs]: [finding(pair, 'typed')],
      [FILES.js]: [finding(pair, 'untyped')],
      [FILES.legacyTypedTs]: [finding(pair, 'untyped')],
      [FILES.legacyJs]: [finding(pair, 'untyped')],
    })
  })
})

// throw 'x' draws exactly one report, whichever kind of file it is in.
describe("throw 'x', our correctness ruleset on, in the agent build", () => {
  it("draws only-throw-error alone in a typed TS file, and no-throw-literal alone in a JS file and in a TS file outside every tsconfig", async () => {
    const pair = pairSplitting(THROW_LITERAL)
    const config = agentBuildOf(rootedAtTheProject(buildLintRules({ quality: ['correctness'] })))

    expect(await pairFindingsWith(config, pair, [FILES.typedTs, FILES.js, FILES.untypedTs])).toStrictEqual({
      [FILES.typedTs]: [finding(pair, 'typed')],
      [FILES.js]: [finding(pair, 'untyped')],
      [FILES.untypedTs]: [finding(pair, 'untyped')],
    })
  })
})

// Pitfall 3: where a team block takes type information away, our copy of a typed block states its
// typed rules off there; it must state the untyped rule at its setting, not off.
describe('a pair split by types, merged into a team config that gives type information and takes it away in legacy/**', () => {
  const teamConfig = [
    buildTeamTypedEslintBlock('team-typed', 'projectService', { files: ['**/*.ts'] }),
    buildTeamBlockSwitchingTypesOffAsDisableTypeCheckedDoes('team-untyped', { files: [LEGACY_FILES] }),
  ]

  function mergedOf(lintRules: TwoSetLintRulesInput): Linter.Config[] {
    const { eslint } = editorPartsOf({ ...lintRules, tsconfigRootDir: PROJECT_DIR }, catalog, false)
    return mergeEslintPart(teamConfig, eslint, catalog, eslintPluginRegistry, lintRulesPackageVersion(), NO_RULE_SET_BY_THE_TEAMS_OXLINT_CONFIG)
  }

  it("runs the typed rule alone where the team's types are, and the untyped rule where it takes them away and in JS files", async () => {
    const pair = pairSplitting(BOOLEAN_COMPARISON)
    const config = mergedOf(buildTwoSetLintRules({ editorRulesets: REDUNDANCY }))

    expect(await pairFindingsWith(config, pair, [FILES.typedTs, FILES.legacyTypedTs, FILES.js])).toStrictEqual({
      [FILES.typedTs]: [finding(pair, 'typed')],
      [FILES.legacyTypedTs]: [finding(pair, 'untyped')],
      [FILES.js]: [finding(pair, 'untyped')],
    })
  })

  it("runs the untyped rule at an entry's setting where the team takes types away, and the typed rule alone in the entry's typed files", async () => {
    const pair = pairSplitting(BOOLEAN_COMPARISON)
    const config = mergedOf(buildTwoSetLintRules({ editorRulesets: REDUNDANCY }, { fileOverrides: [buildTwoSetFileOverride([LEGACY_FILES, FEATURE_FILES], { rules: { [pair.untyped]: 'warn' } })] }))

    expect(await pairFindingsWith(config, pair, [FILES.legacyTypedTs, FILES.featureTypedTs])).toStrictEqual({
      [FILES.legacyTypedTs]: [finding(pair, 'untyped', 1)],
      [FILES.featureTypedTs]: [finding(pair, 'typed')],
    })
  })
})
