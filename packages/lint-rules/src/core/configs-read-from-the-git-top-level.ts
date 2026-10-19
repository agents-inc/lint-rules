import type { Linter } from 'eslint'
import type { OxlintConfig, OxlintOverride } from 'oxlint'
import { isLedByAnyDepth, keepingNegation, literalGlobOf, withoutRootAnchor } from './globs.ts'

/** The two configs buildAgentConfigs returns. */
export type EngineConfigs = { readonly eslint: readonly Linter.Config[]; readonly oxlint: OxlintConfig }

export type EngineConfigsToRun = { readonly eslint: Linter.Config[]; readonly oxlint: OxlintConfig }

type GlobRead = (glob: string) => string

/** How an engine reads the globs naming the files a block applies to, and those naming the files it leaves out. */
type GlobReads = { readonly files: GlobRead; readonly ignores: GlobRead }

type FilesEntry = NonNullable<Linter.Config['files']>[number]

const AT_THE_GIT_TOP_LEVEL = ''
const FOLDER_SEPARATOR = '/'

/**
 * Both configs as the engines read them from the git top level: `configFolder`, the config's folder from
 * there (`/`-separated, empty at the top), goes in front of every glob tied to a folder, as a literal.
 */
export function configsReadFromTheGitTopLevel({ eslint, oxlint }: EngineConfigs, configFolder: string): EngineConfigsToRun {
  if (configFolder === AT_THE_GIT_TOP_LEVEL) return { eslint: [...eslint], oxlint }
  const folder = literalGlobOf(configFolder)
  return {
    eslint: eslint.map((block) => eslintBlockRead(block, readsFrom(folder, isTiedToAFolderInEslint))),
    oxlint: oxlintConfigRead(oxlint, readsFrom(folder, isTiedToAFolderInOxlint)),
  }
}

/** Neither engine reads a `files` glob led by `/` as any file (ESLint 10.12, oxlint 1.87), so it stays one that names none. */
function readsFrom(folder: string, isTiedToAFolder: (pattern: string) => boolean): GlobReads {
  return {
    files: readFrom(folder, (pattern) => !isLedByARootSlash(pattern) && isTiedToAFolder(pattern)),
    ignores: readFrom(folder, isTiedToAFolder),
  }
}

function isLedByARootSlash(pattern: string): boolean {
  return pattern.startsWith(FOLDER_SEPARATOR)
}

/** ESLint reads a slash-free glob from its root alone (@eslint/config-array matches without matchBase). */
function isTiedToAFolderInEslint(pattern: string): boolean {
  return !isLedByAnyDepth(pattern)
}

/** oxlint reads a slash-free glob at any depth. */
function isTiedToAFolderInOxlint(pattern: string): boolean {
  return pattern.includes(FOLDER_SEPARATOR) && !isLedByAnyDepth(pattern)
}

function readFrom(folder: string, isTiedToAFolder: (pattern: string) => boolean): GlobRead {
  const patternRead = (pattern: string): string => (isTiedToAFolder(pattern) ? underTheFolder(folder, pattern) : pattern)
  return (glob) => keepingNegation(glob, patternRead)
}

function underTheFolder(folder: string, pattern: string): string {
  return `${folder}${FOLDER_SEPARATOR}${withoutRootAnchor(pattern)}`
}

/** ESLint reads globs under `files` and `ignores` alone: plugins, parsers and settings are passed on as they are. */
function eslintBlockRead(block: Linter.Config, reads: GlobReads): Linter.Config {
  const { files, ignores } = block
  return {
    ...block,
    ...(files === undefined ? {} : { files: files.map((entry) => filesEntryRead(entry, reads.files)) }),
    ...(ignores === undefined ? {} : { ignores: ignores.map(reads.ignores) }),
  }
}

/** A nested list is globs a file must all match. */
function filesEntryRead(entry: FilesEntry, read: GlobRead): FilesEntry {
  return typeof entry === 'string' ? read(entry) : entry.map(read)
}

function oxlintConfigRead(config: OxlintConfig, reads: GlobReads): OxlintConfig {
  const { ignorePatterns, overrides } = config
  return {
    ...config,
    ...(ignorePatterns === undefined ? {} : { ignorePatterns: ignorePatterns.map(reads.ignores) }),
    ...(overrides === undefined ? {} : { overrides: overrides.map((override) => oxlintOverrideRead(override, reads.files)) }),
  }
}

/** `excludeFiles` names files as `files` does: oxlint reads both alike. */
function oxlintOverrideRead(override: OxlintOverride, read: GlobRead): OxlintOverride {
  const { files, excludeFiles } = override
  return { ...override, files: files.map(read), ...(excludeFiles === undefined ? {} : { excludeFiles: excludeFiles.map(read) }) }
}
