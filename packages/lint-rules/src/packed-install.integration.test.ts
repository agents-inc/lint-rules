import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { findingsIn, notCheckedIn } from './__tests__/check-output.ts'
import { type CliRun, EXIT, runCommandLine, searchPathWithoutOurBin } from './__tests__/cli-runs.ts'
import { describeFinding, type EslintCliResult, eslintFindingsIn, type OxlintCliReport, oxlintFindingsIn } from './__tests__/engine-clis.ts'
import { NPM as NPM_LINES } from './__tests__/factories/init-factories.ts'
import { jsonFileText } from './__tests__/factories/team-config-file-factories.ts'
import { buildTsconfig } from './__tests__/factories/tsconfig-factories.ts'
import { createGitProject } from './__tests__/git-projects.ts'
import { packagesNpmOverridesAPeerFor } from './__tests__/npm-install-output.ts'
import { npmInstallIn, type ProcessRun, runIn, tarballPackedFrom } from './__tests__/npm-runs.ts'
import { type RunsBeforeTheSuiteOptions, setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import type { ProjectFiles, TempProjects } from './__tests__/temp-projects.ts'

// Packed as npm publishes it and installed by npm beside a consumer's ESLint, oxlint and TypeScript,
// this package loads in both engines through plan.md's three files, verbatim, and its bin checks an
// agent's change. It needs the network and fails, never skips, where it cannot install.

const PACKAGE_DIR = fileURLToPath(new URL('..', import.meta.url))
const CONSUMER_FILES_DIR = fileURLToPath(new URL('../test-fixtures/consumer-files', import.meta.url))
const PLAN_MD_FILES = ['agents-inc.lint.mts', 'oxlint.config.mts', 'eslint.config.mjs']
const OXLINT_CONFIG_FILE = 'oxlint.config.mts'
const PACKED_INSTALL: RunsBeforeTheSuiteOptions = { timeoutMs: 900_000, whatFailed: 'the packed install was not made before the suite' }
const MODULE_NOT_FOUND = 'Cannot find module'
const OUR_PACKAGE = '@agents-inc/lint-rules'
const OUR_BIN = 'agents-inc-lint'
const CHECK = 'check'
// ESLint exits 2 where its config fails to load; oxlint, 1.
const ESLINT_CONFIG_FAILED = 2
const OXLINT_CONFIG_FAILED = 1

type Engines = { readonly eslint: string; readonly oxlint: string; readonly typescript: string }

// The versions a consumer installs beside ours: the ESLint and oxlint ours are, and a TypeScript in our peer range.
const ENGINES_AS_OURS: Engines = { eslint: '10.12.0', oxlint: '1.87.0', typescript: '6.0.3' }
// The newest ESLint 9 without preserve-caught-error, which 9.35.0 added, and an oxlint without no-unreachable-loop
// (measured, 1.70.0): neither reports the agent's change as ours do.
const OLDER_ENGINES: Engines = { eslint: '9.34.0', oxlint: '1.70.0', typescript: ENGINES_AS_OURS.typescript }

// One finding for each engine, each the only finding every ruleset draws on its line (measured):
// oxlint's no-debugger (2), and ESLint's @typescript-eslint/no-inferrable-types (5).
const PLANTED_FILE = 'src/planted.ts'
const PLANTED_SOURCE = `export function check(value: number): number {
  debugger
  return value
}
export const count: number = 1
`
const OWED_BY_OXLINT = [`${PLANTED_FILE}:2 eslint(no-debugger)`]
const OWED_BY_ESLINT = [`${PLANTED_FILE}:5 @typescript-eslint/no-inferrable-types`]

// Written once the project is committed, so check lints it alone. One finding for each engine, neither fixed, each
// the only finding on its line and from a rule the older engines lack (measured): ESLint's preserve-caught-error (5),
// oxlint's no-unreachable-loop (10).
const AGENT_CHANGE_FILE = 'src/agent-change.ts'
const AGENT_CHANGE_SOURCE = `export function parsed(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(\`not JSON: \${String(error)}\`)
  }
}

export function firstOf(values: readonly number[]): number | undefined {
  for (const value of values) {
    return value
  }
  return undefined
}
`
const OWED_BY_CHECK = [`${AGENT_CHANGE_FILE}:5 preserve-caught-error`, `${AGENT_CHANGE_FILE}:10 no-unreachable-loop`]

// A consumer's project keeps node_modules out of git, and oxlint reads that: with no ignore file it
// lints node_modules too (measured, oxlint 1.87).
const GITIGNORE = 'node_modules\n'
// Plugins we depend on whose ESLint peer range stops at 9, which npm installs beside ESLint 10 all the
// same, with a warning.
const PLUGINS_NPM_OVERRIDES_A_PEER_FOR = ['eslint-plugin-react', 'eslint-plugin-react-perf']

type PackedInstallRuns = {
  readonly projectDir: string
  readonly install: ProcessRun
  readonly eslint: ProcessRun
  readonly oxlint: ProcessRun
  readonly check: CliRun
}

function projectFiles(tarball: string, engines: Engines): ProjectFiles {
  return {
    'package.json': jsonFileText({
      name: 'packed-install-project',
      private: true,
      type: 'module',
      devDependencies: { [OUR_PACKAGE]: `file:${tarball}`, ...engines },
    }),
    '.gitignore': GITIGNORE,
    'tsconfig.json': JSON.stringify(buildTsconfig({ include: ['src'] })),
    ...Object.fromEntries(PLAN_MD_FILES.map((file) => [file, readFileSync(join(CONSUMER_FILES_DIR, file), 'utf8')])),
    [PLANTED_FILE]: PLANTED_SOURCE,
  }
}

/** No notice of a newer npm, and no bin of ours on PATH but the project's. */
function npxEnv(): Readonly<Record<string, string>> {
  return { npm_config_update_notifier: 'false', PATH: searchPathWithoutOurBin() }
}

/** The team's ESLint and oxlint run on plan.md's files, then our bin, run as init tells agents to, on the agent's change. */
function packedInstallBeside(tempProjects: TempProjects, engines: Engines): PackedInstallRuns {
  const tarball = tarballPackedFrom(PACKAGE_DIR, tempProjects.create({}))
  const project = createGitProject(tempProjects, { repo: 'committed', files: projectFiles(tarball, engines), linkedPackages: [] })
  const projectDir = project.dir
  const install = npmInstallIn(projectDir)
  const eslint = runIn(projectDir, process.execPath, [join(projectDir, 'node_modules/eslint/bin/eslint.js'), '-f', 'json', '.'])
  const oxlint = runIn(projectDir, process.execPath, [join(projectDir, 'node_modules/oxlint/bin/oxlint'), '-c', OXLINT_CONFIG_FILE, '-f', 'json', '.'])
  project.write(AGENT_CHANGE_FILE, AGENT_CHANGE_SOURCE)
  const check = runCommandLine(projectDir, NPM_LINES.runner, [OUR_BIN, CHECK], { env: npxEnv() })
  return { projectDir, install, eslint, oxlint, check }
}

type CheckOutcome = { readonly exitCode: number | null; readonly findings: readonly string[]; readonly notChecked: readonly string[]; readonly stderr: string }

function checkOutcomeOf({ exitCode, stdout, stderr }: CliRun): CheckOutcome {
  return { exitCode, findings: findingsIn(stdout), notChecked: notCheckedIn(stdout), stderr }
}

describe("this package, packed and installed by npm into a fresh project beside ESLint, oxlint and TypeScript, linted through plan.md's files", () => {
  const runs = setUpRunsBeforeTheSuite((tempProjects) => packedInstallBeside(tempProjects, ENGINES_AS_OURS), PACKED_INSTALL)

  it('is installed by npm, which exits 0', () => {
    const { install } = runs()

    expect({ exitCode: install.exitCode, output: install.exitCode === 0 ? '' : install.output }).toStrictEqual({ exitCode: 0, output: '' })
  })

  it('overrides the ESLint peer range only of the plugins whose range stops at ESLint 9: not of jsx-a11y, whose fork we install', () => {
    expect(packagesNpmOverridesAPeerFor(runs().install.output)).toStrictEqual(PLUGINS_NPM_OVERRIDES_A_PEER_FOR)
  })

  it('prints no "Cannot find module" in the install or in either engine\'s run', () => {
    const { install, eslint, oxlint } = runs()

    expect({ install: install.output.includes(MODULE_NOT_FOUND), eslint: eslint.output.includes(MODULE_NOT_FOUND), oxlint: oxlint.output.includes(MODULE_NOT_FOUND) }).toStrictEqual({
      install: false,
      eslint: false,
      oxlint: false,
    })
  })

  it('loads the ESLint config, which reports exactly the finding planted for ESLint', () => {
    const { projectDir, eslint } = runs()
    // Parse boundary: ESLint's JSON report.
    const results = JSON.parse(eslint.stdout) as readonly EslintCliResult[]

    expect(eslintFindingsIn(results, projectDir).map(describeFinding)).toStrictEqual(OWED_BY_ESLINT)
  })

  it('loads the oxlint config, which reports exactly the finding planted for oxlint', () => {
    // Parse boundary: oxlint's JSON report.
    const report = JSON.parse(runs().oxlint.stdout) as OxlintCliReport

    expect(oxlintFindingsIn(report).map(describeFinding)).toStrictEqual(OWED_BY_OXLINT)
  })

  it("runs check as npx finds the installed bin, which reports the agent's change, one finding for each engine", () => {
    expect(checkOutcomeOf(runs().check)).toStrictEqual({ exitCode: EXIT.findings, findings: OWED_BY_CHECK, notChecked: [], stderr: '' })
  })
})

describe('this package, packed and installed by npm into a fresh project beside an ESLint 9 and an oxlint older than its own', () => {
  const runs = setUpRunsBeforeTheSuite((tempProjects) => packedInstallBeside(tempProjects, OLDER_ENGINES), PACKED_INSTALL)

  it('is installed by npm, which exits 0 and overrides no peer range: ours names no ESLint or oxlint for the project to meet', () => {
    const { install } = runs()

    expect({
      exitCode: install.exitCode,
      output: install.exitCode === 0 ? '' : install.output,
      peersOverridden: packagesNpmOverridesAPeerFor(install.output),
    }).toStrictEqual({ exitCode: 0, output: '', peersOverridden: [] })
  })

  it("runs check with its own ESLint and oxlint, whatever the project installs: each reports the agent's change from a rule the project's lack", () => {
    expect(checkOutcomeOf(runs().check)).toStrictEqual({ exitCode: EXIT.findings, findings: OWED_BY_CHECK, notChecked: [], stderr: '' })
  })

  it("leaves mergeEslintConfig reading the project's ESLint: the team's ESLint 9 loads plan.md's eslint.config.mjs, which refuses it", () => {
    const { projectDir, eslint } = runs()

    expect(eslint.output).toContain(`eslint.config.mjs: the ESLint installed for ${projectDir} is ${OLDER_ENGINES.eslint}; ${OUR_PACKAGE} needs ESLint 10 or later: install eslint 10`)
    expect(eslint.exitCode).toBe(ESLINT_CONFIG_FAILED)
  })

  // Up to the names the refusal lists: which names, and the oxlint it advises installing, are not this test's claim.
  it("leaves mergeOxlintConfig reading the project's oxlint: the team's older oxlint loads plan.md's oxlint.config.mts, which refuses it for the names it lacks", () => {
    const { projectDir, oxlint } = runs()

    expect(oxlint.output).toContain(`${OXLINT_CONFIG_FILE}: the oxlint installed for ${projectDir} is ${OLDER_ENGINES.oxlint}, which has no rule or plugin named `)
    expect(oxlint.exitCode).toBe(OXLINT_CONFIG_FAILED)
  })
})
