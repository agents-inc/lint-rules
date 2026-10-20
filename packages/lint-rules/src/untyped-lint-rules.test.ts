import { describe, expect, it } from 'vitest'
import { type AgentBuildSettings, agentBuildSettingsOf, agentConfigsOf } from './__tests__/agent-configs.ts'
import {
  buildConsumerLintRules,
  buildConsumerLintRulesWithoutAgentRulesets,
  buildConsumerLintRulesWithoutEditorRulesets,
  buildConsumerLintRulesWithoutTsconfigRootDir,
  CORRECTNESS_IN_BOTH_SETS,
} from './__tests__/factories/lint-rules-factories.ts'
import { createProjectListingOxlint } from './__tests__/factories/package-json-factories.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'
import type { EditorParts } from './core/editor-parts.ts'
import { defineLintRules, type LintRules } from './index.ts'

// What an untyped agents-inc.lint.mts does: a .mjs file, or a .mts file whose type errors nobody reads. The types
// refuse every value below and no check of ours on the config refuses it at run time (owner, 2026-10-19: "if they
// use mjs it's on them"), so each is measured beside the typed config it builds the same as, or by the error it
// stops at.

type Built = { readonly agentBuild: AgentBuildSettings; readonly editorParts: EditorParts }

const tempProjects = setUpTempProjects()
const PROJECT_WITH_OXLINT = createProjectListingOxlint(tempProjects)
const NO_DEBUGGER = 'no-debugger'
const EQEQEQ = 'eqeqeq'
const ROOT_GIVEN_AS_A_NUMBER = 42
// Node's error for an argument of the wrong type, such as a path that is no string.
const NODE_REFUSING_A_PATH_THAT_IS_NO_STRING = { name: 'TypeError', code: 'ERR_INVALID_ARG_TYPE' }

/** The agent build `check` makes, and the editor parts the team's engine configs merge. */
function builtFrom(lintRules: LintRules): Built {
  const defined = defineLintRules(lintRules)
  return { agentBuild: agentBuildSettingsOf(defined), editorParts: defined.editorRulesets }
}

// Without these, an agent build compared below that lost what it sets would still compare equal.
describe('the agent build compared in this file', () => {
  it('tells apart a config allowing suppressions from one banning them', () => {
    const allowing = builtFrom(buildConsumerLintRules(PROJECT_WITH_OXLINT, CORRECTNESS_IN_BOTH_SETS, { allowSuppressions: true })).agentBuild

    expect(allowing).not.toStrictEqual(builtFrom(buildConsumerLintRules(PROJECT_WITH_OXLINT, CORRECTNESS_IN_BOTH_SETS, { allowSuppressions: false })).agentBuild)
  })

  it('tells apart a config turning a libs ruleset on from one turning none on', () => {
    const turningReactOn = builtFrom(buildConsumerLintRules(PROJECT_WITH_OXLINT, { agentRulesets: { libs: { ui: ['react'] } } })).agentBuild

    expect(turningReactOn).not.toStrictEqual(builtFrom(buildConsumerLintRules(PROJECT_WITH_OXLINT, {})).agentBuild)
  })
})

describe('a ruleset name no ruleset has, in an untyped agents-inc.lint.mts', () => {
  it('in the agent set builds what the set with that list empty builds: the name turns nothing on', () => {
    // @ts-expect-error corectness is no quality ruleset
    const untyped = buildConsumerLintRules(PROJECT_WITH_OXLINT, { agentRulesets: { quality: ['corectness'] } })

    expect(builtFrom(untyped)).toStrictEqual(builtFrom(buildConsumerLintRules(PROJECT_WITH_OXLINT, { agentRulesets: { quality: [] } })))
  })

  it('in the editor set builds what the set with that list empty builds: the name turns nothing on', () => {
    // @ts-expect-error corectness is no quality ruleset
    const untyped = buildConsumerLintRules(PROJECT_WITH_OXLINT, { editorRulesets: { quality: ['corectness'] } })

    expect(builtFrom(untyped)).toStrictEqual(builtFrom(buildConsumerLintRules(PROJECT_WITH_OXLINT, { editorRulesets: { quality: [] } })))
  })
})

describe('a ruleset name filed under another list or domain, in an untyped agents-inc.lint.mts', () => {
  const reactUnderUi = buildConsumerLintRules(PROJECT_WITH_OXLINT, { agentRulesets: { libs: { ui: ['react'] } } })

  it('in the quality list builds what it builds in its own domain: the ruleset is on', () => {
    // @ts-expect-error react is a libs ruleset, not a quality one
    const untyped = buildConsumerLintRules(PROJECT_WITH_OXLINT, { agentRulesets: { quality: ['react'] } })

    expect(builtFrom(untyped)).toStrictEqual(builtFrom(reactUnderUi))
  })

  it('under a libs domain no ruleset has builds what it builds in its own domain: the ruleset is on', () => {
    // @ts-expect-error database is not a libs domain
    const untyped = buildConsumerLintRules(PROJECT_WITH_OXLINT, { agentRulesets: { libs: { database: ['react'] } } })

    expect(builtFrom(untyped)).toStrictEqual(builtFrom(reactUnderUi))
  })

  it('under another libs domain builds what it builds in its own domain: the ruleset is on', () => {
    // @ts-expect-error react belongs to the ui domain, not testing
    const untyped = buildConsumerLintRules(PROJECT_WITH_OXLINT, { agentRulesets: { libs: { testing: ['react'] } } })

    expect(builtFrom(untyped)).toStrictEqual(builtFrom(reactUnderUi))
  })
})

describe('an allowSuppressions that is not true or false, in an untyped agents-inc.lint.mts', () => {
  it("as the string 'false' gives the agent build true gives: the string is truthy, so suppressions are allowed", () => {
    // @ts-expect-error allowSuppressions is true or false
    const untyped = buildConsumerLintRules(PROJECT_WITH_OXLINT, CORRECTNESS_IN_BOTH_SETS, { allowSuppressions: 'false' })

    expect(builtFrom(untyped).agentBuild).toStrictEqual(builtFrom(buildConsumerLintRules(PROJECT_WITH_OXLINT, CORRECTNESS_IN_BOTH_SETS, { allowSuppressions: true })).agentBuild)
  })

  it("as the string 'yes' in an entry gives the agent build true gives there", () => {
    // @ts-expect-error allowSuppressions is true or false in a file override too
    const untyped = buildConsumerLintRules(PROJECT_WITH_OXLINT, CORRECTNESS_IN_BOTH_SETS, { fileOverrides: [{ files: ['legacy/**'], allowSuppressions: 'yes' }] })
    const typed = buildConsumerLintRules(PROJECT_WITH_OXLINT, CORRECTNESS_IN_BOTH_SETS, { fileOverrides: [{ files: ['legacy/**'], allowSuppressions: true }] })

    expect(builtFrom(untyped).agentBuild).toStrictEqual(builtFrom(typed).agentBuild)
  })
})

describe('a suppression rule set in the top-level rules of an untyped agents-inc.lint.mts', () => {
  it('gives the agent build of the config setting no rules: allowSuppressions alone still decides it', () => {
    // @ts-expect-error house/no-suppressions is set by allowSuppressions
    const untyped = buildConsumerLintRules(PROJECT_WITH_OXLINT, CORRECTNESS_IN_BOTH_SETS, { rules: { 'house/no-suppressions': 'off' } })

    expect(builtFrom(untyped).agentBuild).toStrictEqual(builtFrom(buildConsumerLintRules(PROJECT_WITH_OXLINT, CORRECTNESS_IN_BOTH_SETS)).agentBuild)
  })
})

describe('a severity that is none of error, warn or off, in an untyped agents-inc.lint.mts', () => {
  it("is written into the agent build's oxlint config as given, for oxlint to refuse", () => {
    // @ts-expect-error warning is not a severity
    const untyped = buildConsumerLintRules(PROJECT_WITH_OXLINT, CORRECTNESS_IN_BOTH_SETS, { rules: { [NO_DEBUGGER]: 'warning' } })

    expect(agentConfigsOf(defineLintRules(untyped)).oxlint.rules).toHaveProperty([NO_DEBUGGER], ['warning'])
  })

  it("is written, with its options, into the agent build's ESLint config as given, for ESLint to refuse", () => {
    // @ts-expect-error the options must follow a severity
    const untyped = buildConsumerLintRules(PROJECT_WITH_OXLINT, CORRECTNESS_IN_BOTH_SETS, { rules: { [EQEQEQ]: ['warning', 'always'] } })
    const { eslint } = agentConfigsOf(defineLintRules(untyped))

    expect(eslint.flatMap(({ rules }) => (rules !== undefined && Object.hasOwn(rules, EQEQEQ) ? [rules[EQEQEQ]] : []))).toStrictEqual([['warning', 'always']])
  })
})

describe('a rule ID no shipped rule has, in an untyped agents-inc.lint.mts', () => {
  it('stops at the look-up in the catalog, which names the ID and no file', () => {
    // @ts-expect-error not-a/rule is no rule ID
    const untyped = buildConsumerLintRules(PROJECT_WITH_OXLINT, {}, { rules: { 'not-a/rule': 'error' } })

    expect(() => defineLintRules(untyped)).toThrow(new Error('unknown rule ID "not-a/rule"'))
  })

  it('is not what a shipped rule ID stops at', () => {
    expect(() => defineLintRules(buildConsumerLintRules(PROJECT_WITH_OXLINT, {}, { rules: { [NO_DEBUGGER]: 'error' } }))).not.toThrow()
  })
})

describe('a required key left out of an untyped agents-inc.lint.mts', () => {
  it('stops, where tsconfigRootDir is left out, at the TypeError Node throws for a path that is no string', () => {
    // @ts-expect-error tsconfigRootDir is required
    expect(() => defineLintRules(buildConsumerLintRulesWithoutTsconfigRootDir())).toThrow(expect.objectContaining(NODE_REFUSING_A_PATH_THAT_IS_NO_STRING))
  })

  it('stops, where tsconfigRootDir is a number, at the TypeError Node throws for a path that is no string', () => {
    // @ts-expect-error tsconfigRootDir is a string
    expect(() => defineLintRules(buildConsumerLintRules(ROOT_GIVEN_AS_A_NUMBER, {}))).toThrow(expect.objectContaining(NODE_REFUSING_A_PATH_THAT_IS_NO_STRING))
  })

  // The text is V8's, and names whichever list of the set is read first.
  it('stops, where the agent set is left out, at a TypeError', () => {
    // @ts-expect-error agentRulesets is required
    expect(() => defineLintRules(buildConsumerLintRulesWithoutAgentRulesets(PROJECT_WITH_OXLINT))).toThrow(TypeError)
  })

  it('stops, where the editor set is left out, at a TypeError', () => {
    // @ts-expect-error editorRulesets is required
    expect(() => defineLintRules(buildConsumerLintRulesWithoutEditorRulesets(PROJECT_WITH_OXLINT))).toThrow(TypeError)
  })

  it('builds where tsconfigRootDir and both sets are given', () => {
    expect(() => defineLintRules(buildConsumerLintRules(PROJECT_WITH_OXLINT, {}))).not.toThrow()
  })
})
