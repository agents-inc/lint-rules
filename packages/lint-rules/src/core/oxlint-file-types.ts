import { fileTypesOxlintRunsTheRuleIn, oxlintDeclarationFiles } from '@workspace/rule-data/oxlint-file-types'
import { eitherOf, type FilesCondition } from './file-conditions.ts'
import { filesOfExtensions } from './globs.ts'

/** The files our oxlint part may run the rule in, by their type, as rule-data records them for oxlint. */
export function filesOxlintRunsTheRuleIn(oxlintName: string): FilesCondition {
  const { extensions, skipsDeclarationFiles } = fileTypesOxlintRunsTheRuleIn(oxlintName)
  return eitherOf([{ all: [filesOfExtensions(extensions)], none: skipsDeclarationFiles ? [...oxlintDeclarationFiles] : [] }])
}
