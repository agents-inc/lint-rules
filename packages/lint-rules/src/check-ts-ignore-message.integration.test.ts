import { describe, expect, it } from 'vitest'
import { describedTsExpectError, tsIgnore } from './__tests__/cases/suppression-comments.ts'
import { findingMessagesIn, findingsIn, notCheckedIn } from './__tests__/check-output.ts'
import { EXIT, runCheck } from './__tests__/cli-runs.ts'
import { checkedPackageFiles, packageTsconfigText, TAKING_IN_SRC } from './__tests__/factories/check-factories.ts'
import { createGitProject } from './__tests__/git-projects.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'

// typescript-eslint's ban-ts-comment answers a @ts-ignore with "Use @ts-expect-error instead", which the
// same rule bans outside test files while suppressions are banned. There ours says to fix the type error
// the comment hides; in test files a described @ts-expect-error stays allowed, and so does the advice.

const NO_RULESET = { quality: [] } as const
const TS_COMMENT_BAN = '@typescript-eslint/ban-ts-comment'
const THE_OTHER_COMMENT = '@ts-expect-error'
const FIX_THE_TYPE_ERROR = /\bfix\b.*\btype error\b/iu
const TS_IGNORE_FILE = 'src/ts-ignore.ts'

const SOURCES = {
  [TS_IGNORE_FILE]: tsIgnore,
  'src/ts-expect-error.ts': describedTsExpectError,
  'src/ts-ignore.test.ts': tsIgnore,
  'src/ts-expect-error.test.ts': describedTsExpectError,
}

describe('check on a @ts-ignore over a type error, suppressions banned as shipped', () => {
  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: { ...checkedPackageFiles(NO_RULESET), 'tsconfig.json': packageTsconfigText(TAKING_IN_SRC) } })
    for (const [file, source] of Object.entries(SOURCES)) project.write(file, source)
    return runCheck(project.dir)
  })

  it('reports the @ts-ignore and the described @ts-expect-error outside test files, and the @ts-ignore alone in a test file', () => {
    const { exitCode, signal, stdout } = runs()

    expect({ exitCode, signal, notChecked: notCheckedIn(stdout), findings: findingsIn(stdout) }).toStrictEqual({
      exitCode: EXIT.findings,
      signal: null,
      notChecked: [],
      findings: [`src/ts-expect-error.ts:1 ${TS_COMMENT_BAN}`, `src/ts-ignore.test.ts:1 ${TS_COMMENT_BAN}`, `${TS_IGNORE_FILE}:1 ${TS_COMMENT_BAN}`],
    })
  })

  it('tells the agent to fix the type error, and not to use the @ts-expect-error it bans there too', () => {
    const message = findingMessagesIn(runs().stdout).get(`${TS_IGNORE_FILE}:1 ${TS_COMMENT_BAN}`) ?? ''

    expect({ saysToFixTheTypeError: FIX_THE_TYPE_ERROR.test(message), namesTheOtherComment: message.includes(THE_OTHER_COMMENT) }).toStrictEqual({
      saysToFixTheTypeError: true,
      namesTheOtherComment: false,
    })
  })

  it("answers the @ts-ignore in a test file with typescript-eslint's advice to use the @ts-expect-error allowed there", () => {
    const message = findingMessagesIn(runs().stdout).get(`src/ts-ignore.test.ts:1 ${TS_COMMENT_BAN}`) ?? ''

    expect({ saysToFixTheTypeError: FIX_THE_TYPE_ERROR.test(message), namesTheOtherComment: message.includes(THE_OTHER_COMMENT) }).toStrictEqual({
      saysToFixTheTypeError: false,
      namesTheOtherComment: true,
    })
  })
})
