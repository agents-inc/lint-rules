import { describe, expect, it } from 'vitest'
import { agentConfigsOf } from './__tests__/agent-configs.ts'
import { setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import {
  buildConsumerLintRules,
  buildConsumerLintRulesLeavingListsOut,
  emptyTsconfigRootDir,
} from './__tests__/factories/lint-rules-factories.ts'
import { createProjectListingOxlint } from './__tests__/factories/package-json-factories.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'
import { defineLintRules, type LintRules } from './index.ts'

// A top-level set with a list left out means that list is empty, as in a fileOverrides entry, and owes
// what the same set giving the lists empty gives.

type Rulesets = LintRules['agentRulesets']

/** A set as a consumer may write it at the top level, lists left out, and which lists that leaves out. */
type SetLeavingListsOut = { readonly leftOut: string; readonly set: Partial<Rulesets> }

/** A project as a title names it, and its folder as a test reads it: the empty one is made then. */
type ProjectCase = { readonly project: string; readonly projectDir: () => string }

const tempProjects = setUpTempProjects()
const PROJECT_WITH_OXLINT = createProjectListingOxlint(tempProjects)

const PROJECTS: readonly ProjectCase[] = [
  {
    project: 'whose package.json lists oxlint',
    projectDir() {
      return PROJECT_WITH_OXLINT
    },
  },
  { project: 'with no package.json', projectDir: emptyTsconfigRootDir },
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
    const leavingListsOut = defineLintRules(buildConsumerLintRulesLeavingListsOut(projectDir(), { editorRulesets: set }))
    const givingThemEmpty = defineLintRules(buildConsumerLintRules(projectDir(), { editorRulesets: set }))

    expect(leavingListsOut.editorRulesets).toStrictEqual(givingThemEmpty.editorRulesets)
  })
})

// Nothing reads the agent set at load, only `check`, so a list left out there would surface only then.
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

// The types refuse a name in a list a set gives, and a set left out altogether, beside the set leaving every list
// out, which defineLintRules accepts.
describe('a top-level set leaving lists out, in agents-inc.lint.mts', () => {
  it('is accepted leaving every list out, in both sets', () => {
    expect(() => defineLintRules(buildConsumerLintRulesLeavingListsOut(PROJECT_WITH_OXLINT, {}))).not.toThrow()
  })
})
