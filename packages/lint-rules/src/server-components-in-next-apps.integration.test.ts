import { join } from 'node:path'
import { foundOr } from '@workspace/rule-data/collections'
import type { Linter } from 'eslint'
import { beforeAll, describe, expect, it } from 'vitest'
import { agentConfigsOf } from './__tests__/agent-configs.ts'
import {
  CLIENT_COMPONENT,
  COMPONENT_A_CLIENT_COMPONENT_IMPORTS,
  COMPONENT_IN_ANOTHER_APP_FOLDER,
  NEXT_APP_FOLDER,
  PAGES_ROUTER_PAGE,
  REMIX_APP_FOLDER,
  REMIX_ROUTE,
  REMIX_ROUTE_SOURCE,
  SERVER_PAGE,
  SERVER_PAGE_BRANCHING_ON_WINDOW,
  SERVER_PAGE_SOURCE,
  SERVER_PAGE_UNDER_SRC,
  SOURCES_OF_A_NEXT_APP,
  SOURCES_OF_A_REMIX_APP,
  TEAM_SETTING_SERVER_COMPONENTS_OFF,
  TIME_ZONE_RULE,
} from './__tests__/cases/server-component-sources.ts'
import { type RuleIdsReportedByFile, setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import { buildConsumerLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJson, buildPackageJsonListingNext, buildPackageJsonListingRemix, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { NO_TEAM_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import type { ProjectFiles } from './__tests__/temp-projects.ts'
import { mergeEslintConfig } from './eslint.ts'
import { defineLintRules } from './index.ts'

const SSR_LISTED = { quality: [], libs: { ui: ['react-ssr'] } } as const
const PACKAGE_JSON = 'package.json'

type BuildName = 'agent build' | 'ESLint merge'

type Build = { readonly build: BuildName; readonly configOf: (configFolder: string) => Linter.Config[] }

// No project lists oxlint, so the editor merge has no third config to read.
const BUILDS: readonly Build[] = [
  { build: 'agent build', configOf(configFolder) { return agentConfigsOf(definedIn(configFolder)).eslint } },
  { build: 'ESLint merge', configOf(configFolder) { return mergedBeside([], configFolder) } },
]

type ProjectName =
  | 'a Next.js app'
  | 'a Next.js app listing next as a dev dependency'
  | 'a Remix app'
  | 'a monorepo whose root package.json lists no next, one app listing next and one Remix app'
  | 'a Next.js app holding a Remix app with a package.json of its own'
  | 'a Next.js app whose lint config sits in a folder holding no package.json'
  | 'a monorepo whose root package.json lists no next and whose Next.js app is a folder named app'

/** `linted`: every file ESLint lints, from the config's folder, which is ESLint's cwd. */
type ProjectCase = { readonly project: ProjectName; readonly configFolder: string; readonly linted: readonly string[]; readonly files: () => ProjectFiles }

const NEXT_APP: ProjectName = 'a Next.js app'
const CONFIG_FOLDER_WITHOUT_A_PACKAGE_JSON = 'web'
// The plugin skips a file only under a folder named app, so only there does a file beside its app's package.json show the setting.
const NEXT_APP_FOLDER_NAMED_APP = 'app'
const BESIDE_THE_NEXT_APPS_PACKAGE_JSON = `${NEXT_APP_FOLDER_NAMED_APP}/invoice-date.tsx`

const PROJECTS: readonly ProjectCase[] = [
  {
    project: NEXT_APP,
    configFolder: '',
    linted: Object.keys(SOURCES_OF_A_NEXT_APP),
    files() {
      return { [PACKAGE_JSON]: packageJsonText(buildPackageJsonListingNext()), ...SOURCES_OF_A_NEXT_APP }
    },
  },
  {
    project: 'a Next.js app listing next as a dev dependency',
    configFolder: '',
    linted: [SERVER_PAGE],
    files() {
      return { [PACKAGE_JSON]: packageJsonText(buildPackageJsonListingNext('devDependencies')), [SERVER_PAGE]: SERVER_PAGE_SOURCE }
    },
  },
  {
    project: 'a Remix app',
    configFolder: '',
    linted: [REMIX_ROUTE],
    files() {
      return { [PACKAGE_JSON]: packageJsonText(buildPackageJsonListingRemix()), ...SOURCES_OF_A_REMIX_APP }
    },
  },
  {
    project: 'a monorepo whose root package.json lists no next, one app listing next and one Remix app',
    configFolder: '',
    linted: [`${NEXT_APP_FOLDER}/${SERVER_PAGE}`, `${REMIX_APP_FOLDER}/${REMIX_ROUTE}`],
    files() {
      return {
        [PACKAGE_JSON]: packageJsonText(buildPackageJson()),
        [`${NEXT_APP_FOLDER}/${PACKAGE_JSON}`]: packageJsonText(buildPackageJsonListingNext()),
        [`${NEXT_APP_FOLDER}/${SERVER_PAGE}`]: SERVER_PAGE_SOURCE,
        [`${REMIX_APP_FOLDER}/${PACKAGE_JSON}`]: packageJsonText(buildPackageJsonListingRemix()),
        [`${REMIX_APP_FOLDER}/${REMIX_ROUTE}`]: REMIX_ROUTE_SOURCE,
      }
    },
  },
  {
    project: 'a Next.js app holding a Remix app with a package.json of its own',
    configFolder: '',
    linted: [SERVER_PAGE, `${REMIX_APP_FOLDER}/${REMIX_ROUTE}`],
    files() {
      return {
        [PACKAGE_JSON]: packageJsonText(buildPackageJsonListingNext()),
        [SERVER_PAGE]: SERVER_PAGE_SOURCE,
        [`${REMIX_APP_FOLDER}/${PACKAGE_JSON}`]: packageJsonText(buildPackageJsonListingRemix()),
        [`${REMIX_APP_FOLDER}/${REMIX_ROUTE}`]: REMIX_ROUTE_SOURCE,
      }
    },
  },
  {
    project: 'a Next.js app whose lint config sits in a folder holding no package.json',
    configFolder: CONFIG_FOLDER_WITHOUT_A_PACKAGE_JSON,
    linted: [SERVER_PAGE],
    files() {
      return { [PACKAGE_JSON]: packageJsonText(buildPackageJsonListingNext()), [`${CONFIG_FOLDER_WITHOUT_A_PACKAGE_JSON}/${SERVER_PAGE}`]: SERVER_PAGE_SOURCE }
    },
  },
  {
    project: 'a monorepo whose root package.json lists no next and whose Next.js app is a folder named app',
    configFolder: '',
    linted: [BESIDE_THE_NEXT_APPS_PACKAGE_JSON],
    files() {
      return {
        [PACKAGE_JSON]: packageJsonText(buildPackageJson()),
        [`${NEXT_APP_FOLDER_NAMED_APP}/${PACKAGE_JSON}`]: packageJsonText(buildPackageJsonListingNext()),
        [BESIDE_THE_NEXT_APPS_PACKAGE_JSON]: SERVER_PAGE_SOURCE,
      }
    },
  },
]

type FileCase = { readonly project: ProjectName; readonly file: string; readonly what: string }

const SKIPPED: readonly FileCase[] = [
  { project: NEXT_APP, file: SERVER_PAGE, what: "a page without 'use client' under app/" },
  { project: NEXT_APP, file: SERVER_PAGE_BRANCHING_ON_WINDOW, what: "a page without 'use client' under app/ branching on window" },
  { project: NEXT_APP, file: SERVER_PAGE_UNDER_SRC, what: "a page without 'use client' under src/app/" },
  { project: 'a Next.js app listing next as a dev dependency', file: SERVER_PAGE, what: "a page without 'use client' under app/" },
  {
    project: 'a monorepo whose root package.json lists no next, one app listing next and one Remix app',
    file: `${NEXT_APP_FOLDER}/${SERVER_PAGE}`,
    what: 'the page of the app whose own package.json lists next',
  },
  { project: 'a Next.js app holding a Remix app with a package.json of its own', file: SERVER_PAGE, what: "the Next.js app's own page" },
  { project: 'a Next.js app whose lint config sits in a folder holding no package.json', file: SERVER_PAGE, what: 'a page whose nearest package.json, above the config, lists next' },
  { project: 'a monorepo whose root package.json lists no next and whose Next.js app is a folder named app', file: BESIDE_THE_NEXT_APPS_PACKAGE_JSON, what: "a file without 'use client' beside the app's own package.json, which lists next" },
]

const CHECKED: readonly FileCase[] = [
  { project: NEXT_APP, file: CLIENT_COMPONENT, what: "a component marked 'use client'" },
  { project: NEXT_APP, file: PAGES_ROUTER_PAGE, what: 'a Pages Router page' },
  { project: 'a Remix app', file: REMIX_ROUTE, what: 'a route under app/ in an app whose package.json lists no next' },
  {
    project: 'a monorepo whose root package.json lists no next, one app listing next and one Remix app',
    file: `${REMIX_APP_FOLDER}/${REMIX_ROUTE}`,
    what: 'the route of the app whose own package.json lists no next',
  },
  {
    project: 'a Next.js app holding a Remix app with a package.json of its own',
    file: `${REMIX_APP_FOLDER}/${REMIX_ROUTE}`,
    what: "the Remix app's route, whose nearest package.json lists no next",
  },
]

const MISSED: readonly FileCase[] = [
  { project: NEXT_APP, file: COMPONENT_A_CLIENT_COMPONENT_IMPORTS, what: "a component without 'use client' that a 'use client' file imports" },
  { project: NEXT_APP, file: COMPONENT_IN_ANOTHER_APP_FOLDER, what: 'a component in a folder named app outside the App Router' },
]

type Run = { readonly build: BuildName; readonly project: ProjectName; readonly reported: RuleIdsReportedByFile }

/** `folder`: the config's, an absolute path. */
type MadeProject = { readonly project: ProjectName; readonly folder: string }

function definedIn(configFolder: string): ReturnType<typeof defineLintRules> {
  return defineLintRules(buildConsumerLintRules(configFolder, { agentRulesets: SSR_LISTED, editorRulesets: SSR_LISTED }))
}

function mergedBeside(teamBlocks: readonly Linter.Config[], configFolder: string): Linter.Config[] {
  return mergeEslintConfig([...teamBlocks], definedIn(configFolder).editorRulesets.eslint, NO_TEAM_OXLINT_CONFIG)
}

const { ruleIdsReportedInProjectByFile } = setUpEslintConfigOracle()

describe("the react-ssr rules on a Next.js app's Server Components, by each file's nearest package.json", () => {
  const runs = setUpRunsBeforeTheSuite(async (tempProjects) => {
    const made = PROJECTS.map(({ project, configFolder, files }): MadeProject => ({ project, folder: join(tempProjects.create({ files: files() }), configFolder) }))
    const pairs = BUILDS.flatMap(({ build, configOf }) => made.map((madeProject) => ({ build, configOf, ...madeProject })))
    const byBuild = await Promise.all(
      pairs.map(async ({ build, configOf, project, folder }): Promise<Run> => ({ build, project, reported: await ruleIdsReportedInProjectByFile(folder, configOf(folder)) })),
    )
    const nextApp = foundOr(made.find(({ project }) => project === NEXT_APP), `${NEXT_APP} was not made`)
    const besideATeamSetting = await ruleIdsReportedInProjectByFile(nextApp.folder, mergedBeside([TEAM_SETTING_SERVER_COMPONENTS_OFF], nextApp.folder))
    return { byBuild, besideATeamSetting }
  })
  // A run that failed throws here, before the tests, so only the assertion can fail inside it.fails.
  beforeAll(() => {
    runs()
  })

  function reportedIn(build: BuildName, project: ProjectName): RuleIdsReportedByFile {
    return foundOr(
      runs().byBuild.find((run) => run.build === build && run.project === project),
      `the ${build} was not run over ${project}`,
    ).reported
  }

  const EACH_BUILD_AND_PROJECT = BUILDS.flatMap(({ build }) => PROJECTS.map(({ project, linted }) => ({ build, project, linted })))

  it.each(EACH_BUILD_AND_PROJECT)('lints every file of $project, in the $build', ({ build, project, linted }) => {
    expect(Object.keys(reportedIn(build, project)).toSorted()).toStrictEqual(linted.toSorted())
  })

  it.each(BUILDS.flatMap(({ build }) => SKIPPED.map((row) => ({ build, ...row }))))('reports nothing on $what ($file) in $project, in the $build', ({ build, project, file }) => {
    expect(reportedIn(build, project)[file]).toStrictEqual([])
  })

  it.each(BUILDS.flatMap(({ build }) => CHECKED.map((row) => ({ build, ...row }))))('still reports $what ($file) in $project, in the $build', ({ build, project, file }) => {
    expect(reportedIn(build, project)[file]).toStrictEqual([TIME_ZONE_RULE])
  })

  // KNOWN GAP: the plugin's limits under its Next.js setting, a written limit: only Next.js's module graph knows that a
  // file without 'use client' hydrates because a 'use client' file imports it, and the setting reads any folder named app.
  it.fails.each(BUILDS.flatMap(({ build }) => MISSED.map((row) => ({ build, ...row }))))('reports $what ($file) in $project, in the $build', ({ build, project, file }) => {
    expect(reportedIn(build, project)[file]).toStrictEqual([TIME_ZONE_RULE])
  })

  it("reports a page without 'use client' under app/ again where a team block after ours sets the plugin's setting to none, in the ESLint merge", () => {
    expect(runs().besideATeamSetting[SERVER_PAGE]).toStrictEqual([TIME_ZONE_RULE])
  })
})
