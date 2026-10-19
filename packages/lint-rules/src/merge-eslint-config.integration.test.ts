import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  COMPONENT_FILE,
  FLOATING_PROMISE_FILE,
  floatingPromise,
  listWithoutKeys,
  MERGED_CONFIG_FILE,
  mergedConfig,
  ROOT_SCRIPT_FILE,
  rootScript,
  SCRIPT_FILE,
  TEAM_ALONE_CONFIG_FILE,
  TEAM_CONFIG_MODULE,
  teamAloneConfig,
  teamOnProject,
  teamOnProjectService,
  TS_MODULE_FILE,
  teamOnRecommended,
  teamOnRecommendedAndReact,
  teamSwitchingTypesOffForScripts,
  teamTypingOnlyTsAndTsx,
  teamTypingSrcUnderBasePath,
  UNUSED_EXPRESSION_FILE,
  UNUSED_VARIABLE_FILE,
  unusedExpression,
  unusedVariable,
} from './__tests__/cases/team-eslint-projects.ts'
import {
  describeFinding,
  type EslintCliResult,
  eslintFindingsIn,
  type Finding,
  fatalMessagesIn,
  runEslintCli,
} from './__tests__/engine-clis.ts'
import { A_DEPRECATED_CONSTANT_PASSED_ON, RE_EXPORTING_ITSELF } from './__tests__/cases/check-sources.ts'
import { moduleText } from './__tests__/factories/check-factories.ts'
import { buildEveryRulesetLintRules } from './__tests__/factories/lint-rules-factories.ts'
import {
  buildPackageJsonListingOthers,
  buildPackageJsonListingOxlint,
  type PackageJson,
  packageJsonText,
} from './__tests__/factories/package-json-factories.ts'
import { buildReactTsconfig } from './__tests__/factories/tsconfig-factories.ts'
import { ruleIdsStatedInEslint } from './__tests__/rules-on-engines.ts'
import { type RunsBeforeTheSuiteOptions, setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { teamOxlintConfigSettingNoRuleFiles, writeTeamOxlintConfigSettingNoRule } from './__tests__/team-configs-of-the-other-engine.ts'
import { installedPackage, type ProjectFiles, type TempProjects, THIS_PACKAGE } from './__tests__/temp-projects.ts'
import { mergeEslintConfig } from './eslint.ts'
import { defineLintRules } from './index.ts'

// The repo's own installs of typescript-eslint and eslint-plugin-react are distinct objects from ours.
// Each run is the real ESLint CLI in its own process, as typescript-eslint keeps one project service
// per process.

type TeamProjectRuns = {
  readonly projectDir: () => string
  readonly teamAlone: () => readonly EslintCliResult[]
  readonly merged: () => readonly EslintCliResult[]
}

type CompletedRuns = { readonly projectDir: string; readonly teamAlone: readonly EslintCliResult[]; readonly merged: readonly EslintCliResult[] }

const AGENTS_INC_LINT_WITH_EVERY_RULESET = readFileSync(
  fileURLToPath(new URL('../test-fixtures/consumer-files/agents-inc.lint.mts', import.meta.url)),
  'utf8',
)
const LINKED_PACKAGES = [THIS_PACKAGE, installedPackage('typescript-eslint'), installedPackage('eslint-plugin-react')]
const TEAM_PROJECT_RUNS: RunsBeforeTheSuiteOptions = { timeoutMs: 480_000, whatFailed: 'ESLint could not lint the team project before the suite' }
// The core rule, and its typescript-eslint extension, which the ESLint part runs on TS files in its place without oxlint.
const UNUSED_VARIABLE_RULES = ['no-unused-vars', '@typescript-eslint/no-unused-vars']
// Two core rules oxlint runs for us, and typescript-eslint's extensions of them, which its recommended config turns on.
const UNUSED_CODE_RULES = [
  'no-unused-vars',
  '@typescript-eslint/no-unused-vars',
  'no-unused-expressions',
  '@typescript-eslint/no-unused-expressions',
]
const FLOATING_PROMISES = '@typescript-eslint/no-floating-promises'

const PROJECTS = [
  { project: 'whose package.json lists oxlint', packageJson: buildPackageJsonListingOxlint() },
  { project: 'whose package.json lists no oxlint', packageJson: buildPackageJsonListingOthers() },
]

/**
 * Makes the team project, with any files given besides the shared ones, and lints it twice, before
 * the suite: with the team's config alone, and merged.
 */
function setUpTeamProjectRuns(packageJson: PackageJson, teamConfigModule: string, extraFiles: ProjectFiles = {}): TeamProjectRuns {
  const completedRuns = setUpRunsBeforeTheSuite(lintTeamProjectTwice, TEAM_PROJECT_RUNS)

  function lintTeamProjectTwice(tempProjects: TempProjects): CompletedRuns {
    const projectDir = tempProjects.create({
      files: {
        'package.json': packageJsonText(packageJson),
        'tsconfig.json': JSON.stringify(buildReactTsconfig({ include: ['src'] })),
        'agents-inc.lint.mts': AGENTS_INC_LINT_WITH_EVERY_RULESET,
        [TEAM_CONFIG_MODULE]: teamConfigModule,
        [TEAM_ALONE_CONFIG_FILE]: teamAloneConfig,
        [MERGED_CONFIG_FILE]: mergedConfig,
        [FLOATING_PROMISE_FILE]: floatingPromise,
        [UNUSED_VARIABLE_FILE]: unusedVariable,
        [COMPONENT_FILE]: listWithoutKeys,
        [ROOT_SCRIPT_FILE]: rootScript,
        ...teamOxlintConfigSettingNoRuleFiles,
        ...extraFiles,
      },
      linkedPackages: LINKED_PACKAGES,
    })
    return {
      projectDir,
      teamAlone: runEslintCli(projectDir, TEAM_ALONE_CONFIG_FILE),
      merged: runEslintCli(projectDir, MERGED_CONFIG_FILE),
    }
  }

  return {
    projectDir: () => completedRuns().projectDir,
    teamAlone: () => completedRuns().teamAlone,
    merged: () => completedRuns().merged,
  }
}

/** Every rule ID our editor ESLint part states, to any severity, for a project like this one. */
function ruleIdsOurPartStates(projectDir: string): ReadonlySet<string> {
  const { eslint } = defineLintRules(buildEveryRulesetLintRules(projectDir)).editorRulesets
  return new Set(ruleIdsStatedInEslint(mergeEslintConfig([], eslint, writeTeamOxlintConfigSettingNoRule(eslint))))
}

function findingsOf(runs: TeamProjectRuns, which: 'teamAlone' | 'merged'): Finding[] {
  return eslintFindingsIn(runs[which](), runs.projectDir())
}

describe.each(PROJECTS)(
  "a team on typescript-eslint's and eslint-plugin-react's recommended configs, merged with the editor part, in a project $project",
  ({ packageJson }) => {
    const runs = setUpTeamProjectRuns(packageJson, teamOnRecommendedAndReact)

    it('loads: no fatal message on any file', () => {
      expect(fatalMessagesIn(runs.merged(), runs.projectDir())).toStrictEqual([])
    })

    it('loses no finding the team config alone made with a rule our part does not state', () => {
      const ours = ruleIdsOurPartStates(runs.projectDir())
      const merged = new Set(findingsOf(runs, 'merged').map(describeFinding))
      const lost = findingsOf(runs, 'teamAlone')
        .filter((finding) => !ours.has(finding.rule))
        .map(describeFinding)
        .filter((finding) => !merged.has(finding))

      expect(lost).toStrictEqual([])
    })

    // The narrowed off-switch: we route react/react-in-jsx-scope to oxlint, but our parts do not run it.
    it('keeps the team findings of react/react-in-jsx-scope, a rule we route to oxlint and do not run', () => {
      const ofTheRule = (findings: readonly Finding[]): Finding[] =>
        findings.filter((finding) => finding.rule === 'react/react-in-jsx-scope')
      const teamAlone = ofTheRule(findingsOf(runs, 'teamAlone'))

      expect({
        filesTheTeamFlags: [...new Set(teamAlone.map((finding) => finding.file))],
        merged: ofTheRule(findingsOf(runs, 'merged')),
      }).toStrictEqual({ filesTheTeamFlags: [COMPONENT_FILE], merged: teamAlone })
    })
  },
)

// typescript-eslint builds one project service per process from the first file's options, so
// our typed block takes the team's type information whenever the team gives some.
describe('a team linting with types through the project service, a default project for a root script, merged with the editor part', () => {
  const runs = setUpTeamProjectRuns(buildPackageJsonListingOxlint(), teamOnProjectService)

  it('adds no fatal message to those the team config alone has', () => {
    expect(fatalMessagesIn(runs.merged(), runs.projectDir())).toStrictEqual(fatalMessagesIn(runs.teamAlone(), runs.projectDir()))
  })
})

describe('a team linting with types through project, merged with the editor part', () => {
  const runs = setUpTeamProjectRuns(buildPackageJsonListingOxlint(), teamOnProject)

  it('adds no fatal message to those the team config alone has', () => {
    expect(fatalMessagesIn(runs.merged(), runs.projectDir())).toStrictEqual(fatalMessagesIn(runs.teamAlone(), runs.projectDir()))
  })
})

describe('a team giving no type information, merged with the editor part', () => {
  const runs = setUpTeamProjectRuns(buildPackageJsonListingOxlint(), teamOnRecommended)

  it('loads: no fatal message on any file', () => {
    expect(fatalMessagesIn(runs.merged(), runs.projectDir())).toStrictEqual([])
  })

  it('gets type information from our part: our typed rule fires where the team config alone has none', () => {
    const ofTheRule = (findings: readonly Finding[]): string[] =>
      findings.filter((finding) => finding.rule === '@typescript-eslint/no-floating-promises').map(describeFinding)

    expect({
      teamAlone: ofTheRule(findingsOf(runs, 'teamAlone')),
      merged: ofTheRule(findingsOf(runs, 'merged')),
    }).toStrictEqual({ teamAlone: [], merged: [`${FLOATING_PROMISE_FILE}:4 @typescript-eslint/no-floating-promises`] })
  })
})

// typescript-eslint's no-deprecated, which our part runs where the team turns it on nowhere, followed a
// re-export cycle for good, so the merged run never ended.
describe("a team on typescript-eslint's recommended config, merged with the editor part, beside a file re-exporting a name from itself", () => {
  const filesWritten = { [RE_EXPORTING_ITSELF.file]: RE_EXPORTING_ITSELF.lines, ...A_DEPRECATED_CONSTANT_PASSED_ON }
  const runs = setUpTeamProjectRuns(
    buildPackageJsonListingOxlint(),
    teamOnRecommended,
    Object.fromEntries(Object.entries(filesWritten).map(([file, lines]) => [file, moduleText(...lines)])),
  )

  it('lints, reporting the deprecated name where it is passed on and where it is read, and none in the file re-exporting from itself', () => {
    expect(findingsOf(runs, 'merged').filter((finding) => finding.rule === '@typescript-eslint/no-deprecated').map(describeFinding)).toStrictEqual([
      'src/passed-on.ts:1 @typescript-eslint/no-deprecated',
      'src/read.ts:3 @typescript-eslint/no-deprecated',
    ])
  })
})

// Without oxlint, our part runs typescript-eslint's extension of a moved core rule on TS files; the
// team's recommended config turns it on too, so the finding is reported once, under the extension's name.
describe("a team on typescript-eslint's recommended config, merged with the editor part, in a project whose package.json lists no oxlint", () => {
  const runs = setUpTeamProjectRuns(buildPackageJsonListingOthers(), teamOnRecommended)

  it('reports an unused variable once, by the team\'s @typescript-eslint/no-unused-vars and not by the core rule', () => {
    const unusedVariableFindings = findingsOf(runs, 'merged').filter(
      (finding) => finding.file === UNUSED_VARIABLE_FILE && UNUSED_VARIABLE_RULES.includes(finding.rule),
    )

    expect(unusedVariableFindings.map(describeFinding)).toStrictEqual([
      `${UNUSED_VARIABLE_FILE}:1 @typescript-eslint/no-unused-vars`,
    ])
  })
})

// With oxlint, oxlint would run no-unused-vars and no-unused-expressions for us, but typescript-eslint's
// recommended config turns on its extensions of both, making them the team's: our part runs neither.
describe("a team on typescript-eslint's recommended config, merged with the editor part, in a project whose package.json lists oxlint", () => {
  const runs = setUpTeamProjectRuns(buildPackageJsonListingOxlint(), teamOnRecommended, {
    [UNUSED_EXPRESSION_FILE]: unusedExpression,
  })

  it("reports an unused variable and an unused expression in ESLint as the team's config alone does, by typescript-eslint's extensions", () => {
    const ofUnusedCode = (findings: readonly Finding[]): string[] =>
      findings.filter((finding) => UNUSED_CODE_RULES.includes(finding.rule)).map(describeFinding)
    const owed = [`${UNUSED_EXPRESSION_FILE}:3 @typescript-eslint/no-unused-expressions`, `${UNUSED_VARIABLE_FILE}:1 @typescript-eslint/no-unused-vars`]

    expect({ teamAlone: ofUnusedCode(findingsOf(runs, 'teamAlone')), merged: ofUnusedCode(findingsOf(runs, 'merged')) }).toStrictEqual({ teamAlone: owed, merged: owed })
  })
})

// typescript-eslint builds one project service per process, so where a team gives type information
// to some files only, our typed rules run only there: in any other TS file a typed rule has no types,
// throws, and ends the whole ESLint run (measured).
describe('a team linting with types through the project service for its .ts and .tsx files only, merged with the editor part', () => {
  const runs = setUpTeamProjectRuns(buildPackageJsonListingOxlint(), teamTypingOnlyTsAndTsx, {
    [TS_MODULE_FILE]: floatingPromise,
  })

  it('adds no fatal message to those the team config alone has', () => {
    expect(fatalMessagesIn(runs.merged(), runs.projectDir())).toStrictEqual(fatalMessagesIn(runs.teamAlone(), runs.projectDir()))
  })

  it('runs our typed rule in a file the team types, and not in the .mts file it lints without types', () => {
    const ofTheRule = (findings: readonly Finding[]): string[] =>
      findings.filter((finding) => finding.rule === FLOATING_PROMISES).map(describeFinding)

    expect(ofTheRule(findingsOf(runs, 'merged'))).toStrictEqual([`${FLOATING_PROMISE_FILE}:4 ${FLOATING_PROMISES}`])
  })
})

// A team may switch type information off again for some files, as typescript-eslint's
// disableTypeChecked does, or give it under a basePath its block reads its globs from. Our typed
// rules run in neither kind of file: there they have no types, throw, and end the whole ESLint run
// (measured).
describe.each([
  { team: "switching it off for its scripts with typescript-eslint's disableTypeChecked", teamConfigModule: teamSwitchingTypesOffForScripts },
  { team: 'giving it to the .ts and .tsx files under src, from a block whose basePath is src', teamConfigModule: teamTypingSrcUnderBasePath },
])('a team linting with types through the project service, $team, merged with the editor part', ({ teamConfigModule }) => {
  const runs = setUpTeamProjectRuns(buildPackageJsonListingOxlint(), teamConfigModule, { [SCRIPT_FILE]: floatingPromise })

  it('adds no fatal message to those the team config alone has', () => {
    expect(fatalMessagesIn(runs.merged(), runs.projectDir())).toStrictEqual(fatalMessagesIn(runs.teamAlone(), runs.projectDir()))
  })

  it('runs our typed rule in a file the team types, and not in the script it lints without types', () => {
    const ofTheRule = (findings: readonly Finding[]): string[] =>
      findings.filter((finding) => finding.rule === FLOATING_PROMISES).map(describeFinding)

    expect(ofTheRule(findingsOf(runs, 'merged'))).toStrictEqual([`${FLOATING_PROMISE_FILE}:4 ${FLOATING_PROMISES}`])
  })
})
