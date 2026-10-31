import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { type CliRun, checkInTheBackground, clockMovedForward, EXIT, RUNS_IN_THE_BACKGROUND } from './__tests__/cli-runs.ts'
import { checkedPackageFiles, ERRORS_SUMMARY_TAIL, exportedConstant, moduleText, PACKAGE_JSON_FILE } from './__tests__/factories/check-factories.ts'
import { buildPackageJsonNamingBrowsers, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { createGitProject, testEnv } from './__tests__/git-projects.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { type ProjectFiles, type TempProjects, THIS_PACKAGE } from './__tests__/temp-projects.ts'

// browserslist warns on stderr, the first time a process asks it for browsers, once its browser data (caniuse-lite)
// is six months old. check runs ESLint in its own process, where unicorn/no-unnecessary-polyfills (modern-js) asks it
// for the browsers a project's package.json names, and compat/compat (browser-targets) for the browsers Vite builds for.
// check never prints that warning: the data stays as old as the project's packages. Each run here reads a clock moved
// forward, which ages the data as the months passing would.

allowEveryTestForParallelLoad()

const MODERN_JS = { quality: ['modern-js'] } as const
const BROWSER_TARGETS = { runtimes: ['browser-targets'] } as const
const NAMED_BROWSERS = ['chrome >= 111'] as const
// Past browserslist's six months whatever the data installed today, whose newest browser is from before today.
const MONTHS_FOR_DATA_GONE_OLD = 8
const MONTHS_UNMOVED = 0

// browserslist 4.29's own words; the months are the data's age.
const OLD_DATA_MESSAGE =
  /^Browserslist: browsers data \(caniuse-lite\) is \d+ months old\. Please run:\n {2}npx update-browserslist-db@latest\n {2}Why you should do it regularly: https:\/\/github\.com\/browserslist\/update-db#readme\n$/u

const NO_FINDINGS_IN_ONE_FILE: CliRun = { exitCode: EXIT.clean, signal: null, stdout: 'check: no findings in 1 changed file.\n', stderr: '' }

const IDLE_CALLBACK_FILE = 'src/schedule-idle.ts'
const CALLS_AN_API_SAFARI_16_4_LACKS = 'export const scheduleIdle = (task: () => void) => requestIdleCallback(task)'

// Measured with eslint-plugin-compat 7.0.2, which names the browsers lacking the API.
const ONE_COMPAT_FINDING: CliRun = {
  exitCode: EXIT.findings,
  signal: null,
  stdout: `${IDLE_CALLBACK_FILE}:1 compat/compat — requestIdleCallback is not supported in Safari 16.4, iOS Safari 16.4\ncheck: 1 error and 0 warnings in 1 of 1 changed file. ${ERRORS_SUMMARY_TAIL}\n`,
  stderr: '',
}

/** The stderr of a child Node asking the browserslist the plugin given imports for the browsers named, under the clock moved forward that far. */
function stderrOfBrowserslistAsImportedBy(pluginPackage: string, months: number): string {
  const asksForTheBrowsersNamed = `import { createRequire } from 'node:module'\nconst plugin = createRequire(import.meta.url).resolve('${pluginPackage}')\ncreateRequire(plugin)('browserslist')(process.argv[1])\n`
  const { stderr } = spawnSync(process.execPath, ['--input-type=module', '--eval', asksForTheBrowsersNamed, NAMED_BROWSERS.join(', ')], {
    cwd: THIS_PACKAGE.dir,
    env: testEnv(clockMovedForward(months).env),
    encoding: 'utf8',
  })
  return stderr
}

/** check's run in a committed project of the files given, once the file given changes, under the clock moved forward that far. */
async function checkedWithTheClockAhead(tempProjects: TempProjects, files: ProjectFiles, changed: { readonly path: string; readonly text: string }, months: number): Promise<CliRun> {
  const project = createGitProject(tempProjects, { repo: 'committed', files })
  project.write(changed.path, changed.text)
  const { run } = await checkInTheBackground(project.dir, clockMovedForward(months))
  return run
}

describe('check where browserslist would warn that its browser data is old', () => {
  const runs = setUpRunsBeforeTheSuite(async (tempProjects) => {
    const files = { ...checkedPackageFiles(MODERN_JS), [PACKAGE_JSON_FILE]: packageJsonText(buildPackageJsonNamingBrowsers(NAMED_BROWSERS)) }
    const changed = { path: 'src/a.ts', text: moduleText(exportedConstant('a')) }
    const [dataGoneOld, clockUnmoved] = await Promise.all([
      checkedWithTheClockAhead(tempProjects, files, changed, MONTHS_FOR_DATA_GONE_OLD),
      checkedWithTheClockAhead(tempProjects, files, changed, MONTHS_UNMOVED),
    ])
    return { dataGoneOld, clockUnmoved }
  }, RUNS_IN_THE_BACKGROUND)

  it('has browserslist itself print its old-data message under the moved clock, outside check', () => {
    expect(stderrOfBrowserslistAsImportedBy('eslint-plugin-unicorn', MONTHS_FOR_DATA_GONE_OLD)).toMatch(OLD_DATA_MESSAGE)
  })

  it("prints nothing of browserslist's old-data message in a project whose package.json names browsers", () => {
    expect(runs().dataGoneOld).toStrictEqual(NO_FINDINGS_IN_ONE_FILE)
  })

  it('gives that same run with the clock unmoved', () => {
    expect(runs().clockUnmoved).toStrictEqual(NO_FINDINGS_IN_ONE_FILE)
  })
})

describe('check where compat/compat asks browserslist for the browsers Vite builds for, once its browser data is old', () => {
  const runs = setUpRunsBeforeTheSuite(async (tempProjects) => {
    const files = checkedPackageFiles(BROWSER_TARGETS)
    const changed = { path: IDLE_CALLBACK_FILE, text: moduleText(CALLS_AN_API_SAFARI_16_4_LACKS) }
    const [dataGoneOld, clockUnmoved] = await Promise.all([
      checkedWithTheClockAhead(tempProjects, files, changed, MONTHS_FOR_DATA_GONE_OLD),
      checkedWithTheClockAhead(tempProjects, files, changed, MONTHS_UNMOVED),
    ])
    return { dataGoneOld, clockUnmoved }
  }, RUNS_IN_THE_BACKGROUND)

  it('has the browserslist eslint-plugin-compat imports print its old-data message under the moved clock, outside check', () => {
    expect(stderrOfBrowserslistAsImportedBy('eslint-plugin-compat', MONTHS_FOR_DATA_GONE_OLD)).toMatch(OLD_DATA_MESSAGE)
  })

  it("reports the API Safari 16.4 lacks and prints nothing of browserslist's old-data message", () => {
    expect(runs().dataGoneOld).toStrictEqual(ONE_COMPAT_FINDING)
  })

  it('gives that same run with the clock unmoved', () => {
    expect(runs().clockUnmoved).toStrictEqual(ONE_COMPAT_FINDING)
  })
})
