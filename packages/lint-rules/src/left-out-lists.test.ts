import { describe, expect, it } from 'vitest'
import { agentConfigsOf } from './__tests__/agent-configs.ts'
import { setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import {
  buildConsumerLintRules,
  buildConsumerLintRulesLeavingListsOut,
  buildConsumerLintRulesWithoutEditorRulesets,
  EMPTY_TSCONFIG_ROOT_DIR,
} from './__tests__/factories/lint-rules-factories.ts'
import { createProjectListingOxlint } from './__tests__/factories/package-json-factories.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'
import { defineLintRules, type LintRules } from './index.ts'

// A top-level set (agentRulesets, editorRulesets) with a list left out means that list is empty, as
// inside a fileOverrides entry (decisions.md, 2026-10-14 "real run 3 ... triage"). plan.md's
// `editorRulesets: {}`, what `init` writes, stopped defineLintRules with "quality is not iterable".
// Each set leaving lists out owes what the same set giving them empty gives.

type Rulesets = LintRules['agentRulesets']

/** A set as a consumer may write it at the top level, lists left out, and which lists that leaves out. */
type SetLeavingListsOut = { readonly leftOut: string; readonly set: Partial<Rulesets> }

const tempProjects = setUpTempProjects()
const PROJECT_WITH_OXLINT = createProjectListingOxlint(tempProjects)

const PROJECTS = [
  { project: 'whose package.json lists oxlint', projectDir: PROJECT_WITH_OXLINT },
  { project: 'with no package.json', projectDir: EMPTY_TSCONFIG_ROOT_DIR },
]

// Every list left out, and some: a fix for a set leaving every list out alone passes the first and fails the rest.
const SETS_LEAVING_LISTS_OUT: readonly SetLeavingListsOut[] = [
  { leftOut: 'every list ({})', set: {} },
  { leftOut: 'libs and runtimes', set: { quality: ['correctness'] } },
  { leftOut: 'runtimes', set: { quality: ['correctness'], libs: { ui: ['react'] } } },
  { leftOut: 'quality and libs', set: { runtimes: ['node'] } },
  { leftOut: 'quality', set: { libs: { testing: ['vitest'] }, runtimes: ['browser'] } },
]
// A file of each kind the agent build's ESLint config treats apart: TS, JS and JSX.
const A_FILE_OF_EACH_KIND = ['src/a.ts', 'src/a.js', 'src/a.tsx']

describe.each(PROJECTS)('an editor set leaving lists out, in a project $project', ({ projectDir }) => {
  it.each(SETS_LEAVING_LISTS_OUT)('leaving out $leftOut gives the editor parts of the same set with those lists empty', ({ set }) => {
    const leavingListsOut = defineLintRules(buildConsumerLintRulesLeavingListsOut(projectDir, { editorRulesets: set }))
    const givingThemEmpty = defineLintRules(buildConsumerLintRules(projectDir, { editorRulesets: set }))

    expect(leavingListsOut.editorRulesets).toStrictEqual(givingThemEmpty.editorRulesets)
  })
})

// `check` builds the agent set: nothing reads it at load, so a list left out there passed silently in
// real run 3 (case E28), and the agent build stopped on it.
describe('an agent set leaving lists out, in a project whose package.json lists oxlint', () => {
  const { calculatedRulesOfEach, globalsFor } = setUpEslintConfigOracle()

  it.each(SETS_LEAVING_LISTS_OUT)("leaving out $leftOut gives the agent build's oxlint config of the same set with those lists empty", ({ set }) => {
    const leavingListsOut = agentConfigsOf(defineLintRules(buildConsumerLintRulesLeavingListsOut(PROJECT_WITH_OXLINT, { agentRulesets: set })))
    const givingThemEmpty = agentConfigsOf(defineLintRules(buildConsumerLintRules(PROJECT_WITH_OXLINT, { agentRulesets: set })))

    expect(leavingListsOut.oxlint).toStrictEqual(givingThemEmpty.oxlint)
  })

  it.each(SETS_LEAVING_LISTS_OUT)(
    "leaving out $leftOut gives, in a file of each kind, the rules and globals the agent build's ESLint config gives with those lists empty",
    async ({ set }) => {
      const leavingListsOut = agentConfigsOf(defineLintRules(buildConsumerLintRulesLeavingListsOut(PROJECT_WITH_OXLINT, { agentRulesets: set })))
      const givingThemEmpty = agentConfigsOf(defineLintRules(buildConsumerLintRules(PROJECT_WITH_OXLINT, { agentRulesets: set })))
      const globalsOfEach = async (config: typeof leavingListsOut.eslint): Promise<unknown[]> =>
        Promise.all(A_FILE_OF_EACH_KIND.map(async (file) => globalsFor(config, file)))

      expect({
        rules: await calculatedRulesOfEach(leavingListsOut.eslint, A_FILE_OF_EACH_KIND),
        globals: await globalsOfEach(leavingListsOut.eslint),
      }).toStrictEqual({
        rules: await calculatedRulesOfEach(givingThemEmpty.eslint, A_FILE_OF_EACH_KIND),
        globals: await globalsOfEach(givingThemEmpty.eslint),
      })
    },
  )
})

// What still refuses a set: a name in a list it gives, and the set left out altogether; each beside
// the set leaving every list out, which is accepted.
describe('a top-level set leaving lists out, in agents-inc.lint.mts', () => {
  it('is accepted leaving every list out, in both sets', () => {
    expect(() => defineLintRules(buildConsumerLintRulesLeavingListsOut(PROJECT_WITH_OXLINT, {}))).not.toThrow()
  })

  it('is refused for a ruleset its one list misspells, naming the file, the set and the list', () => {
    expect(() =>
      defineLintRules(
        // @ts-expect-error corectness is no quality ruleset
        buildConsumerLintRulesLeavingListsOut(PROJECT_WITH_OXLINT, { editorRulesets: { quality: ['corectness'] } }),
      ),
    ).toThrowError(new Error('agents-inc.lint.mts: editorRulesets.quality: unknown ruleset "corectness"'))
  })

  it('is refused for a libs domain no libs ruleset has, the other lists left out, naming the file, the set and the list', () => {
    expect(() =>
      defineLintRules(
        // @ts-expect-error database is not a libs domain
        buildConsumerLintRulesLeavingListsOut(PROJECT_WITH_OXLINT, { agentRulesets: { libs: { database: ['react'] } } }),
      ),
    ).toThrowError(new Error('agents-inc.lint.mts: agentRulesets.libs: unknown domain "database"'))
  })

  it('is refused left out altogether, naming the file and the set', () => {
    // @ts-expect-error editorRulesets is required
    expect(() => defineLintRules(buildConsumerLintRulesWithoutEditorRulesets(PROJECT_WITH_OXLINT))).toThrowError(
      new Error('agents-inc.lint.mts: editorRulesets: missing'),
    )
  })
})
