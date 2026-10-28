import { catalog } from '@workspace/rule-data'
import type { OxlintConfig } from 'oxlint'
import type { EditorParts, OxlintPart } from '../core/editor-parts.ts'
import { defineLintRules, type LintRules } from '../index.ts'
import { oxlintPartOf } from './agent-configs.ts'
import { buildConsumerLintRules } from './factories/lint-rules-factories.ts'
import { buildPackageJsonListingOxlint, packageJsonText } from './factories/package-json-factories.ts'
import { oxlintEntryOfRuleFor, severityOfOxlintEntry } from './oxlint-config-oracle.ts'
import { INSTALLED_OXLINT, type ProjectFiles, type TempProjects } from './temp-projects.ts'

// What merge-other-engine-config.test.ts and its refusals build each merge from.

export type OurRules = NonNullable<LintRules['rules']>

/** What severityStatedFor gives where no entry of the rule applies in the file. */
export const NOT_STATED = 'not stated'

export function projectListingOxlintIn(tempProjects: TempProjects, files: ProjectFiles = {}): string {
  return tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()), ...files }, linkedPackages: [INSTALLED_OXLINT] })
}

/** Our settings listing no ruleset and turning on the rules given. */
export function ourPartsIn(projectDir: string, rules: OurRules = {}): EditorParts {
  return defineLintRules(buildConsumerLintRules(projectDir, {}, { rules })).editorRulesets
}

/** Throws where the project lists no oxlint. */
export function ourOxlintPartIn(projectDir: string, rules: OurRules = {}): OxlintPart {
  return oxlintPartOf(ourPartsIn(projectDir, rules))
}

/** Under any spelling oxlint takes it by: NOT_STATED where none applies there. */
export function severityStatedFor(merged: Readonly<OxlintConfig>, file: string, ruleId: string): string {
  const route = catalog.rules.get(ruleId)
  if (route === undefined) throw new Error(`${ruleId} is no rule of ours`)
  const entry = oxlintEntryOfRuleFor(merged, file, route.oxlintSpellings)
  return entry === undefined ? NOT_STATED : severityOfOxlintEntry(entry)
}
