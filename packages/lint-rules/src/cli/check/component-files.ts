import type { SuppressionMode } from '@workspace/rule-data'
import type { Linter } from 'eslint'
import { agentLinterOptionsOf } from '../../core/build-eslint-config.ts'
import { filesOfExtensions, normalizeGlob } from '../../core/globs.ts'
import { type FileOverrideInput, type LintRulesInput, suppressionModeSetBy } from '../../core/lint-rules-input.ts'
import { topLevelSuppressionMode } from '../../core/resolve-rule-layers.ts'

// oxlint lints these components' scripts (rule-data's oxlint-file-types.json); ESLint, given our parser,
// cannot read them, so check gives it none to lint.
const COMPONENT_EXTENSIONS: ReadonlySet<string> = new Set(['vue', 'svelte', 'astro'])
const COMPONENT_FILES = filesOfExtensions([...COMPONENT_EXTENSIONS])
const COMPONENT_FILES_BLOCK = 'agents-inc/check/component-files'

/** Without its dot. */
export function isAComponentExtension(extension: string): boolean {
  return COMPONENT_EXTENSIONS.has(extension)
}

/**
 * ESLint still says which component files the config ignores, and where they may hold suppressions:
 * these blocks name them, and give them the inline config guard the agent build gives JS and TS files,
 * the top level's, then each entry's that sets `allowSuppressions`, whose own blocks name JS and TS
 * files alone.
 */
export function componentFileBlocksOf({ allowSuppressions, fileOverrides = [] }: Pick<LintRulesInput, 'allowSuppressions' | 'fileOverrides'>): Linter.Config[] {
  return [
    guardBlock(COMPONENT_FILES_BLOCK, [COMPONENT_FILES], topLevelSuppressionMode(allowSuppressions)),
    ...fileOverrides.flatMap((entry, index) => entryGuardBlocks(entry, index)),
  ]
}

function entryGuardBlocks({ files, allowSuppressions }: FileOverrideInput, index: number): Linter.Config[] {
  const mode = suppressionModeSetBy(allowSuppressions)
  if (mode === null) return []
  return [guardBlock(`${COMPONENT_FILES_BLOCK}/file-overrides/${String(index)}`, files.map(componentFilesMatching), mode)]
}

/** ESLint ANDs the globs inside a nested list. */
function componentFilesMatching(glob: string): string[] {
  return [normalizeGlob(glob), COMPONENT_FILES]
}

function guardBlock(name: string, files: NonNullable<Linter.Config['files']>, mode: SuppressionMode): Linter.Config {
  return { name, files, linterOptions: agentLinterOptionsOf(mode) }
}
