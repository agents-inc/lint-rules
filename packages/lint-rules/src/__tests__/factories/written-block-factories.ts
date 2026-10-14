import type { Linter } from 'eslint'
import type { OxlintConfig, OxlintOverride } from 'oxlint'

// Blocks and overrides as a merge writes them, read for the files they apply to: each turns one rule off.

const A_RULE_OFF = { 'no-debugger': 'off' } as const

/** An ESLint block of ours applying to the `files` entries given, less its ignores. */
export function buildWrittenEslintBlock(name: string, files: readonly (string | readonly string[])[], ignores: readonly string[] = []): Linter.Config {
  return {
    name,
    files: files.map((entry) => (typeof entry === 'string' ? entry : [...entry])),
    ...(ignores.length === 0 ? {} : { ignores: [...ignores] }),
    rules: A_RULE_OFF,
  }
}

/** An oxlint override applying to the files given, less those excluded. */
export function buildWrittenOxlintOverride(files: readonly string[], excludeFiles: readonly string[] = []): OxlintOverride {
  return { files: [...files], ...(excludeFiles.length === 0 ? {} : { excludeFiles: [...excludeFiles] }), rules: A_RULE_OFF }
}

/** An oxlint config holding the overrides given, and extending the configs given as objects. */
export function buildWrittenOxlintConfig(overrides: readonly OxlintOverride[], extended: readonly OxlintConfig[] = []): OxlintConfig {
  return { ...(extended.length === 0 ? {} : { extends: [...extended] }), overrides: [...overrides] }
}
