import { spawnSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { ESLint, type Linter } from 'eslint'
import { defineConfig } from 'eslint/config'
import type { OxlintConfig } from 'oxlint'
import { beforeAll } from 'vitest'
import { mergeEslintConfig } from '../eslint.ts'
import { mergeOxlintConfig } from '../oxlint.ts'
import { agentConfigsOf, type DefinedLintRules } from './agent-configs.ts'
import { writeOxlintConfigFile } from './engine-clis.ts'
import { rulesNotFoundAmong } from './rules-not-found.ts'
import { NO_TEAM_ESLINT_CONFIG, type TeamEslintConfigPath } from './team-configs-of-the-other-engine.ts'
import { INSTALLED_OXLINT, type LinkedPackage, type ProjectFiles, setUpTempProjects } from './temp-projects.ts'

export type ProcessOutput = { readonly exitCode: number | null; readonly stdout: string }

type OxlintLabel = { readonly span: { readonly line: number } }

type OxlintDiagnostic = {
  readonly code: string
  readonly filename: string
  readonly severity: string
  readonly labels: readonly OxlintLabel[]
}

/** One ESLint message: `ruleId` null for ESLint's own, a parse error or an inline-config warning. */
export type EslintMessageAt = { readonly ruleId: string | null; readonly severity: number; readonly line: number }

/** A finding at error severity from either engine, under the engine's own name for the rule. */
export type ErrorAt = { readonly engine: 'eslint' | 'oxlint'; readonly rule: string | null; readonly line: number | null }

export type OxlintReport = { readonly diagnostics: readonly OxlintDiagnostic[]; readonly number_of_rules: number }

/** The team's own configs an editor build merges our parts into. */
export type TeamConfigs = {
  readonly teamEslintConfig: Parameters<typeof mergeEslintConfig>[0]
  readonly teamOxlintConfig: Parameters<typeof mergeOxlintConfig>[0]
}

/**
 * Which configs a run lints with: the agent build, through the internal hook, or the editor parts
 * merged into a team's configs. An editor build of a project whose package.json lists no oxlint
 * has no oxlint part, so oxlint does not run.
 */
export type EngineBuild = { readonly kind: 'agent' } | ({ readonly kind: 'editor' } & TeamConfigs)

export const AGENT_BUILD: EngineBuild = { kind: 'agent' }

/** Every file path is relative to the temp project, which is both engines' cwd. */
export type EngineRun = {
  readonly projectDir: () => string
  readonly emittedOxlintConfig: () => OxlintConfig
  readonly emittedEslintConfig: () => readonly Linter.Config[]
  /** `oxlint -f json .` */
  readonly oxlintLint: () => ProcessOutput
  /** `oxlint --print-config` */
  readonly oxlintPrint: () => ProcessOutput
  readonly oxlintReport: () => OxlintReport
  readonly eslintResults: () => readonly ESLint.LintResult[]
  /** oxlint's diagnostic codes on the file, in oxlint's spelling: `eslint(no-undef)`. */
  readonly oxlintCodesOn: (file: string) => string[]
  readonly eslintRuleIdsOn: (file: string) => (string | null)[]
  readonly eslintMessagesOn: (file: string) => EslintMessageAt[]
  /**
   * Every error either engine reports on the file, by line, ESLint's first on a shared line: oxlint
   * as its diagnostic code (`typescript(ban-ts-comment)`), ESLint as its rule ID. Warnings are left out.
   */
  readonly errorsOn: (file: string) => ErrorAt[]
  /** Every rule ESLint ran on the file, from its stats: none when the file failed to parse. */
  readonly eslintRulesRunOn: (file: string) => string[]
  /** `file: message` for every fatal ESLint message, a parse error included. */
  readonly eslintFatalMessages: () => string[]
  /** `file: rule ID` for every rule a directive names that ESLint has no definition of. */
  readonly eslintRulesNotFound: () => string[]
}

type OxlintRun = {
  readonly emittedConfig: OxlintConfig
  readonly lint: ProcessOutput
  readonly print: ProcessOutput
}

type CompletedRun = {
  readonly projectDir: string
  /** Null when the build has no oxlint part. */
  readonly oxlint: OxlintRun | null
  readonly emittedEslintConfig: readonly Linter.Config[]
  readonly eslintResults: readonly ESLint.LintResult[]
}

type EmittedConfigs = { readonly oxlint: OxlintConfig | null; readonly eslint: Linter.Config[] }

const OXLINT_BIN = join(INSTALLED_OXLINT.dir, 'bin', 'oxlint')
const OXLINT_CONFIG_FILE = '.oxlintrc.json'
// The team's own oxlint config in an editor build, which the ESLint merge reads: a name oxlint never finds by itself.
const TEAM_OXLINT_CONFIG_FILE = 'team.oxlintrc.json'
const ENGINE_RUNS_TIMEOUT_MS = 300_000
const ESLINT_ERROR = 2
const OXLINT_ERROR = 'error'
const ENGINE_ORDER = ['eslint', 'oxlint']
// A finding without a line is about the whole file, so it sorts before line 1.
const WHOLE_FILE_LINE = 0

/** File contents by path relative to the project. */
export type WrittenFiles = ProjectFiles

/**
 * Copies the fixtures into a temp project, writes `writtenFiles` beside them, builds the configs
 * `build` names from what `configFor` defines there, writes the oxlint one, and runs the real oxlint
 * CLI and the real ESLint Node API over the whole project. The installed oxlint resolves from the
 * project, as the oxlint merge needs, and so does each package given in `linkedPackages`. Call it
 * at the top of a test file or a describe block: it registers that scope's hooks.
 */
export function setUpEngineRun(
  fixturesDir: string,
  configFor: (projectDir: string) => DefinedLintRules,
  writtenFiles: WrittenFiles = {},
  build: EngineBuild = AGENT_BUILD,
  linkedPackages: readonly LinkedPackage[] = [],
): EngineRun {
  const tempProjects = setUpTempProjects()
  let run: CompletedRun | undefined

  beforeAll(async () => {
    const projectDir = tempProjects.create({ fixturesDir, files: writtenFiles, linkedPackages: [INSTALLED_OXLINT, ...linkedPackages] })
    run = await runBothEngines(projectDir, emittedConfigsOf(projectDir, configFor(projectDir), build))
  }, ENGINE_RUNS_TIMEOUT_MS)

  function completedRun(): CompletedRun {
    if (run === undefined) throw new Error('the engines were queried outside the suite that ran them')
    return run
  }

  function oxlintRun(): OxlintRun {
    const { oxlint } = completedRun()
    if (oxlint === null) throw new Error('oxlint did not run: the build has no oxlint part')
    return oxlint
  }

  function oxlintReport(): OxlintReport {
    // Parse boundary: oxlint's JSON report.
    return JSON.parse(oxlintRun().lint.stdout) as OxlintReport
  }

  function eslintResultFor(file: string): ESLint.LintResult {
    const { projectDir, eslintResults } = completedRun()
    const result = eslintResults.find((candidate) => relative(projectDir, candidate.filePath) === file)
    if (result === undefined) throw new Error(`ESLint did not lint ${file}`)
    return result
  }

  return {
    projectDir: () => completedRun().projectDir,
    emittedOxlintConfig: () => oxlintRun().emittedConfig,
    emittedEslintConfig: () => completedRun().emittedEslintConfig,
    oxlintLint: () => oxlintRun().lint,
    oxlintPrint: () => oxlintRun().print,
    oxlintReport,
    eslintResults: () => completedRun().eslintResults,
    oxlintCodesOn: (file) =>
      oxlintReport()
        .diagnostics.filter((diagnostic) => diagnostic.filename === file)
        .map((diagnostic) => diagnostic.code),
    eslintRuleIdsOn: (file) => eslintResultFor(file).messages.map((message) => message.ruleId),
    eslintMessagesOn: (file) =>
      eslintResultFor(file).messages.map(({ ruleId, severity, line }) => ({ ruleId, severity, line })),
    errorsOn: (file) => {
      const eslintErrors = eslintResultFor(file)
        .messages.filter((message) => message.severity === ESLINT_ERROR)
        .map(({ ruleId, line }): ErrorAt => ({ engine: 'eslint', rule: ruleId, line }))
      const oxlintErrors = oxlintReport()
        .diagnostics.filter((diagnostic) => diagnostic.filename === file && diagnostic.severity === OXLINT_ERROR)
        .map(({ code, labels: [firstLabel] }): ErrorAt => ({
          engine: 'oxlint',
          rule: code,
          line: firstLabel === undefined ? null : firstLabel.span.line,
        }))
      return [...eslintErrors, ...oxlintErrors].toSorted(byLineThenEngine)
    },
    eslintRulesRunOn: (file) => {
      const { stats } = eslintResultFor(file)
      if (stats === undefined) throw new Error('ESLint ran without stats')
      return [...new Set(stats.times.passes.flatMap((pass) => Object.keys(pass.rules ?? {})))].sort()
    },
    eslintRulesNotFound: () => {
      const { projectDir, eslintResults } = completedRun()
      return eslintResults.flatMap((result) =>
        rulesNotFoundAmong(result.messages).map((ruleId) => `${relative(projectDir, result.filePath)}: ${String(ruleId)}`),
      )
    },
    eslintFatalMessages: () => {
      const { projectDir, eslintResults } = completedRun()
      return eslintResults.flatMap((result) =>
        result.messages
          .filter((message) => message.fatal === true)
          .map((message) => `${relative(projectDir, result.filePath)}: ${message.message}`),
      )
    },
  }
}

/**
 * The agent build, or the editor parts merged into the team's configs, each merge given the path of
 * the team's other config (spec-merge-model.md, 1.3): the team's oxlint config, written into the
 * project as JSON; and no ESLint config, as the team's here sets no rule.
 */
function emittedConfigsOf(projectDir: string, defined: DefinedLintRules, build: EngineBuild): EmittedConfigs {
  if (build.kind === 'agent') return agentConfigsOf(defined)
  const { eslint, oxlint } = defined.editorRulesets
  writeOxlintConfigFile(projectDir, TEAM_OXLINT_CONFIG_FILE, build.teamOxlintConfig)
  return {
    eslint: mergeEslintConfig(build.teamEslintConfig, eslint, { oxlintConfig: TEAM_OXLINT_CONFIG_FILE }),
    oxlint: oxlint === undefined ? null : mergeOxlintConfig(build.teamOxlintConfig, oxlint, teamEslintConfigSettingNoRule(build.teamEslintConfig)),
  }
}

/**
 * The oxlint merge reads the team's ESLint config from a file, which a team config holding plugin
 * objects cannot be written to: an editor build's team ESLint config states no rule, so it reads as
 * no config at all.
 */
function teamEslintConfigSettingNoRule(teamEslintConfig: TeamConfigs['teamEslintConfig']): TeamEslintConfigPath {
  const statingRules = defineConfig(teamEslintConfig).filter(({ rules = {} }) => Object.keys(rules).length > 0)
  if (statingRules.length > 0) throw new Error("an editor build's team ESLint config states no rule: the oxlint merge could not read it")
  return NO_TEAM_ESLINT_CONFIG
}

async function runBothEngines(projectDir: string, emitted: EmittedConfigs): Promise<CompletedRun> {
  // Stats record which rules ran on each file.
  const eslint = new ESLint({ cwd: projectDir, overrideConfigFile: true, overrideConfig: emitted.eslint, stats: true })
  return {
    projectDir,
    oxlint: emitted.oxlint === null ? null : await runOxlintWith(projectDir, emitted.oxlint),
    emittedEslintConfig: emitted.eslint,
    eslintResults: await eslint.lintFiles(['.']),
  }
}

async function runOxlintWith(projectDir: string, emittedConfig: OxlintConfig): Promise<OxlintRun> {
  await writeFile(join(projectDir, OXLINT_CONFIG_FILE), JSON.stringify(emittedConfig))
  return {
    emittedConfig,
    lint: runOxlint(projectDir, ['-f', 'json', '.']),
    print: runOxlint(projectDir, ['--print-config']),
  }
}

function sortableLineOf({ line }: ErrorAt): number {
  return line === null ? WHOLE_FILE_LINE : line
}

function byLineThenEngine(first: ErrorAt, second: ErrorAt): number {
  return (
    sortableLineOf(first) - sortableLineOf(second) ||
    ENGINE_ORDER.indexOf(first.engine) - ENGINE_ORDER.indexOf(second.engine) ||
    String(first.rule).localeCompare(String(second.rule))
  )
}

function runOxlint(projectDir: string, args: readonly string[]): ProcessOutput {
  const { status, stdout } = spawnSync(process.execPath, [OXLINT_BIN, '-c', OXLINT_CONFIG_FILE, ...args], {
    cwd: projectDir,
    encoding: 'utf8',
  })
  return { exitCode: status, stdout }
}
