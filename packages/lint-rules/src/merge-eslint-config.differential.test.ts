import { catalog } from '@workspace/rule-data'
import type { Linter } from 'eslint'
import { defineConfig } from 'eslint/config'
import { describe, expect, it } from 'vitest'
import { eslintBlocksMatchingNoFile } from './__tests__/blocks-matching-no-file.ts'
import { ESLINT_MERGE_DIMENSIONS, ESLINT_MERGE_FILES, ESLINT_MERGE_SEEDS } from './__tests__/cases/eslint-merge-shapes.ts'
import { type CalculatedRules, type CalculatedRulesOrNotLinted, NOT_LINTED, setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import {
  type CalculatedEntry,
  calculatedEntryOf,
  namesInPlay,
  namesOnBeyondTheTeams,
  owedEntry,
  type RulesInPlay,
  rulesInPlayOf,
  type SidesOfAFile,
} from './__tests__/eslint-entries-owed.ts'
import { eslintPartAlone } from './__tests__/eslint-part-alone.ts'
import {
  buildEslintMergeShape,
  buildTeamConfigAloneLintingEveryJsAndTsFile,
  type EslintMergeShape,
  type EslintMergeShapeValue,
} from './__tests__/factories/eslint-merge-factories.ts'
import { coverageOf, pairsMetInNoShape, pairwiseShapes, type Shape, shapeNameOf } from './__tests__/pairwise-shapes.ts'
import { writeTeamOxlintConfigSettingNoRule } from './__tests__/team-configs-of-the-other-engine.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'
import { editorPartsOf } from './core/editor-parts.ts'
import { mergeEslintConfig } from './eslint.ts'
import { eslintPluginRegistry } from './eslint-plugin-registry.ts'

// The ESLint merge, checked against ESLint's own calculated config rather than a model of how
// ESLint reads one: in each shape, every ESLint name of the shape's rule and of typescript-eslint's
// twins of it gets, in every file, the full entry the precedence contract owes it (decisions.md,
// "Owner 2026-10-14"; spec-merge-model.md, 1.1), read from the team's config alone and our part
// alone (__tests__/eslint-entries-owed.ts); and the merge turns on no name of the rule in a file
// beyond those the team's config alone runs there. Every shape's team block states the rule, so the
// team's config decides it in every file, whatever the block's files. Beside oxlint, the merge reads
// a team oxlint config setting no rule. Our part
// alone is built without the merge, laid out as the agent build lays out its config
// (__tests__/eslint-part-alone.ts), so a defect the merge shows with an empty team config too, as
// our ignores going unread, cannot hide on both sides. The shapes meet every two values of two
// dimensions; their cases are in __tests__/cases/eslint-merge-shapes.ts. Each shape runs beside
// oxlint and without it.

/** The shape's file entries, merged and owed, each file's names by name; a file the merged config does not lint is NOT_LINTED. */
type EntriesOwed = {
  readonly merged: Readonly<Record<string, Readonly<Record<string, CalculatedEntry>> | typeof NOT_LINTED>>
  readonly owed: Readonly<Record<string, Readonly<Record<string, CalculatedEntry>>>>
}

/** The calculated configs a shape is read from, and the rules in play it is checked over. */
type ShapeRun = {
  readonly merged: Readonly<Record<string, CalculatedRulesOrNotLinted>>
  readonly sidesByFile: Readonly<Record<string, SidesOfAFile>>
  readonly inPlay: RulesInPlay
}

const SHAPES = pairwiseShapes(ESLINT_MERGE_DIMENSIONS, ESLINT_MERGE_SEEDS)
const COVERAGE = coverageOf(ESLINT_MERGE_DIMENSIONS, SHAPES)

const PROJECT = setUpTempProjects().create({})
// The parts are built for each mode directly, so the project needs no package.json.
const MODES = [
  { mode: 'beside oxlint', usesOxlint: true },
  { mode: 'without oxlint', usesOxlint: false },
]

const { calculatedRulesOfEach } = setUpEslintConfigOracle()

/** The three configs of the shape, each read in every file: merged, the team's alone, and ours alone. */
async function runOf(shape: Shape<EslintMergeShapeValue>, usesOxlint: boolean): Promise<ShapeRun> {
  const { stating, teamConfig, lintRules } = buildEslintMergeShape(PROJECT, shape)
  const parts = editorPartsOf(lintRules, catalog, usesOxlint)
  const inPlay = rulesInPlayOf(stating.ours, stating.teamsPrefixes, ruleKeysStatedBy(teamConfig), catalog)
  const [merged, teamAlone, oursAlone] = await Promise.all([
    calculatedRulesOfEach(mergeEslintConfig(teamConfig, parts.eslint, writeTeamOxlintConfigSettingNoRule(parts.eslint)), ESLINT_MERGE_FILES),
    calculatedRulesOfEach(buildTeamConfigAloneLintingEveryJsAndTsFile(teamConfig), ESLINT_MERGE_FILES),
    calculatedRulesOfEach(eslintPartAlone(parts.eslint, catalog, eslintPluginRegistry), ESLINT_MERGE_FILES),
  ])
  const sidesByFile = Object.fromEntries(
    ESLINT_MERGE_FILES.map((file): [string, SidesOfAFile] => [file, { team: linted(teamAlone, file), ours: oursIn(oursAlone, file) }]),
  )
  return { merged, sidesByFile, inPlay }
}

/** Every rule key a block of the team's config states, at any severity, whatever its files. */
function ruleKeysStatedBy(teamConfig: Linter.Config[]): ReadonlySet<string> {
  return new Set(defineConfig(teamConfig).flatMap(({ rules = {} }) => Object.keys(rules)))
}

/** The team's config alone, made to lint every JS and TS file, lints each file the shapes read. */
function linted(byFile: Readonly<Record<string, CalculatedRulesOrNotLinted>>, file: string): CalculatedRules {
  const rules = byFile[file]
  if (rules === undefined || rules === NOT_LINTED) throw new Error(`the team's config alone does not lint ${file}`)
  return rules
}

/** Our part alone states no rule in a file it does not lint, as one our ignores match. */
function oursIn(byFile: Readonly<Record<string, CalculatedRulesOrNotLinted>>, file: string): CalculatedRules {
  const rules = byFile[file]
  if (rules === undefined) throw new Error(`our part alone was not read in ${file}`)
  return rules === NOT_LINTED ? {} : rules
}

function entriesOwedIn({ merged, sidesByFile, inPlay }: ShapeRun): EntriesOwed {
  const names = namesInPlay(inPlay)
  const owed = Object.fromEntries(
    ESLINT_MERGE_FILES.map((file): [string, Record<string, CalculatedEntry>] => [
      file,
      Object.fromEntries(names.map((name) => [name, owedEntry(name, sidesOf(sidesByFile, file), inPlay)])),
    ]),
  )
  return {
    merged: Object.fromEntries(ESLINT_MERGE_FILES.map((file) => [file, mergedEntriesOf(merged[file], names)])),
    owed,
  }
}

function sidesOf(sidesByFile: Readonly<Record<string, SidesOfAFile>>, file: string): SidesOfAFile {
  const sides = sidesByFile[file]
  if (sides === undefined) throw new Error(`no sides were read in ${file}`)
  return sides
}

function mergedEntriesOf(merged: CalculatedRulesOrNotLinted | undefined, names: readonly string[]): Readonly<Record<string, CalculatedEntry>> | typeof NOT_LINTED {
  if (merged === undefined) throw new Error('a file of the shapes was not read')
  if (merged === NOT_LINTED) return NOT_LINTED
  return Object.fromEntries(names.map((name) => [name, calculatedEntryOf(merged, name)]))
}

/** Each file and the names in play the merged config turns on there that the team's config alone does not, as `file: name, name`. */
function namesOnBeyondTheTeamsIn({ merged, sidesByFile, inPlay }: ShapeRun): string[] {
  return ESLINT_MERGE_FILES.flatMap((file) => {
    const rules = merged[file]
    if (rules === undefined) throw new Error(`the merged config was not read in ${file}`)
    if (rules === NOT_LINTED) return []
    const beyond = namesOnBeyondTheTeams(rules, sidesOf(sidesByFile, file).team, inPlay)
    return beyond.length === 0 ? [] : [`${file}: ${beyond.join(', ')}`]
  })
}

function shapeStating({ stating }: EslintMergeShape): string {
  return stating.teams
}

/** The merged config of the shape, in the mode given. */
function mergedConfigOf(shape: Shape<EslintMergeShapeValue>, usesOxlint: boolean): ReturnType<typeof mergeEslintConfig> {
  const { teamConfig, lintRules } = buildEslintMergeShape(PROJECT, shape)
  const { eslint } = editorPartsOf(lintRules, catalog, usesOxlint)
  return mergeEslintConfig(teamConfig, eslint, writeTeamOxlintConfigSettingNoRule(eslint))
}

describe('the ESLint merge shapes', () => {
  // What the run leaves out, in its title, so a verbose run prints it.
  it(`run ${String(COVERAGE.shapes)} of the ${String(COVERAGE.combinations)} combinations, meeting every pair of values: left out, ${String(COVERAGE.triples - COVERAGE.triplesMet)} of the ${String(COVERAGE.triples)} triples of values meet in no shape`, () => {
    expect(pairsMetInNoShape(ESLINT_MERGE_DIMENSIONS, SHAPES)).toStrictEqual([])
  })

  // A name the team states that is no name in play would be compared nowhere.
  it('put the name each team block states among the names the merge is checked over', () => {
    const notInPlay = SHAPES.map((shape) => buildEslintMergeShape(PROJECT, shape)).filter(
      (built) => !namesInPlay(rulesInPlayOf(built.stating.ours, built.stating.teamsPrefixes, new Set(), catalog)).includes(shapeStating(built)),
    )

    expect(notInPlay.map(shapeStating)).toStrictEqual([])
  })

  // verify.md, U066: a block no path can match changes nothing, and the merge should never write one.
  it.each(MODES)('merge into configs writing no block whose files no path can match, $mode', ({ usesOxlint }) => {
    const blocksMatchingNoFile = SHAPES.flatMap((shape, index) =>
      eslintBlocksMatchingNoFile(mergedConfigOf(shape, usesOxlint)).map((block) => `shape ${String(index)}, ${block}`),
    )

    expect(blocksMatchingNoFile).toStrictEqual([])
  })
})

// Each shape's name in full in its title, which it.each's $-interpolation would cut short.
describe.each(MODES)('mergeEslintConfig $mode, against ESLint calculating each file', ({ usesOxlint }) => {
  SHAPES.forEach((shape, index) => {
    it(`shape ${String(index)} gives every name of the rule and its twins, in every file, the entry the contract owes: ${shapeNameOf(shape)}`, async () => {
      const { merged, owed } = entriesOwedIn(await runOf(shape, usesOxlint))

      expect(merged).toStrictEqual(owed)
    })
  })

  SHAPES.forEach((shape, index) => {
    it(`shape ${String(index)} adds no name of a rule to a file beyond those the team's config alone runs there: ${shapeNameOf(shape)}`, async () => {
      expect(namesOnBeyondTheTeamsIn(await runOf(shape, usesOxlint))).toStrictEqual([])
    })
  })
})
