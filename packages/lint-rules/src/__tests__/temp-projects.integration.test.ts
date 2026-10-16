import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { setUpTempProjects } from './temp-projects.ts'
import { runVitestCli, type TestFileOutcome } from './vitest-cli.ts'

// A temp project a test file makes is gone once the file finishes, however it ends: its tests pass
// or fail, it fails while it is collected, or the run skips a suite of it, by a name filter or a
// bail, as Stryker runs each mutant. Each fixture makes a project and ends one of those ways. The
// vitest CLI runs it under the package's own config, with a temp dir of its own that it must leave
// empty. Each fixture names its project in a test's title or its error, which shows the project was
// made, and made in that temp dir.

const FIXTURES_CONFIG = fileURLToPath(new URL('../../test-fixtures/temp-projects/vitest.config.ts', import.meta.url))
const FIXTURE_RUNS_TIMEOUT_MS = 600_000
const NAME_FILTER_KEEPING_ONE_TEST = ['-t', 'is kept']
const BAIL_AT_THE_FIRST_FAILURE = ['--bail=1']
// The pool Stryker's vitest runner runs in; the package's own runs use vitest's default.
const STRYKER_POOL = ['--pool=threads']

/** Each run, by how its file ends: the fixture it runs, and the options it runs it with. */
const FIXTURE_RUNS = [
  { ending: 'passes', fixture: 'passes.fixture.ts', args: [] },
  { ending: 'fails a test', fixture: 'fails-a-test.fixture.ts', args: [] },
  { ending: 'fails while collected', fixture: 'fails-while-collected.fixture.ts', args: [] },
  { ending: 'filtered out by describe', fixture: 'filtered-out-describe.fixture.ts', args: [...NAME_FILTER_KEEPING_ONE_TEST, ...STRYKER_POOL] },
  { ending: 'filtered out whole', fixture: 'filtered-out-file.fixture.ts', args: [...NAME_FILTER_KEEPING_ONE_TEST, ...STRYKER_POOL] },
  { ending: 'skipped after a bail', fixture: 'skipped-after-bail.fixture.ts', args: [...BAIL_AT_THE_FIRST_FAILURE, ...STRYKER_POOL] },
] as const satisfies readonly { readonly ending: string; readonly fixture: string; readonly args: readonly string[] }[]

type Ending = (typeof FIXTURE_RUNS)[number]['ending']

/** The temp dir a run was given, how its file ended, and what it left in that temp dir. */
type FixtureRun = { readonly tempDir: string; readonly files: readonly TestFileOutcome[]; readonly leftInTempDir: readonly string[] }

describe('a test file run under the package vitest config, once it finishes', () => {
  const tempProjects = setUpTempProjects()
  const runs = new Map<Ending, FixtureRun>()

  beforeAll(() => {
    const reportsDir = tempProjects.create({})
    FIXTURE_RUNS.forEach(({ ending, fixture, args }) => {
      const tempDir = tempProjects.create({})
      const files = runVitestCli({ configFile: FIXTURES_CONFIG, args: [fixture, ...args], tempDir, reportFile: join(reportsDir, `${fixture}.json`) })
      runs.set(ending, { tempDir, files, leftInTempDir: readdirSync(tempDir) })
    })
  }, FIXTURE_RUNS_TIMEOUT_MS)

  function runOf(ending: Ending): FixtureRun {
    const run = runs.get(ending)
    if (run === undefined) throw new Error(`the run whose file ends as "${ending}" was not made before the suite`)
    return run
  }

  /** A title or a message naming a path in the temp dir. */
  function namingAPathIn(tempDir: string): unknown {
    return expect.stringContaining(` ${tempDir}/`)
  }

  it('leaves nothing in its temp dir where its tests pass, having found the projects it made', () => {
    const { tempDir, files, leftInTempDir } = runOf('passes')
    expect({ files, leftInTempDir }).toStrictEqual({
      files: [{ file: 'passes.fixture.ts', status: 'passed', message: '', tests: [{ title: namingAPathIn(tempDir), status: 'passed' }] }],
      leftInTempDir: [],
    })
  })

  it('leaves nothing in its temp dir where a test fails', () => {
    const { tempDir, files, leftInTempDir } = runOf('fails a test')
    expect({ files, leftInTempDir }).toStrictEqual({
      files: [{ file: 'fails-a-test.fixture.ts', status: 'failed', message: '', tests: [{ title: namingAPathIn(tempDir), status: 'failed' }] }],
      leftInTempDir: [],
    })
  })

  it('leaves nothing in its temp dir where it fails while it is collected', () => {
    const { tempDir, files, leftInTempDir } = runOf('fails while collected')
    expect({ files, leftInTempDir }).toStrictEqual({
      files: [{ file: 'fails-while-collected.fixture.ts', status: 'failed', message: namingAPathIn(tempDir), tests: [] }],
      leftInTempDir: [],
    })
  })

  it('leaves nothing in its temp dir where a name filter leaves out a describe that made a project', () => {
    const { tempDir, files, leftInTempDir } = runOf('filtered out by describe')
    expect({ files, leftInTempDir }).toStrictEqual({
      files: [
        {
          file: 'filtered-out-describe.fixture.ts',
          status: 'passed',
          message: '',
          tests: [
            { title: 'is kept', status: 'passed' },
            { title: namingAPathIn(tempDir), status: 'skipped' },
          ],
        },
      ],
      leftInTempDir: [],
    })
  })

  it('leaves nothing in its temp dir where a name filter leaves out every test of it', () => {
    const { tempDir, files, leftInTempDir } = runOf('filtered out whole')
    expect({ files, leftInTempDir }).toStrictEqual({
      files: [{ file: 'filtered-out-file.fixture.ts', status: 'passed', message: '', tests: [{ title: namingAPathIn(tempDir), status: 'skipped' }] }],
      leftInTempDir: [],
    })
  })

  it('leaves nothing in its temp dir where a bail skips a describe that made a project', () => {
    const { tempDir, files, leftInTempDir } = runOf('skipped after a bail')
    expect({ files, leftInTempDir }).toStrictEqual({
      files: [
        {
          file: 'skipped-after-bail.fixture.ts',
          status: 'failed',
          message: '',
          tests: [
            { title: 'fails', status: 'failed' },
            { title: namingAPathIn(tempDir), status: 'pending' },
          ],
        },
      ],
      leftInTempDir: [],
    })
  })
})
