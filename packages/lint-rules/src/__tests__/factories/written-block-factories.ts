import type { Linter } from 'eslint'
import type { OxlintConfig, OxlintOverride } from 'oxlint'

// Blocks and overrides as a merge writes them, read for the files they apply to: each turns one rule off.

const A_RULE_OFF = { 'no-debugger': 'off' } as const

export function buildWrittenEslintBlock(name: string, files: readonly (string | readonly string[])[], ignores: readonly string[] = []): Linter.Config {
  return {
    name,
    files: files.map((entry) => (typeof entry === 'string' ? entry : [...entry])),
    ...(ignores.length === 0 ? {} : { ignores: [...ignores] }),
    rules: A_RULE_OFF,
  }
}

export function buildWrittenOxlintOverride(files: readonly string[], excludeFiles: readonly string[] = []): OxlintOverride {
  return { files: [...files], ...(excludeFiles.length === 0 ? {} : { excludeFiles: [...excludeFiles] }), rules: A_RULE_OFF }
}

export function buildWrittenOxlintConfig(overrides: readonly OxlintOverride[], extended: readonly OxlintConfig[] = []): OxlintConfig {
  return { ...(extended.length === 0 ? {} : { extends: [...extended] }), overrides: [...overrides] }
}
