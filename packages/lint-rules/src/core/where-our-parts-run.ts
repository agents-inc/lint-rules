import type { Catalog, RuleRoute } from '@workspace/rule-data'
import type { DummyRuleMap, OxlintOverride } from 'oxlint'
import { oxlintEnvOf, oxlintIgnorePatternsOf, oxlintOverridesOf, topLevelRuleMap } from './build-oxlint-config.ts'
import { isOxlintRoute, routeOf } from './catalog-lookups.ts'
import { eslintGlobalIgnoresOf, ignoresEslintAppliesToOurEditorPart, JS_AND_TS_FILES } from './eslint-file-types.ts'
import { bothOf, EVERY_FILE, eitherOf, type FilesCondition, filesInScopeOf, NO_FILE, notOf } from './file-conditions.ts'
import { filesEslintLeavesOutOf, filesOxlintLeavesOutOf } from './ignores-read-by-each-engine.ts'
import { filesOxlintRunsTheRuleIn } from './oxlint-file-types.ts'
import type { FileOverrideLayer, RuleLayers, RuleSetting } from './resolve-rule-layers.ts'
import { entryStatements } from './twin-pairs.ts'

// Our part for each engine read the way that engine applies the config our part alone would be,
// with that engine's reading of our ignores and its own file types (decisions.md, fix round 1
// review): where our oxlint part runs a rule, which the agent build and the ESLint merge ask to
// turn typescript-eslint's extension of it off there (D10), and the oxlint merge to state ours on
// exactly there; and the files our ESLint part does not lint, which the ESLint merge keeps our
// blocks out of (D-a). Each reading takes the ignores the agent build gives its engine, so the two
// cannot drift apart (decisions.md, fix round 2, after its review): oxlint's `ignorePatterns`, read
// as oxlint reads them; and ESLint's global ignores followed by its default ones, which hold in an
// editor merge whatever our negated lines say, as our ignores are not global there ("after its
// second review"). Neither reading loads ESLint's side, so a team's oxlint config can merge.

/** Our oxlint part as oxlint applies it: its overrides in the order oxlint applies them, and the files its ignore patterns leave out. */
export type OurOxlintPart = { readonly inLine: readonly OxlintOverride[]; readonly leftOut: FilesCondition }

/** The files our ESLint part does not lint in an editor merge. */
export type OurEslintPart = {
  /** The files our ignores leave out, and those ESLint's default ignores do, whatever our negated lines say. */
  readonly leftOut: FilesCondition
  /** Of those, the files our ignores leave out: ESLint keeps the rest out of every block itself, where no global ignore takes them back. */
  readonly leftOutByOurIgnores: FilesCondition
}

// Every file, at any depth, whatever its extension (measured: root, nested, dot folders, .js, .ts, .tsx).
export const CATCH_ALL_FILES: readonly string[] = ['**/*']

const OFF_SEVERITIES: ReadonlySet<unknown> = new Set(['off', 'allow', 0])

/** Our oxlint part's layers as oxlint reads them, under the ignore patterns the agent build gives it. */
export function ourOxlintPartOf(layers: RuleLayers, catalog: Catalog): OurOxlintPart {
  return { inLine: ourOxlintPartInLine(layers, catalog), leftOut: filesOxlintLeavesOutOf(oxlintIgnorePatternsOf(layers)) }
}

/** The files our ESLint part's layers leave out as ESLint reads them in an editor merge, under our ignores and its default ones after them. */
export function ourEslintPartOf(layers: RuleLayers): OurEslintPart {
  return {
    leftOut: filesEslintLeavesOutOf(ignoresEslintAppliesToOurEditorPart(layers)),
    leftOutByOurIgnores: filesEslintLeavesOutOf(eslintGlobalIgnoresOf(layers)),
  }
}

/**
 * Our oxlint part's overrides in the order oxlint applies them: its top-level rules and env as one
 * for every file, then its own (`oxlintOverridesOf`), as the agent build lays them out.
 */
export function ourOxlintPartInLine(layers: RuleLayers, catalog: Catalog): OxlintOverride[] {
  return [{ files: [...CATCH_ALL_FILES], env: oxlintEnvOf(layers), rules: topLevelRuleMap(layers, catalog) }, ...oxlintOverridesOf(layers, catalog)]
}

/** Where our oxlint part runs the rule: where an override of it turns the rule on and none after it turns it off, outside our ignores, in a file of a type the rule runs in. */
export function whereOurOxlintPartRuns(ruleId: string, ourPart: OurOxlintPart, catalog: Catalog): FilesCondition {
  const { oxlintName } = oxlintRouteOf(routeOf(ruleId, catalog))
  return bothOf(eitherOf(...whereEachOverrideTurningItOnLeavesItOn(oxlintName, ourPart)), filesOxlintRunsTheRuleIn(oxlintName))
}

/**
 * Where our ESLint part's layers run the rule, as their blocks state it: the top level's setting
 * within the rule's own files and ignores, then each entry in turn, turning it on in its files within
 * those, or off in all of them; and only in JS and TS files, the ones our blocks lint. Our ignores
 * are not read here: the ESLint merge keeps our blocks out of their files (`ourEslintPartOf`).
 */
export function whereOurEslintPartRuns(ruleId: string, layers: RuleLayers): FilesCondition {
  const topLevel = layers.rules[ruleId]
  const fromTheTopLevel = topLevel === undefined ? NO_FILE : filesOfTheSetting(topLevel)
  const where = layers.fileOverrides.reduce((before, layer) => whereAfterTheEntry(before, layer, ruleId), fromTheTopLevel)
  return bothOf(where, filesInScopeOf([JS_AND_TS_FILES], []))
}

/** Where the rule runs once the entry's blocks apply: as before outside its files, and inside them as it states the rule, where it does. */
function whereAfterTheEntry(before: FilesCondition, layer: FileOverrideLayer, ruleId: string): FilesCondition {
  const stated = entryStatements(layer).settings[ruleId]
  if (stated === undefined) return before
  const entryFiles = filesInScopeOf(layer.files, [])
  if (stated.severity === 'off') return bothOf(before, notOf(entryFiles))
  return eitherOf(before, bothOf(entryFiles, filesOfTheSetting(stated)))
}

/** The files a rule's setting keeps it to: its own files, less its ignores. */
function filesOfTheSetting({ files, ignores }: RuleSetting): FilesCondition {
  return filesInScopeOf(files, ignores === null ? [] : ignores)
}

/** For each override of ours turning the rule on, where it leaves the rule on. */
function whereEachOverrideTurningItOnLeavesItOn(oxlintName: string, { inLine, leftOut }: OurOxlintPart): FilesCondition[] {
  return inLine.flatMap((override, index) =>
    isOn(rulesOf(override)[oxlintName]) ? [whereTheOverrideLeavesItOn(override, inLine.slice(index + 1), oxlintName, leftOut)] : [],
  )
}

/** The files an override of ours applies to and our ignores leave in, less those of each later override of ours turning the rule off. */
export function whereTheOverrideLeavesItOn(override: OxlintOverride, later: readonly OxlintOverride[], oxlintName: string, leftOut: FilesCondition): FilesCondition {
  const turningItOff = later.filter((each) => isStatedOff(rulesOf(each)[oxlintName])).map(filesTheOverrideAppliesTo)
  return bothOf(whereTheOverrideApplies(override, leftOut), notOf(eitherOf(...turningItOff)))
}

/** The files an override of ours applies to that our ignores leave in. */
export function whereTheOverrideApplies(override: OxlintOverride, leftOut: FilesCondition): FilesCondition {
  return bothOf(filesTheOverrideAppliesTo(override), notOf(leftOut))
}

/**
 * The files an override applies to, as oxlint reads it: those any glob of `files` matches and no
 * glob of `excludeFiles` does, a negated glob in either matching every file the glob does not
 * (measured, oxlint 1.87).
 */
function filesTheOverrideAppliesTo({ files, excludeFiles = [] }: OxlintOverride): FilesCondition {
  return bothOf(isEveryFile(files) ? EVERY_FILE : filesAnyOf(files), notOf(filesAnyOf(excludeFiles)))
}

function filesAnyOf(globs: readonly string[]): FilesCondition {
  return eitherOf(...globs.map((glob) => [{ all: [glob], none: [] }]))
}

function isEveryFile(files: readonly string[]): boolean {
  return files.some((glob) => CATCH_ALL_FILES.includes(glob))
}

function rulesOf({ rules = {} }: OxlintOverride): DummyRuleMap {
  return rules
}

function oxlintRouteOf(route: RuleRoute): RuleRoute & { readonly oxlintName: string } {
  if (!isOxlintRoute(route)) throw new Error(`${route.id}: our oxlint part runs only oxlint-routed rules`)
  return route
}

function isOn(entry: unknown): boolean {
  return entry !== undefined && !OFF_SEVERITIES.has(Array.isArray(entry) ? entry[0] : entry)
}

function isStatedOff(entry: unknown): boolean {
  return entry !== undefined && !isOn(entry)
}
