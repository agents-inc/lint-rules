import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { describeFinding, type EslintCliResult, eslintFindingsIn, type OxlintCliReport, oxlintFindingsIn } from './__tests__/engine-clis.ts'
import { buildTsconfig } from './__tests__/factories/tsconfig-factories.ts'
import { packagesNpmOverridesAPeerFor } from './__tests__/npm-install-output.ts'
import { isRecord } from './core/is-record.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'

// q58 (spec-core.md C11): this package, packed as npm publishes it and installed by npm into a
// fresh project beside the ESLint, oxlint and TypeScript a consumer installs, loads in both
// engines through plan.md's three files, verbatim, and reports what each engine owes on a source
// file planted with one finding for each. It needs the network and the built package: it fails,
// never skips, where it cannot install, and the install is run before the suite, so only an
// assertion fails inside a test.

const PACKAGE_DIR = fileURLToPath(new URL('..', import.meta.url))
const CONSUMER_FILES_DIR = fileURLToPath(new URL('../test-fixtures/consumer-files', import.meta.url))
const PLAN_MD_FILES = ['agents-inc.lint.mts', 'oxlint.config.mts', 'eslint.config.mjs']
const OXLINT_CONFIG_FILE = 'oxlint.config.mts'
const PACKED_INSTALL_TIMEOUT_MS = 900_000
const NPM = 'npm'
const MODULE_NOT_FOUND = 'Cannot find module'
// Room for each engine's JSON report: spawnSync cuts its output at 1 MiB by default.
const REPORT_BUFFER_BYTES = 256 * 1024 * 1024
// The versions a consumer installs beside ours, each in our peer range.
const PEERS = { eslint: '10.12.0', oxlint: '1.87.0', typescript: '6.0.3' }

// One finding for each engine, from rules this round's data leaves alone, each the only finding
// every ruleset draws on its line (measured through the editor merges): oxlint's no-debugger (2),
// and ESLint's @typescript-eslint/no-inferrable-types (5).
const PLANTED_FILE = 'src/planted.ts'
const PLANTED_SOURCE = `export function check(value: number): number {
  debugger
  return value
}
export const count: number = 1
`
const OWED_BY_OXLINT = [`${PLANTED_FILE}:2 eslint(no-debugger)`]
const OWED_BY_ESLINT = [`${PLANTED_FILE}:5 @typescript-eslint/no-inferrable-types`]
// A consumer's project keeps node_modules out of git, and oxlint reads that: with no ignore file it
// lints node_modules too (measured, oxlint 1.87).
const GITIGNORE = 'node_modules\n'
// The plugins we depend on whose ESLint peer range stops at 9, which npm installs beside ESLint 10
// all the same, with a warning (plan.md, the packaging problems of questions.md #38).
// eslint-plugin-jsx-a11y was one until its fork, which takes ESLint 10, replaced it (#54).
const PLUGINS_NPM_OVERRIDES_A_PEER_FOR = ['eslint-plugin-react', 'eslint-plugin-react-perf']

/** What a process printed, both streams, and how it exited. */
type ProcessRun = { readonly exitCode: number | null; readonly stdout: string; readonly output: string }

type PackedInstallRuns = { readonly projectDir: string; readonly install: ProcessRun; readonly eslint: ProcessRun; readonly oxlint: ProcessRun }

function run(command: string, args: readonly string[], cwd: string): ProcessRun {
  const { status, stdout, stderr } = spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: REPORT_BUFFER_BYTES })
  return { exitCode: status, stdout, output: `${stdout}${stderr}` }
}

/** The tarball `npm pack --json` wrote: its file name, from the one entry npm prints. */
function tarballPacked({ exitCode, stdout, output }: ProcessRun): string {
  if (exitCode !== 0) throw new Error(`npm pack failed: ${output}`)
  // Parse boundary: npm's JSON report of what it packed.
  const packed: unknown = JSON.parse(stdout)
  const [entry] = Array.isArray(packed) ? packed : []
  if (!isRecord(entry) || typeof entry['filename'] !== 'string') throw new Error(`npm pack printed no tarball: ${stdout}`)
  return entry['filename']
}

function projectPackageJson(tarball: string): string {
  return `${JSON.stringify({ name: 'packed-install-project', private: true, type: 'module', devDependencies: { '@agents-inc/lint-rules': `file:${tarball}`, ...PEERS } }, null, 2)}\n`
}

describe("this package, packed and installed by npm into a fresh project beside ESLint, oxlint and TypeScript, linted through plan.md's files", () => {
  const tempProjects = setUpTempProjects()
  let runs: PackedInstallRuns | undefined

  beforeAll(() => {
    const packDir = tempProjects.create({})
    const tarball = join(packDir, tarballPacked(run(NPM, ['pack', '--json', '--pack-destination', packDir], PACKAGE_DIR)))
    const projectDir = tempProjects.create({
      files: {
        'package.json': projectPackageJson(tarball),
        '.gitignore': GITIGNORE,
        'tsconfig.json': JSON.stringify(buildTsconfig({ include: ['src'] })),
        ...Object.fromEntries(PLAN_MD_FILES.map((file) => [file, readFileSync(join(CONSUMER_FILES_DIR, file), 'utf8')])),
        [PLANTED_FILE]: PLANTED_SOURCE,
      },
    })
    const install = run(NPM, ['install', '--ignore-scripts', '--no-audit', '--no-fund'], projectDir)
    runs = {
      projectDir,
      install,
      eslint: run(process.execPath, [join(projectDir, 'node_modules/eslint/bin/eslint.js'), '-f', 'json', '.'], projectDir),
      oxlint: run(process.execPath, [join(projectDir, 'node_modules/oxlint/bin/oxlint'), '-c', OXLINT_CONFIG_FILE, '-f', 'json', '.'], projectDir),
    }
  }, PACKED_INSTALL_TIMEOUT_MS)

  function theRuns(): PackedInstallRuns {
    if (runs === undefined) throw new Error('the packed install was not made before the suite')
    return runs
  }

  it('is installed by npm, which exits 0', () => {
    const { install } = theRuns()

    expect({ exitCode: install.exitCode, output: install.exitCode === 0 ? '' : install.output }).toStrictEqual({ exitCode: 0, output: '' })
  })

  it('overrides the ESLint peer range only of the plugins whose range stops at ESLint 9: not of jsx-a11y, whose fork we install', () => {
    expect(packagesNpmOverridesAPeerFor(theRuns().install.output)).toStrictEqual(PLUGINS_NPM_OVERRIDES_A_PEER_FOR)
  })

  it('prints no "Cannot find module" in the install or in either engine\'s run', () => {
    const { install, eslint, oxlint } = theRuns()

    expect({ install: install.output.includes(MODULE_NOT_FOUND), eslint: eslint.output.includes(MODULE_NOT_FOUND), oxlint: oxlint.output.includes(MODULE_NOT_FOUND) }).toStrictEqual({
      install: false,
      eslint: false,
      oxlint: false,
    })
  })

  it('loads the ESLint config, which reports exactly the finding planted for ESLint', () => {
    const { projectDir, eslint } = theRuns()
    // Parse boundary: ESLint's JSON report.
    const results = JSON.parse(eslint.stdout) as readonly EslintCliResult[]

    expect(eslintFindingsIn(results, projectDir).map(describeFinding)).toStrictEqual(OWED_BY_ESLINT)
  })

  it('loads the oxlint config, which reports exactly the finding planted for oxlint', () => {
    // Parse boundary: oxlint's JSON report.
    const report = JSON.parse(theRuns().oxlint.stdout) as OxlintCliReport

    expect(oxlintFindingsIn(report).map(describeFinding)).toStrictEqual(OWED_BY_OXLINT)
  })
})
