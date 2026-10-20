import { type Catalog, isOxlintRoute, routeOf, type RuleRoute } from '@workspace/rule-data'
import type { OxlintOverride } from 'oxlint'
import { oxlintEnvOf, oxlintIgnorePatternsOf, oxlintOverridesOf, topLevelRuleMap } from './build-oxlint-config.ts'
import { eslintGlobalIgnoresOf, ignoresEslintAppliesToOurEditorPart, JS_AND_TS_FILES } from './eslint-file-types.ts'
import { bothOf, EVERY_FILE, eitherOf, type FilesCondition, filesInScopeOf, NO_FILE, notOf } from './file-conditions.ts'
import { EVERY_FILE_AT_ANY_DEPTH } from './globs.ts'
import { filesEslintLeavesOutOf, filesOxlintLeavesOutOf } from './ignores-read-by-each-engine.ts'
import { isOn, type RuleEntry, rulesOf } from './oxlint-config-reading.ts'
import { filesOxlintRunsTheRuleIn } from './oxlint-file-types.ts'
import type { FileOverrideLayer, RuleLayers, RuleSetting } from './resolve-rule-layers.ts'
import { entryStatements } from './twin-pairs.ts'

// Each engine's part read as that engine applies it, with its reading of our ignores and its own file types,
// taking the same ignores the agent build gives it so the two cannot drift. Loads nothing of ESLint's side,
// so a team's oxlint config can merge.

export type OurOxlintPart = { readonly inLine: readonly OxlintOverride[]; readonly leftOut: FilesCondition }

export type OurEslintPart = {
  /** Our ignores and ESLint's default ones, whatever our negated lines say. */
  readonly leftOut: FilesCondition
  /** ESLint keeps the rest out of every block itself, where no global ignore takes them back. */
  readonly leftOutByOurIgnores: FilesCondition
}

export function ourOxlintPartOf(layers: RuleLayers, catalog: Catalog): OurOxlintPart {
  return { inLine: ourOxlintPartInLine(layers, catalog), leftOut: filesOxlintLeavesOutOf(oxlintIgnorePatternsOf(layers)) }
}

export function ourEslintPartOf(layers: RuleLayers): OurEslintPart {
  return {
    leftOut: filesEslintLeavesOutOf(ignoresEslintAppliesToOurEditorPart(layers)),
    leftOutByOurIgnores: filesEslintLeavesOutOf(eslintGlobalIgnoresOf(layers)),
  }
}

/** The top-level rules and env as one override for every file, then its own, as the agent build lays them out. */
function ourOxlintPartInLine(layers: RuleLayers, catalog: Catalog): OxlintOverride[] {
  return [{ files: [EVERY_FILE_AT_ANY_DEPTH], env: oxlintEnvOf(layers), rules: topLevelRuleMap(layers, catalog) }, ...oxlintOverridesOf(layers, catalog)]
}

export function whereOurOxlintPartRuns(ruleId: string, ourPart: OurOxlintPart, catalog: Catalog): FilesCondition {
  const { oxlintName } = oxlintRouteOf(routeOf(ruleId, catalog))
  return bothOf(eitherOf(...whereEachOverrideTurningItOnLeavesItOn(oxlintName, ourPart)), filesOxlintRunsTheRuleIn(oxlintName))
}

/** Only in JS and TS files, the ones our blocks lint. Our ignores are not read here: the ESLint merge keeps our blocks out of their files. */
export function whereOurEslintPartRuns(ruleId: string, layers: RuleLayers): FilesCondition {
  const topLevel = layers.rules[ruleId]
  const fromTheTopLevel = topLevel === undefined ? NO_FILE : filesOfTheSetting(topLevel)
  const where = layers.fileOverrides.reduce((before, layer) => whereAfterTheEntry(before, layer, ruleId), fromTheTopLevel)
  return bothOf(where, filesInScopeOf([JS_AND_TS_FILES], []))
}

function whereAfterTheEntry(before: FilesCondition, layer: FileOverrideLayer, ruleId: string): FilesCondition {
  const stated = entryStatements(layer).settings[ruleId]
  if (stated === undefined) return before
  const entryFiles = filesInScopeOf(layer.files, [])
  if (stated.severity === 'off') return bothOf(before, notOf(entryFiles))
  return eitherOf(before, bothOf(entryFiles, filesOfTheSetting(stated)))
}

function filesOfTheSetting({ files, ignores }: RuleSetting): FilesCondition {
  return filesInScopeOf(files, ignores === null ? [] : ignores)
}

function whereEachOverrideTurningItOnLeavesItOn(oxlintName: string, { inLine, leftOut }: OurOxlintPart): FilesCondition[] {
  return inLine.flatMap((override, index) =>
    isOn(rulesOf(override)[oxlintName]) ? [whereTheOverrideLeavesItOn(override, inLine.slice(index + 1), oxlintName, leftOut)] : [],
  )
}

export function whereTheOverrideLeavesItOn(override: OxlintOverride, later: readonly OxlintOverride[], oxlintName: string, leftOut: FilesCondition): FilesCondition {
  const turningItOff = later.filter((each) => isStatedOff(rulesOf(each)[oxlintName])).map(filesTheOverrideAppliesTo)
  return bothOf(whereTheOverrideApplies(override, leftOut), notOf(eitherOf(...turningItOff)))
}

export function whereTheOverrideApplies(override: OxlintOverride, leftOut: FilesCondition): FilesCondition {
  return bothOf(filesTheOverrideAppliesTo(override), notOf(leftOut))
}

/** A negated glob in either matches every file the glob does not (measured, oxlint 1.87). */
function filesTheOverrideAppliesTo({ files, excludeFiles = [] }: OxlintOverride): FilesCondition {
  return bothOf(isEveryFile(files) ? EVERY_FILE : filesAnyOf(files), notOf(filesAnyOf(excludeFiles)))
}

function filesAnyOf(globs: readonly string[]): FilesCondition {
  return eitherOf(...globs.map((glob) => [{ all: [glob], none: [] }]))
}

function isEveryFile(files: readonly string[]): boolean {
  return files.includes(EVERY_FILE_AT_ANY_DEPTH)
}

function oxlintRouteOf(route: RuleRoute): RuleRoute & { readonly oxlintName: string } {
  if (!isOxlintRoute(route)) throw new Error(`${route.id}: our oxlint part runs only oxlint-routed rules`)
  return route
}

function isStatedOff(entry: RuleEntry | undefined): boolean {
  return entry !== undefined && !isOn(entry)
}
