import { describe, expect, it } from 'vitest'
import {
  LATE_EVENT,
  LATE_EVENT_FILE,
  PAUSE,
  PAUSE_FILE,
  POST_MESSAGE,
  POST_MESSAGE_FILE,
  SHAPES,
  SHAPES_DECLARATION_FILE,
  SHAPES_DECLARED,
  SHAPES_DECLARED_AS_A_NAMESPACE,
  SHAPES_FILE,
  SLOTS,
  SLOTS_FILE,
  TOKENS,
  TOKENS_FILE,
} from './__tests__/cases/ruleset-move-sources.ts'
import { findingsInFile } from './__tests__/check-output.ts'
import { runCheck } from './__tests__/cli-runs.ts'
import { checkedPackageFiles } from './__tests__/factories/check-factories.ts'
import { createGitProject } from './__tests__/git-projects.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { textsOf } from './__tests__/temp-projects.ts'

allowEveryTestForParallelLoad()

const CORRECTNESS_ALONE = { quality: ['correctness'] } as const
const THE_GROUPS_THEY_LEFT = { quality: ['redundancy', 'complexity', 'modern-js'], runtimes: ['browser'] } as const

const BUG_CHECKS_WRITTEN: Readonly<Record<string, string>> = {
  [PAUSE_FILE]: PAUSE,
  [TOKENS_FILE]: TOKENS,
  [LATE_EVENT_FILE]: LATE_EVENT,
  [SLOTS_FILE]: SLOTS,
}

const LEFT_GROUPS_WRITTEN: Readonly<Record<string, string>> = {
  [PAUSE_FILE]: PAUSE,
  [TOKENS_FILE]: TOKENS,
  [LATE_EVENT_FILE]: LATE_EVENT,
  [POST_MESSAGE_FILE]: POST_MESSAGE,
  [SHAPES_FILE]: SHAPES,
  [SHAPES_DECLARATION_FILE]: SHAPES_DECLARED,
}

type CheckRun = { readonly stdout: string; readonly after: Readonly<Record<string, string>> }

function checkAfterTheAgentWrote(rulesets: Parameters<typeof checkedPackageFiles>[0], written: Readonly<Record<string, string>>): () => CheckRun {
  return setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(rulesets) })
    for (const [file, text] of Object.entries(written)) project.write(file, text)
    const result = runCheck(project.dir)
    return { stdout: result.stdout, after: textsOf(project.dir, Object.keys(written)) }
  })
}

describe('check where a team lists correctness alone, on bug checks an agent wrote', () => {
  const run = checkAfterTheAgentWrote(CORRECTNESS_ALONE, BUG_CHECKS_WRITTEN)

  it('reports a leftover debugger statement', () => {
    expect(findingsInFile(run().stdout, PAUSE_FILE)).toStrictEqual([`${PAUSE_FILE}:2 no-debugger`])
  })

  it('reports a break that leaves a switch inside a loop rather than the loop', () => {
    expect(findingsInFile(run().stdout, TOKENS_FILE)).toStrictEqual([`${TOKENS_FILE}:6 unicorn/no-break-in-nested-loop`])
  })

  it('reports preventDefault called after an await in an event listener', () => {
    expect(findingsInFile(run().stdout, LATE_EVENT_FILE)).toStrictEqual([`${LATE_EVENT_FILE}:4 unicorn/no-late-event-control`])
  })

  it('reports new Array with one argument', () => {
    expect(findingsInFile(run().stdout, SLOTS_FILE)).toStrictEqual([`${SLOTS_FILE}:2 unicorn/no-new-array`])
  })
})

describe('check where a team lists the groups those bug checks left but not correctness', () => {
  const run = checkAfterTheAgentWrote(THE_GROUPS_THEY_LEFT, LEFT_GROUPS_WRITTEN)

  it('reports none of the three bug checks', () => {
    const { stdout } = run()

    expect([PAUSE_FILE, TOKENS_FILE, LATE_EVENT_FILE].flatMap((file) => findingsInFile(stdout, file))).toStrictEqual([])
  })

  it("reports nothing on a worker's postMessage", () => {
    expect(findingsInFile(run().stdout, POST_MESSAGE_FILE)).toStrictEqual([])
  })

  it('leaves `module Shapes` in a .ts file as written, and rewrites it to `namespace Shapes` in a declaration file', () => {
    const { after } = run()

    expect({ [SHAPES_FILE]: after[SHAPES_FILE], [SHAPES_DECLARATION_FILE]: after[SHAPES_DECLARATION_FILE] }).toStrictEqual({
      [SHAPES_FILE]: SHAPES,
      [SHAPES_DECLARATION_FILE]: SHAPES_DECLARED_AS_A_NAMESPACE,
    })
  })
})
