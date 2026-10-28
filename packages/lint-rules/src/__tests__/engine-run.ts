import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { oxlintCliOutputIn } from '@workspace/rule-data/test-support/oxlint-cli'
import { ESLint, type Linter } from 'eslint'
import { defineConfig } from 'eslint/config'
import type { OxlintConfig } from 'oxlint'
import { mergeEslintConfig } from '../eslint.ts'
import { mergeOxlintConfig } from '../oxlint.ts'
import { agentConfigsOf, type DefinedLintRules } from './agent-configs.ts'
import { fatalMessagesIn, lineOfDiagnostic, type OxlintCliDiagnostic, writeOxlintConfigFile } from './engine-clis.ts'
import { projectPathOf } from './project-paths.ts'
import { rulesNotFoundAmong } from './rules-not-found.ts'
import { setUpRunsBeforeTheSuite } from './runs-before-the-suite.ts'
import { NO_TEAM_ESLINT_CONFIG, type TeamEslintConfigPath } from './team-configs-of-the-other-engine.ts'
import { INSTALLED_OXLINT, type LinkedPackage, type ProjectFiles } from './temp-projects.ts'

type ProcessOutput = { readonly exitCode: number | null; readonly stdout: string }

/** One ESLint message: `ruleId` null for ESLint's own, a parse error or an inline-config warning. */
export type EslintMessageAt = { readonly ruleId: string | null; readonly severity: number; readonly line: number }

/** At error severity, under the engine's own name for the rule. */
export type ErrorAt = { readonly engine: 'eslint' | 'oxlint'; readonly rule: string | null; readonly line: number | null }

type OxlintReport = { readonly diagnostics: readonly OxlintCliDiagnostic[]; readonly number_of_rules: number }

export type TeamConfigs = {
  readonly teamEslintConfig: Parameters<typeof mergeEslintConfig>[0]
  readonly teamOxlintConfig: Parameters<typeof mergeOxlintConfig>[0]
}

/** An editor build of a project whose package.json lists no oxlint has no oxlint part, so oxlint does not run. */
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
  readonly eslintRuleIdsOn: (file: string) => Array<string | null>
  readonly eslintMessagesOn: (file: string) => EslintMessageAt[]
  /** Errors by line, ESLint's first on a shared line, under oxlint's code or ESLint's rule ID; warnings left out. */
  readonly errorsOn: (file: string) => ErrorAt[]
  /** From ESLint's stats: none when the file failed to parse. */
  readonly eslintRulesRunOn: (file: string) => string[]
  /** `file: message`, parse errors included. */
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

const OXLINT_CONFIG_FILE = '.oxlintrc.json'
// The team's oxlint config in an editor build: a name oxlint never finds by itself.
const TEAM_OXLINT_CONFIG_FILE = 'team.oxlintrc.json'
const ESLINT_ERROR = 2
const OXLINT_ERROR = 'error'
const ENGINE_ORDER = ['eslint', 'oxlint']
// A finding without a line is about the whole file, so it sorts before line 1.
const WHOLE_FILE_LINE = 0

export type WrittenFiles = ProjectFiles

/**
* Copies the fixtures into a temp project, builds the configs `build` names, and runs the real oxlint CLI and
* ESLint Node API over it. A build whose making can throw is given as a function, so it is made in the hook.
* Registers hooks: call it at the top of a test file or describe block.
*/
export function setUpEngineRun(
  fixturesDir: string,
  configFor: (projectDir: string) => DefinedLintRules,
  writtenFiles: WrittenFiles = {},
  build: EngineBuild | (() => EngineBuild) = AGENT_BUILD,
  linkedPackages: readonly LinkedPackage[] = [],
): EngineRun {
  const completedRun = setUpRunsBeforeTheSuite(async (tempProjects) => {
    const projectDir = tempProjects.create({ fixturesDir, files: writtenFiles, linkedPackages: [INSTALLED_OXLINT, ...linkedPackages] })
    return runBothEngines(projectDir, emittedConfigsOf(projectDir, configFor(projectDir), typeof build === 'function' ? build() : build))
  })

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
    const result = eslintResults.find((candidate) => projectPathOf(candidate.filePath, projectDir) === file)
    if (result === undefined) throw new Error(`ESLint did not lint ${file}`)
    return result
  }

  return {
    projectDir() {
      return completedRun().projectDir
    },
    emittedOxlintConfig() {
      return oxlintRun().emittedConfig
    },
    emittedEslintConfig() {
      return completedRun().emittedEslintConfig
    },
    oxlintLint() {
      return oxlintRun().lint
    },
    oxlintPrint() {
      return oxlintRun().print
    },
    oxlintReport,
    eslintResults() {
      return completedRun().eslintResults
    },
    oxlintCodesOn(file) {
      return oxlintReport()
        .diagnostics.filter((diagnostic) => diagnostic.filename === file)
        .map((diagnostic) => diagnostic.code)
    },
    eslintRuleIdsOn(file) {
      return eslintResultFor(file).messages.map((message) => message.ruleId)
    },
    eslintMessagesOn(file) {
      return eslintResultFor(file).messages.map(({ ruleId, severity, line }) => ({ ruleId, severity, line }))
    },
    errorsOn(file) {
      const eslintErrors = eslintResultFor(file)
        .messages.filter((message) => message.severity === ESLINT_ERROR)
        .map(({ ruleId, line }): ErrorAt => ({ engine: 'eslint', rule: ruleId, line }))
      const oxlintErrors = oxlintReport()
        .diagnostics.filter((diagnostic) => diagnostic.filename === file && diagnostic.severity === OXLINT_ERROR)
        .map((diagnostic): ErrorAt => ({ engine: 'oxlint', rule: diagnostic.code, line: lineOfDiagnostic(diagnostic) }))
      return [...eslintErrors, ...oxlintErrors].toSorted(byLineThenEngine)
    },
    eslintRulesRunOn(file) {
      const { stats } = eslintResultFor(file)
      if (stats === undefined) throw new Error('ESLint ran without stats')
      return [...new Set(stats.times.passes.flatMap((pass) => Object.keys(pass.rules ?? {})))].sort()
    },
    eslintRulesNotFound() {
      const { projectDir, eslintResults } = completedRun()
      return eslintResults.flatMap((result) =>
        rulesNotFoundAmong(result.messages).map((ruleId) => `${projectPathOf(result.filePath, projectDir)}: ${String(ruleId)}`),
      )
    },
    eslintFatalMessages() {
      const { projectDir, eslintResults } = completedRun()
      return fatalMessagesIn(eslintResults, projectDir)
    },
  }
}

/** Each merge is given the team's other config: its oxlint config as JSON, and no ESLint config, as it sets no rule. */
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
* The oxlint merge reads the team's ESLint config from a file, which plugin objects cannot be written to; it
* states no rule here, so it reads as no config.
*/
// eslint-disable-next-line functional/prefer-immutable-types -- TS2345 as Readonly: defineConfig takes a mutable InfiniteArray<ConfigWithExtends>
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

async function runOxlintWith(projectDir: string, emittedConfig: Readonly<OxlintConfig>): Promise<OxlintRun> {
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
  const { exitCode, stdout } = oxlintCliOutputIn(projectDir, ['-c', OXLINT_CONFIG_FILE, ...args])
  return { exitCode, stdout }
}
