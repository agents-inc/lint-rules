import { posix } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ANOTHER_NEXT_APP_FOLDER, NEXT_APP_FOLDER, REMIX_APP_FOLDER, REMIX_ROUTE, REMIX_ROUTE_SOURCE, SERVER_PAGE, SERVER_PAGE_SOURCE, TIME_ZONE_RULE } from './__tests__/cases/server-component-sources.ts'
import { findingsIn, lastLineOf } from './__tests__/check-output.ts'
import { runCheck } from './__tests__/cli-runs.ts'
import { CONFIG_FILE, checkConfigText, ERRORS_SUMMARY_TAIL, PACKAGE_JSON_FILE } from './__tests__/factories/check-factories.ts'
import { buildPackageJson, buildPackageJsonListingNext, buildPackageJsonListingRemix, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { createGitProject } from './__tests__/git-projects.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'

// check gives each changed file the plugin's Next.js setting by that file's own nearest package.json, inside the
// config's folder and outside it, so a Next.js app's Server Component goes unreported beside a Remix app's route.

allowEveryTestForParallelLoad()

const SSR_LISTED = { quality: [], libs: { ui: ['react-ssr'] } } as const
const NEXT_PAGE = `${NEXT_APP_FOLDER}/${SERVER_PAGE}`
const REMIX_APP_ROUTE = `${REMIX_APP_FOLDER}/${REMIX_ROUTE}`
const ANOTHER_NEXT_PAGE = `${ANOTHER_NEXT_APP_FOLDER}/${SERVER_PAGE}`
// check prints a path from the config's folder.
const REMIX_APP_ROUTE_FROM_THE_NEXT_APP = posix.relative(NEXT_APP_FOLDER, REMIX_APP_ROUTE)

function packageJsonsOfTheApps(): Readonly<Record<string, string>> {
  return {
    [PACKAGE_JSON_FILE]: packageJsonText(buildPackageJson()),
    [`${NEXT_APP_FOLDER}/${PACKAGE_JSON_FILE}`]: packageJsonText(buildPackageJsonListingNext()),
    [`${REMIX_APP_FOLDER}/${PACKAGE_JSON_FILE}`]: packageJsonText(buildPackageJsonListingRemix()),
    [`${ANOTHER_NEXT_APP_FOLDER}/${PACKAGE_JSON_FILE}`]: packageJsonText(buildPackageJsonListingNext()),
  }
}

describe('check in a monorepo whose root package.json lists no next, after an agent wrote a Server Component in each Next.js app and a route in a Remix app', () => {
  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    const changed = { [NEXT_PAGE]: SERVER_PAGE_SOURCE, [ANOTHER_NEXT_PAGE]: SERVER_PAGE_SOURCE, [REMIX_APP_ROUTE]: REMIX_ROUTE_SOURCE }
    const atTheRoot = createGitProject(tempProjects, { repo: 'committed', files: { ...packageJsonsOfTheApps(), [CONFIG_FILE]: checkConfigText(SSR_LISTED) } })
    const inTheNextApp = createGitProject(tempProjects, { repo: 'committed', files: { ...packageJsonsOfTheApps(), [`${NEXT_APP_FOLDER}/${CONFIG_FILE}`]: checkConfigText(SSR_LISTED) } })
    for (const [file, source] of Object.entries(changed)) {
      atTheRoot.write(file, source)
      inTheNextApp.write(file, source)
    }
    return { atTheRoot: runCheck(atTheRoot.dir), inTheNextApp: runCheck(inTheNextApp.pathOf(NEXT_APP_FOLDER)) }
  })

  it("reports the Remix app's route alone, with the config at the git top level", () => {
    const { stdout } = runs().atTheRoot

    expect({ findings: findingsIn(stdout), summary: lastLineOf(stdout) }).toStrictEqual({
      findings: [`${REMIX_APP_ROUTE}:2 ${TIME_ZONE_RULE}`],
      summary: `check: 1 error and 0 warnings in 1 of 3 changed files. ${ERRORS_SUMMARY_TAIL}`,
    })
  })

  it("reports the Remix app's route alone, with the config in a Next.js app and the other two apps outside its folder", () => {
    const { stdout } = runs().inTheNextApp

    expect({ findings: findingsIn(stdout), summary: lastLineOf(stdout) }).toStrictEqual({
      findings: [`${REMIX_APP_ROUTE_FROM_THE_NEXT_APP}:2 ${TIME_ZONE_RULE}`],
      summary: `check: 1 error and 0 warnings in 1 of 3 changed files. ${ERRORS_SUMMARY_TAIL}`,
    })
  })
})
