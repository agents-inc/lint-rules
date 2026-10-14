import { catalog } from '@workspace/rule-data'
import type { OxlintConfig } from 'oxlint'
import { beforeAll, describe, expect, it } from 'vitest'
import { oxlintOverridesMatchingNoFile } from './__tests__/blocks-matching-no-file.ts'
import {
  FILE_EXCLUDED_BY_TWO_LISTINGS,
  OFF_UNDONE_BY_A_LATER_LISTING,
  OXLINT_MERGE_DIMENSIONS,
  OXLINT_MERGE_LINTED_DIRS,
  OXLINT_MERGE_SEEDS,
  oxlintMergeJsPluginFiles,
  oxlintMergeSourceFiles,
} from './__tests__/cases/oxlint-merge-shapes.ts'
import {
  describeOxlintFindings,
  type OxlintFinding,
  oxlintFindingsWithSeverityIn,
  runOxlintCli,
  writeOxlintConfigFile,
} from './__tests__/engine-clis.ts'
import { buildPackageJsonListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { buildConsumerLintRulesFromShape, type OxlintMergeShapeValue } from './__tests__/factories/shape-factories.ts'
import { buildTeamOxlintConfigFrom } from './__tests__/factories/team-config-factories.ts'
import { ownerOfOxlintFindings, oxlintFindingsOwed } from './__tests__/oxlint-findings-owed.ts'
import { oxlintPartAlone } from './__tests__/oxlint-part-alone.ts'
import { coverageOf, pairsMetInNoShape, pairwiseShapes, type Shape } from './__tests__/pairwise-shapes.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { TEAM_ESLINT_CONFIG_SETTING_NO_RULE, teamEslintConfigSettingNoRuleFiles } from './__tests__/team-configs-of-the-other-engine.ts'
import { INSTALLED_OXLINT, setUpTempProjects } from './__tests__/temp-projects.ts'
import type { OxlintPart } from './core/editor-parts.ts'
import { defineLintRules } from './index.ts'
import { mergeOxlintConfig } from './oxlint.ts'

// The oxlint merge, checked against oxlint itself: each shape is linted three times by the real CLI,
// with the team's config alone, with our part alone, and merged. Rule by rule, the merged config owes
// the findings of one of them (decisions.md, "Owner 2026-10-14"; spec-merge-model.md, 1.1): the
// team's in every file for a rule the team's config sets anywhere, by a statement oxlint counts or a
// category it writes on; ours for every other rule, where our part alone runs it; none, elsewhere,
// of a rule our ESLint part runs, whose copy only oxlint's own correctness: warn runs for the team
// (decisions.md, "Owner 2026-10-14 (questions on the merge rework spec", point 1). The team has no
// ESLint config here: one that sets no rule. Which statements and categories of the team's count is read through a model
// of oxlint's resolution, __tests__/oxlint-rules-the-team-sets.ts, written apart from the merge. The
// merge adds no finding and loses none (questions.md #44). Compared as members, `file:line code
// severity`. The shapes meet every two values of two dimensions, and the seeds keep each defect
// found so far. The shape cases are in __tests__/cases/oxlint-merge-shapes.ts.

/** The merged config's findings, and those the merge owes: per file and rule, the team's alone or ours alone. */
type FindingsOwed = { readonly merged: readonly string[]; readonly owed: readonly string[] }

const SHAPES = pairwiseShapes(OXLINT_MERGE_DIMENSIONS, OXLINT_MERGE_SEEDS)
const COVERAGE = coverageOf(OXLINT_MERGE_DIMENSIONS, SHAPES)
const SHAPE_SEPARATOR = '; '

const PROJECT = setUpTempProjects().create({
  files: {
    'package.json': packageJsonText(buildPackageJsonListingOxlint()),
    ...oxlintMergeSourceFiles,
    ...oxlintMergeJsPluginFiles,
    ...teamEslintConfigSettingNoRuleFiles,
  },
  linkedPackages: [INSTALLED_OXLINT],
})

allowEveryTestForParallelLoad()

/** What the real oxlint CLI reports over the project with the config given, written to the file given. */
function findingsWith(file: string, config: OxlintConfig): OxlintFinding[] {
  writeOxlintConfigFile(PROJECT, file, config)
  return oxlintFindingsWithSeverityIn(runOxlintCli(PROJECT, file, OXLINT_MERGE_LINTED_DIRS).report)
}

function oxlintPartOf({ oxlint }: ReturnType<typeof defineLintRules>['editorRulesets']): OxlintPart {
  if (oxlint === undefined) throw new Error('the project lists oxlint, so it has an oxlint part')
  return oxlint
}

function nameOf(shape: Shape<OxlintMergeShapeValue>): string {
  return shape.map(({ name }) => name).join(SHAPE_SEPARATOR)
}

/** The team's config of the shape with our part merged in. */
function mergedConfigOf(shape: Shape<OxlintMergeShapeValue>): OxlintConfig {
  const { editorRulesets } = defineLintRules(buildConsumerLintRulesFromShape(PROJECT, shape.map(({ ours }) => ours)))
  return mergeOxlintConfig(buildTeamOxlintConfigFrom(shape.map(({ team }) => team)), oxlintPartOf(editorRulesets), TEAM_ESLINT_CONFIG_SETTING_NO_RULE)
}

/** The shape's three runs, each config written to a file named for the run given. */
function findingsOwedIn(run: string, shape: Shape<OxlintMergeShapeValue>): FindingsOwed {
  const defined = defineLintRules(buildConsumerLintRulesFromShape(PROJECT, shape.map(({ ours }) => ours)))
  const parts = defined.editorRulesets
  const oxlint = oxlintPartOf(parts)
  const team = buildTeamOxlintConfigFrom(shape.map(({ team: teamPiece }) => teamPiece))
  const teamAlone = findingsWith(`${run}.team.mjs`, team)
  const oursAlone = findingsWith(`${run}.ours.mjs`, oxlintPartAlone(oxlint, catalog))
  const merged = findingsWith(`${run}.merged.mjs`, mergeOxlintConfig(team, oxlint, TEAM_ESLINT_CONFIG_SETTING_NO_RULE))
  return {
    merged: describeOxlintFindings(merged),
    owed: describeOxlintFindings(oxlintFindingsOwed({ teamAlone, oursAlone }, ownerOfOxlintFindings(parts, { oxlint: team, eslintRuleKeys: [] }, catalog))),
  }
}

describe('mergeOxlintConfig, against the real oxlint CLI in shapes meeting every two values of two dimensions', () => {
  // What the run leaves out, in its title, so a verbose run prints it.
  it(`runs ${String(COVERAGE.shapes)} of the ${String(COVERAGE.combinations)} combinations, meeting every pair of values: left out, ${String(COVERAGE.triples - COVERAGE.triplesMet)} of the ${String(COVERAGE.triples)} triples of values meet in no shape`, () => {
    expect(pairsMetInNoShape(OXLINT_MERGE_DIMENSIONS, SHAPES)).toStrictEqual([])
  })

  // verify.md, U066: an override no path can match changes nothing, and the merge should never write one.
  it('merges into configs writing no override whose files no path can match, in any shape', () => {
    const overridesMatchingNoFile = SHAPES.flatMap((shape, index) =>
      oxlintOverridesMatchingNoFile(mergedConfigOf(shape)).map((override) => `shape ${String(index)}, ${override}`),
    )

    expect(overridesMatchingNoFile).toStrictEqual([])
  })

  it.each(SHAPES.map((shape, index) => ({ index, shape, name: nameOf(shape) })))(
    "shape $index gives the team's findings of each rule the team sets, in every file, and ours of every other where ours runs it: $name",
    ({ index, shape }) => {
      const { merged, owed } = findingsOwedIn(`shape-${String(index)}`, shape)

      expect(merged).toStrictEqual(owed)
    },
  )
})

describe('mergeOxlintConfig, against the real oxlint CLI in the two shapes it cannot reproduce', () => {
  // The runs are made before the tests, so a run oxlint cannot make fails the file: inside it.fails
  // it would pass as the failure expected. Only the assertion fails inside it.fails.
  let runs: ReadonlyMap<OxlintMergeShapeValue, FindingsOwed> = new Map()

  beforeAll(() => {
    runs = new Map(
      [OFF_UNDONE_BY_A_LATER_LISTING, FILE_EXCLUDED_BY_TWO_LISTINGS].map((gap, index): [OxlintMergeShapeValue, FindingsOwed] => [
        gap,
        findingsOwedIn(`known-gap-${String(index)}`, [gap]),
      ]),
    )
  })

  function runOf(gap: OxlintMergeShapeValue): FindingsOwed {
    const run = runs.get(gap)
    if (run === undefined) throw new Error(`no run was made before the tests for ${gap.name}`)
    return run
  }

  // KNOWN GAP: questions.md #48, G2. oxlint's apply_overrides (config_store.rs) switches categories
  // on at the first override whose plugins differ from those listed for the file, putting each rule
  // in with or_insert; an earlier override's `off` removed the rule, so or_insert puts it back and
  // the team sees the rule in the test files. The merge lists every plugin at the root, where no
  // override switches a category on, so it keeps the rule off and the team loses those findings.
  it.fails(`gives every rule the team's findings: ${OFF_UNDONE_BY_A_LATER_LISTING.name}`, () => {
    const { merged, owed } = runOf(OFF_UNDONE_BY_A_LATER_LISTING)

    expect(merged).toStrictEqual(owed)
  })

  // KNOWN GAP: questions.md #48, G3. An override's `files` and `excludeFiles` are each a GlobSet
  // that matches a file when any one of its globs does, so no override can match only the files two
  // listings both exclude, each through excludeFiles of its own. The merge switches react's
  // categories on in every TSX file and off where no [promise] listing applies, which cannot reach
  // lib/m.test.tsx: both [promise] listings' files match it and both exclude it. The file gets
  // react's findings, which the team does not see.
  it.fails(`gives every rule the team's findings: ${FILE_EXCLUDED_BY_TWO_LISTINGS.name}`, () => {
    const { merged, owed } = runOf(FILE_EXCLUDED_BY_TWO_LISTINGS)

    expect(merged).toStrictEqual(owed)
  })
})
