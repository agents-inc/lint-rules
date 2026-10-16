import { describeFinding, type EngineFinding } from './engine-clis.ts'

/** A rule of ours, and every name either engine reports it under. */
export type RuleByItsNames = { readonly rule: string; readonly names: readonly string[] }

/** One file's findings of each rule, as `file:line name`, sorted. */
type FindingsByRule = Readonly<Record<string, readonly string[]>>

/** Each file's findings of each rule: by file, then by rule. */
export type FindingsByFileAndRule = Readonly<Record<string, FindingsByRule>>

/** Each file's findings of each rule given, under any of its names, from either engine: none where it has none. */
export function findingsByFileAndRule(
  findings: readonly EngineFinding[],
  files: readonly string[],
  rules: readonly RuleByItsNames[],
): FindingsByFileAndRule {
  return Object.fromEntries(
    files.map((file) => [file, Object.fromEntries(rules.map(({ rule, names }) => [rule, findingsUnderIn(findings, names, file)]))]),
  )
}

/**
 * What the merged configs owe, rule by rule (decisions.md, "Owner 2026-10-14"; spec-merge-model.md,
 * 1.1): in every file, the team's configs' alone for each rule the team sets anywhere, in either
 * config, whether or not our part reports it there; our part alone's for every other rule. Either
 * way, from one engine. `rulesTheTeamSets` names rules as `findingsByFileAndRule` was given them.
 */
export function owedBesideTheTeam(
  oursAlone: FindingsByFileAndRule,
  teamAlone: FindingsByFileAndRule,
  rulesTheTeamSets: readonly string[],
): FindingsByFileAndRule {
  const files = Object.entries(oursAlone)
  const notRead = rulesTheTeamSets.filter((rule) => files.some(([, ours]) => ours[rule] === undefined))
  if (notRead.length > 0) throw new Error(`our part alone was not read for ${notRead.join(', ')}, which the team sets`)
  return Object.fromEntries(
    files.map(([file, ours]) => [file, owedInTheFile(ours, entryOf(teamAlone, file, 'the team alone was not read in'), new Set(rulesTheTeamSets))]),
  )
}

/** The files given that hold a finding of the rule, under any of its names, from the engine given. */
export function filesReportingIn(
  findings: readonly EngineFinding[],
  files: readonly string[],
  { names }: RuleByItsNames,
  engine: EngineFinding['engine'],
): string[] {
  return files.filter((file) => findingsOfIn(findings, names, file).some((finding) => finding.engine === engine))
}

/** Each file's messages of a rule, under any of its names, from either engine, sorted. */
export function messagesByFile(
  findings: readonly EngineFinding[],
  files: readonly string[],
  names: readonly string[],
): Readonly<Record<string, readonly string[]>> {
  return Object.fromEntries(files.map((file) => [file, findingsOfIn(findings, names, file).map(({ message }) => message).toSorted()]))
}

/** The team's for each rule it sets, ours for every other. */
function owedInTheFile(ours: FindingsByRule, teams: FindingsByRule, rulesTheTeamSets: ReadonlySet<string>): FindingsByRule {
  return Object.fromEntries(
    Object.entries(ours).map(([rule, found]) => [rule, rulesTheTeamSets.has(rule) ? entryOf(teams, rule, 'the team alone was not read for') : found]),
  )
}

/** The file's findings under any of the names, as `file:line name`, sorted. */
function findingsUnderIn(findings: readonly EngineFinding[], names: readonly string[], file: string): string[] {
  return findingsOfIn(findings, names, file).map(describeFinding).toSorted()
}

function findingsOfIn(findings: readonly EngineFinding[], names: readonly string[], file: string): EngineFinding[] {
  return findings.filter((finding) => finding.file === file && names.includes(finding.rule))
}

function entryOf<Value>(record: Readonly<Record<string, Value>>, key: string, missing: string): Value {
  const value = record[key]
  if (value === undefined) throw new Error(`${missing} ${key}`)
  return value
}
