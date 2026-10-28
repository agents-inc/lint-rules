import { beforeAll, describe, expect, it } from 'vitest'
import { type BothEnginesRuns, setUpBothEnginesRuns } from './__tests__/both-engines-runs.ts'
import {
  EVERY_FILE_IN_A_LEGACY_FOLDER,
  EVERY_LEGACY_FOLDER,
  IGNORED_FILES,
  IGNORES_AS_GITIGNORE_LINES,
  type IgnoresRow,
  MORE_IGNORES_AS_GITIGNORE_LINES,
  NEGATED_UNDER_A_LEFT_OUT_FOLDER,
  ROOT_TAKE_BACKS_BESIDE_AN_ENTRY,
} from './__tests__/cases/ignores-as-gitignore-lines.ts'
import type { EngineFinding } from './__tests__/engine-clis.ts'
import { filesReportingIn, type RuleByItsNames } from './__tests__/findings-beside-the-team.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { EMPTY_TEAM_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'

// Each value of our ignores means what it would as a .gitignore line, in both engines and every build.
// The empty team oxlint config turns correctness off so oxlint's own copies report nothing.

allowEveryTestForParallelLoad()

const NO_DEBUGGER: RuleByItsNames = { rule: 'no-debugger', names: ['eslint(no-debugger)'] }
const NO_THROW_LITERAL: RuleByItsNames = { rule: 'no-throw-literal', names: ['no-throw-literal'] }
const OUR_RULES = { 'no-debugger': 'error', 'no-throw-literal': 'error' } as const
const DEBUGGER_AND_A_THROWN_LITERAL = "debugger\nthrow 'x'\n"
const EVERY_ROW: readonly IgnoresRow[] = [...IGNORES_AS_GITIGNORE_LINES, ...MORE_IGNORES_AS_GITIGNORE_LINES]

/** The files each engine reports our rule in, by build. */
type FilesReportingByBuild = Readonly<Record<'agent' | 'mergedIntoEmptyTeamConfigs', { readonly oxlint: readonly string[]; readonly eslint: readonly string[] }>>

function setUpRunsIgnoring(files: readonly string[], ignores: readonly string[]): () => BothEnginesRuns {
  return setUpBothEnginesRuns({
    sources: Object.fromEntries(files.map((file) => [file, DEBUGGER_AND_A_THROWN_LITERAL])),
    ours: { rules: OUR_RULES, ignores: [...ignores] },
    teamEslintRules: {},
    teamOxlintConfig: EMPTY_TEAM_OXLINT_CONFIG,
  })
}

/** Our two rules run by an entry over every legacy folder alone, beside our ignores. */
function setUpRunsIgnoringBesideAnEntry(files: readonly string[], ignores: readonly string[]): () => BothEnginesRuns {
  return setUpBothEnginesRuns({
    sources: Object.fromEntries(files.map((file) => [file, DEBUGGER_AND_A_THROWN_LITERAL])),
    ours: { ignores: [...ignores], fileOverrides: [{ files: [EVERY_FILE_IN_A_LEGACY_FOLDER], rules: OUR_RULES }] },
    teamEslintRules: {},
    teamOxlintConfig: EMPTY_TEAM_OXLINT_CONFIG,
  })
}

function filesReportingOurRules(findings: readonly EngineFinding[], files: readonly string[]): { readonly oxlint: readonly string[]; readonly eslint: readonly string[] } {
  return { oxlint: filesReportingIn(findings, files, NO_DEBUGGER, 'oxlint'), eslint: filesReportingIn(findings, files, NO_THROW_LITERAL, 'eslint') }
}

function filesReportingByBuild(runs: BothEnginesRuns, files: readonly string[]): FilesReportingByBuild {
  return { agent: filesReportingOurRules(runs.agent, files), mergedIntoEmptyTeamConfigs: filesReportingOurRules(runs.mergedIntoEmptyTeamConfigs, files) }
}

/** Each build owing our two rules in the same files. */
function owedInEveryBuild(files: readonly string[]): FilesReportingByBuild {
  return { agent: { oxlint: files, eslint: files }, mergedIntoEmptyTeamConfigs: { oxlint: files, eslint: files } }
}

// Each list's values in full in its title, which describe.each's $-interpolation would cut short.
for (const { ignores, leftOut } of IGNORES_AS_GITIGNORE_LINES) {
  describe(`our ignores ${JSON.stringify(ignores)}, beside empty team configs`, () => {
    const runs = setUpRunsIgnoring(IGNORED_FILES, ignores)

    it('keep both our rules out of the files a .gitignore holding them leaves out, in both engines, in the agent build and merged', () => {
      expect(filesReportingByBuild(runs(), IGNORED_FILES)).toStrictEqual(owedInEveryBuild(IGNORED_FILES.filter((file) => !leftOut.includes(file))))
    })
  })
}

// Each list again, our rules run by an entry over every legacy folder alone, so each value meets the
// entry's files.
for (const { ignores, leftOut } of EVERY_ROW) {
  describe(`our ignores ${JSON.stringify(ignores)}, beside an entry running our rules in ${EVERY_FILE_IN_A_LEGACY_FOLDER} and empty team configs`, () => {
    const runs = setUpRunsIgnoringBesideAnEntry(IGNORED_FILES, ignores)

    it("keep the entry's rules out of the files a .gitignore holding them leaves out, in both engines, in the agent build and merged", () => {
      expect(filesReportingByBuild(runs(), IGNORED_FILES)).toStrictEqual(owedInEveryBuild(EVERY_LEGACY_FOLDER.filter((file) => !leftOut.includes(file))))
    })
  })
}

for (const ignores of ROOT_TAKE_BACKS_BESIDE_AN_ENTRY.ignoresLists) {
  describe(`our ignores ${JSON.stringify(ignores)}, beside an entry running our rules in ${EVERY_FILE_IN_A_LEGACY_FOLDER}, over a.js at each depth under it and a b.js, and empty team configs`, () => {
    const { files, entryRunsIn } = ROOT_TAKE_BACKS_BESIDE_AN_ENTRY
    const runs = setUpRunsIgnoringBesideAnEntry(files, ignores)

    it("run the entry's rules in legacy/b.js, which the ignores leave in, and in none of the a.js files they leave out, in both engines, in the agent build and merged", () => {
      expect(filesReportingByBuild(runs(), files)).toStrictEqual(owedInEveryBuild(entryRunsIn))
    })
  })
}

describe(`our ignores ${JSON.stringify(NEGATED_UNDER_A_LEFT_OUT_FOLDER.ignores)}, a negated value taking back a file under a folder another leaves out, beside empty team configs`, () => {
  const { files, ignores, leftOut } = NEGATED_UNDER_A_LEFT_OUT_FOLDER
  const runs = setUpRunsIgnoring(files, ignores)
  const lintedByAGitignoreReading = files.filter((file) => !leftOut.includes(file))
  // A run that failed throws here, before the tests, so only the assertion can fail inside it.fails.
  beforeAll(() => {
    runs()
  })

  // A written limit: ESLint keeps lib/a.js out with its folder, and oxlint takes it back, in every build.
  it('report in the files each engine reads them to leave in: oxlint takes lib/a.js back, ESLint does not', () => {
    expect(filesReportingByBuild(runs(), files)).toStrictEqual({
      agent: { oxlint: lintedByAGitignoreReading, eslint: ['a.js'] },
      mergedIntoEmptyTeamConfigs: { oxlint: lintedByAGitignoreReading, eslint: ['a.js'] },
    })
  })

  // KNOWN GAP: the limit above fails this strict assertion.
  it.fails('keep both our rules out of the files a .gitignore holding them leaves out, in both engines, in the agent build and merged', () => {
    expect(filesReportingByBuild(runs(), files)).toStrictEqual(owedInEveryBuild(lintedByAGitignoreReading))
  })
})
