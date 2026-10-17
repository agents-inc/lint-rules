import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { ESLint } from 'eslint'
import { builtinRules } from 'eslint/use-at-your-own-risk'
import typescriptEslint from 'typescript-eslint'

import type { Catalog } from '../catalog.ts'
import { ruleNameOf } from '../rule-id-parts.ts'
import type { ReportKind } from './cases/extension-only-option-fixtures.ts'
import { buildOxlintConfigRunningTheRuleWith } from './factories/oxlint-config-factories.ts'
import { type OxlintJsonReport, oxlintJsonRun } from './oxlint-cli.ts'
import { typescriptEslintRules } from './typescript-eslint-extensions.ts'

// Each twin pair oxlint runs the core rule of, and each engine's report on a file under the options
// given, for checking data/oxlint-refused-options.json against the installed engines.

/** A core rule oxlint runs, by its ID and oxlint's name for it, and typescript-eslint's current version of it. */
export type TwinPairRoutedToOxlint = {
  readonly coreRule: string
  readonly extension: string
  readonly oxlintName: string
  readonly oxlintPlugin: string
}

/** What an engine made of a file: its report, or, for oxlint, its refusal to load the config. */
export type EngineReport = { readonly outcome: 'refused' } | { readonly outcome: 'reported'; readonly report: readonly string[] }

const TYPESCRIPT_ESLINT_PREFIX = '@typescript-eslint'
const OXLINT_CONFIG_FILE = 'fixture.oxlintrc.json'
const TS_FILES = '**/*.ts'

/** Each core rule routed to oxlint, paired with each extension of it the catalog records as no alias of it. */
export function twinPairsRoutedToOxlint({ rules, coreRuleExtensions }: Catalog): TwinPairRoutedToOxlint[] {
  return [...rules.values()].flatMap(({ id, engine, oxlintName, oxlintPlugin, eslintAliases }) => {
    const extensions = coreRuleExtensions.get(id)
    if (engine !== 'oxlint' || oxlintName === null || oxlintPlugin === null || extensions === undefined) return []
    return extensions.filter((extension) => !eslintAliases.includes(extension)).map((extension) => ({ coreRule: id, extension, oxlintName, oxlintPlugin }))
  })
}

/** The schema of typescript-eslint's rule, as its installed plugin declares it: none for a rule that declares no options. */
export function schemaOfTheExtension(extension: string): unknown {
  const rule = typescriptEslintRules()[ruleNameOf(extension)]
  if (rule === undefined || typeof rule === 'function') throw new Error(`typescript-eslint's installed plugin has no rule ${extension}`)
  return schemaDeclaredBy(rule.meta)
}

/** The schema of ESLint's core rule, as the installed ESLint declares it: none for a rule that declares no options. */
export function schemaOfTheCoreRule(coreRule: string): unknown {
  const rule = builtinRules.get(coreRule)
  if (rule === undefined) throw new Error(`the installed ESLint has no core rule ${coreRule}`)
  return schemaDeclaredBy(rule.meta)
}

/** A rule's schema: none, so no options, where its meta declares none. */
function schemaDeclaredBy(meta: { readonly schema?: unknown } | undefined): unknown {
  return meta === undefined || meta.schema === undefined ? [] : meta.schema
}

/**
 * typescript-eslint's rule over the project's TS file, with the options given, through the real
 * ESLint and the project's tsconfig: the lines it reports, or the file's text after its safe fixes.
 */
export async function typescriptEslintReportOn(projectDir: string, extension: string, options: readonly unknown[], file: string, kind: ReportKind): Promise<readonly string[]> {
  const eslint = new ESLint({
    cwd: projectDir,
    overrideConfigFile: true,
    fix: kind === 'fixed text',
    overrideConfig: [
      {
        files: [TS_FILES],
        languageOptions: { parser: typescriptEslint.parser, parserOptions: { projectService: true, tsconfigRootDir: projectDir } },
        plugins: { [TYPESCRIPT_ESLINT_PREFIX]: typescriptEslint.plugin },
        rules: { [extension]: ['error', ...options] },
      },
    ],
  })
  const [result] = await eslint.lintFiles([file])
  if (result === undefined) throw new Error(`ESLint linted no ${file}`)
  const fatal = result.messages.filter(({ fatal: isFatal }) => isFatal === true)
  if (fatal.length > 0) throw new Error(`ESLint could not lint ${file}: ${fatal.map(({ message }) => message).join('; ')}`)
  if (kind === 'fixed text') return [result.output === undefined ? readFileSync(join(projectDir, file), 'utf8') : result.output]
  return linesOf(result.messages.filter(({ ruleId }) => ruleId === extension).map(({ line }) => line))
}

/**
 * oxlint's copy of the core rule over the file, written with the source given first, with the
 * options given: the lines it reports, or the file's text after its safe fixes (`--fix`); or its
 * refusal to load the config.
 */
export function oxlintReportOn(projectDir: string, pair: TwinPairRoutedToOxlint, options: readonly unknown[], file: string, source: string, kind: ReportKind): EngineReport {
  writeFileSync(join(projectDir, file), source)
  const config = buildOxlintConfigRunningTheRuleWith(pair.oxlintName, options, { plugins: [pair.oxlintPlugin] })
  writeFileSync(join(projectDir, OXLINT_CONFIG_FILE), JSON.stringify(config))
  const fixing = kind === 'fixed text' ? ['--fix'] : []
  const run = oxlintJsonRun(projectDir, OXLINT_CONFIG_FILE, [...fixing, file])
  if (run.outcome === 'refused') return { outcome: 'refused' }
  if (kind === 'fixed text') return { outcome: 'reported', report: [readFileSync(join(projectDir, file), 'utf8')] }
  return { outcome: 'reported', report: linesOf(diagnosticLinesIn(run.report)) }
}

function diagnosticLinesIn({ diagnostics }: OxlintJsonReport): number[] {
  return diagnostics.flatMap(({ labels: [firstLabel] }) => (firstLabel === undefined ? [] : [firstLabel.span.line]))
}

/** Each line once, as `line N`, in order. */
function linesOf(lines: readonly number[]): string[] {
  return [...new Set(lines)].toSorted((first, second) => first - second).map((line) => `line ${String(line)}`)
}
