import { appendFileSync, cpSync, symlinkSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { moduleText } from './__tests__/factories/check-factories.ts'
import { type ProcessRun, runIn } from './__tests__/npm-runs.ts'
import { runMadeFor, setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import type { TempProjects } from './__tests__/temp-projects.ts'

// Whether this repo's typecheck reads the lint config files at its root. Each run is on a copy of the repo, so an
// error planted there never reaches the real files. Run `bun run build` first: those files read @agents-inc/lint-rules
// from its dist.

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const ROOT_LINT_CONFIG_FILES = ['agents-inc.lint.mts', 'oxlint.config.mts'] as const
type RootLintConfigFile = (typeof ROOT_LINT_CONFIG_FILES)[number]

const NODE_MODULES = 'node_modules'
// The installed packages are linked rather than copied. Left out: git's history, turbo's cache, the mutation reports
// and Stryker's sandboxes, none of which a typecheck reads.
const LEFT_OUT_OF_THE_COPY: ReadonlySet<string> = new Set([NODE_MODULES, '.git', '.turbo', 'reports', '.stryker-tmp'])

// The repo's own typecheck script, kept to the root package's tasks and run without the tasks they depend on. A file
// at the root belongs to no package, so only a root task can check it; and knip, which typecheck runs first, reports
// exports of a copy's packages as unused, since the linked node_modules lead back to the real ones.
const BUN = 'bun'
const THE_ROOT_TYPECHECK_TASKS_ALONE = ['run', 'typecheck', '--filter=//', '--only']

// A statement tsc refuses, appended after the file's last line.
const A_TYPE_ERROR = moduleText("const plantedTypeError: number = 'not a number'")
// What tsc prints of that statement, as `file(line,column): error TS2322: …`: the file named by its path from the
// folder tsc runs in, behind the task prefix turbo writes.
const THE_PLANTED_ERROR_IN: Readonly<Record<RootLintConfigFile, RegExp>> = {
  'agents-inc.lint.mts': /(?:^|[\s/])agents-inc\.lint\.mts\(\d+,\d+\): error TS2322: Type 'string' is not assignable to type 'number'\./mu,
  'oxlint.config.mts': /(?:^|[\s/])oxlint\.config\.mts\(\d+,\d+\): error TS2322: Type 'string' is not assignable to type 'number'\./mu,
}
// Any error tsc prints, of a file or of the whole program (a type library it cannot find, say).
const ANY_TSC_ERROR = /\berror TS\d+: /u

const UNTOUCHED = 'untouched'
const COPIES_AND_RUNS_TIMEOUT_MS = 300_000

/** A typecheck run on a copy of the repo: `untouched`, or the root lint config file it planted a type error in. */
type TypecheckRun = ProcessRun & { readonly kind: string }

function isKeptInTheCopy(source: string): boolean {
  return !LEFT_OUT_OF_THE_COPY.has(relative(REPO_ROOT, source))
}

/** This repo's working tree in a temp folder of its own, its installed packages linked. */
function copyOfThisRepo(tempProjects: TempProjects): string {
  const copy = tempProjects.create({})
  cpSync(REPO_ROOT, copy, { recursive: true, filter: isKeptInTheCopy })
  symlinkSync(join(REPO_ROOT, NODE_MODULES), join(copy, NODE_MODULES), 'dir')
  return copy
}

function typecheckOfACopyWithATypeErrorIn(tempProjects: TempProjects, file: RootLintConfigFile): TypecheckRun {
  const copy = copyOfThisRepo(tempProjects)
  appendFileSync(join(copy, file), A_TYPE_ERROR)
  return { kind: file, ...runIn(copy, BUN, THE_ROOT_TYPECHECK_TASKS_ALONE) }
}

describe("this repo's typecheck, run on a copy of the repo", () => {
  const typecheckRuns = setUpRunsBeforeTheSuite(
    (tempProjects): TypecheckRun[] => [
      { kind: UNTOUCHED, ...runIn(copyOfThisRepo(tempProjects), BUN, THE_ROOT_TYPECHECK_TASKS_ALONE) },
      ...ROOT_LINT_CONFIG_FILES.map((file) => typecheckOfACopyWithATypeErrorIn(tempProjects, file)),
    ],
    { timeoutMs: COPIES_AND_RUNS_TIMEOUT_MS, whatFailed: 'the copies of this repo could not be made or type-checked' },
  )

  it('reports no type error, and exits 0, where no file is changed', () => {
    const { exitCode, output } = runMadeFor(typecheckRuns(), UNTOUCHED)

    expect(output).not.toMatch(ANY_TSC_ERROR)
    expect(exitCode).toBe(0)
  })

  it.each(ROOT_LINT_CONFIG_FILES)('reports a type error planted in the root %s, and fails', (file) => {
    const { exitCode, output } = runMadeFor(typecheckRuns(), file)

    expect(output).toMatch(THE_PLANTED_ERROR_IN[file])
    expect(exitCode).not.toBe(0)
  })
})
