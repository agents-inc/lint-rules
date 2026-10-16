import { chmodSync, mkdirSync, renameSync, symlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findingsIn } from './__tests__/check-output.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/consumer-cli-runs.ts'
import { checkedPackageFiles, DEBUGGER_STATEMENT, exportedConstant, moduleText } from './__tests__/factories/check-factories.ts'
import { createGitProject, entriesUnder, EXIT, runCheck, setUpEmptyFolders } from './__tests__/git-projects.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'

// spec-cli.md "K: check", steps 6 to 8: check reads the changed files and lines from git, through a
// scratch index in the OS temp folder, and lints those that are files on disk its ignores leave in.
// Each suite runs the built bin (dist/cli.mjs) in a temp project.

allowEveryTestForParallelLoad()

const REDUNDANCY = { quality: ['redundancy'] } as const
const NOTHING_TO_CHECK = 'check: no changed JS or TS files.\n'
// Read and list only: what a folder holding the OS temp folder, such as `/`, lets its user do.
const READ_ONLY = 0o555
const WRITABLE = 0o755

describe('check on a changed file whose name, as a git pathspec, is a pattern (step 7)', () => {
  // A Next.js dynamic route: as a pattern, `[id]` is one letter of the two, so it matches `i.ts` too.
  const ROUTE = 'src/[id].ts'
  const MATCHED_BY_THE_PATTERN = 'src/i.ts'

  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, {
      repo: 'committed',
      files: {
        ...checkedPackageFiles(REDUNDANCY),
        [ROUTE]: moduleText(exportedConstant('route'), DEBUGGER_STATEMENT),
        [MATCHED_BY_THE_PATTERN]: moduleText(exportedConstant('matched')),
      },
    })
    project.append(ROUTE, moduleText(exportedConstant('added')))
    project.append(MATCHED_BY_THE_PATTERN, moduleText(DEBUGGER_STATEMENT))
    return runCheck(project.dir)
  })

  it("reads that file's changed lines alone: its finding on an unchanged line stays unreported, beside the other file's on a changed one", () => {
    expect({ exitCode: run().exitCode, findings: findingsIn(run().stdout) }).toStrictEqual({ exitCode: EXIT.findings, findings: ['src/i.ts:2 no-debugger'] })
  })
})

describe('check where the OS temp folder is in a folder it may not write, as /tmp is in / (step 6)', () => {
  const emptyFolder = setUpEmptyFolders()

  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(REDUNDANCY) })
    project.write('src/a.ts', moduleText(exportedConstant('a'), DEBUGGER_STATEMENT))
    const tempFolder = join(emptyFolder(), 'tmp')
    mkdirSync(tempFolder)
    chmodSync(dirname(tempFolder), READ_ONLY)
    const result = runCheck(project.dir, { env: { TMPDIR: tempFolder } })
    chmodSync(dirname(tempFolder), WRITABLE)
    return { result, leftInTheTempFolder: entriesUnder(tempFolder) }
  })

  it('writes its scratch index inside the temp folder, so it runs, and leaves nothing there', () => {
    const { result, leftInTheTempFolder } = run()

    expect({ exitCode: result.exitCode, findings: findingsIn(result.stdout), leftInTheTempFolder }).toStrictEqual({
      exitCode: EXIT.findings,
      findings: ['src/a.ts:2 no-debugger'],
      leftInTheTempFolder: [],
    })
  })
})

describe('check in a repo whose objects git finds only through GIT_ALTERNATE_OBJECT_DIRECTORIES (step 6)', () => {
  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, {
      repo: 'committed',
      files: { ...checkedPackageFiles(REDUNDANCY), 'src/a.ts': moduleText(exportedConstant('a'), DEBUGGER_STATEMENT) },
    })
    project.append('src/a.ts', moduleText(DEBUGGER_STATEMENT))
    const objects = project.pathOf('.git/objects')
    const elsewhere = join(project.dir, '..', 'objects-elsewhere')
    renameSync(objects, elsewhere)
    mkdirSync(objects)
    return runCheck(project.dir, { env: { GIT_ALTERNATE_OBJECT_DIRECTORIES: elsewhere } })
  })

  it('reads the objects there too, beside the scratch index', () => {
    expect({ exitCode: run().exitCode, findings: findingsIn(run().stdout) }).toStrictEqual({ exitCode: EXIT.findings, findings: ['src/a.ts:3 no-debugger'] })
  })
})

describe('check where no changed file is one to lint (steps 6 and 8)', () => {
  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(REDUNDANCY, { ignores: ['src/generated/**'] }) })
    project.write('src/generated/gen.ts', moduleText(DEBUGGER_STATEMENT))
    symlinkSync('missing.ts', project.pathOf('src/link-to-no-file.ts'))
    return runCheck(project.dir)
  })

  it('says there is nothing to check, for a link to no file and a file the ignores leave out', () => {
    expect(run()).toStrictEqual({ exitCode: EXIT.clean, signal: null, stdout: NOTHING_TO_CHECK, stderr: '' })
  })
})
