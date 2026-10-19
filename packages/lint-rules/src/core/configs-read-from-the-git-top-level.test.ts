import { describe, expect, it } from 'vitest'
import { buildAgentConfigs } from '../agent-configs.ts'
import { agentSettingsOf } from '../agent-settings.ts'
import { GLOB_PLACES, globsHeldBy } from '../__tests__/factories/check-factories.ts'
import { buildConsumerLintRules } from '../__tests__/factories/lint-rules-factories.ts'
import { buildTsconfig } from '../__tests__/factories/tsconfig-factories.ts'
import { setUpTempProjects } from '../__tests__/temp-projects.ts'
import { defineLintRules } from '../index.ts'
import { configsReadFromTheGitTopLevel } from './configs-read-from-the-git-top-level.ts'

// check runs both engines from the git top level: a glob tied to a folder keeps meaning the config's, one tied to none reaches every package.

const CONFIG_FOLDER = 'packages/web'
const AT_THE_TOP = ''

const TIED_TO_A_FOLDER = [
  { glob: 'src/**', read: 'packages/web/src/**' },
  { glob: 'src/**/*.test.ts', read: 'packages/web/src/**/*.test.ts' },
  { glob: './x/**', read: 'packages/web/x/**' },
  { glob: '!src/keep.ts', read: '!packages/web/src/keep.ts' },
  { glob: '!./x/keep.ts', read: '!packages/web/x/keep.ts' },
  { glob: String.raw`src/\(group\)/**`, read: String.raw`packages/web/src/\(group\)/**` },
]
const TIED_TO_NO_FOLDER = ['**/dist/**', '**/*.config.ts', '!**/keep.ts']
// oxlint's ignorePatterns read it from the root, as the build writes `ignores`' root forms in both engines; neither engine reads one in files as any file.
const LED_BY_A_SLASH = { glob: '/x/**', read: 'packages/web/x/**' }
// A path at the config folder's root, as the ESLint build names a TS file there that no tsconfig takes in.
const SLASH_FREE = { glob: 'seed.ts', read: 'packages/web/seed.ts' }
const FOLDERS_NAMED_WITH_GLOB_SYNTAX = [
  { folder: 'apps/(web)', read: String.raw`apps/\(web\)/src/**` },
  { folder: 'apps/[id]', read: String.raw`apps/\[id\]/src/**` },
]

describe('the configs check runs from the git top level, a glob at a time', () => {
  it.each(GLOB_PLACES.flatMap(({ place, holding }) => TIED_TO_A_FOLDER.map((row) => ({ place, holding, ...row }))))(
    'put the config folder in front of $glob, tied to a folder, in $place: $read',
    ({ holding, glob, read }) => {
      expect(configsReadFromTheGitTopLevel(holding([glob]), CONFIG_FOLDER)).toStrictEqual(holding([read]))
    },
  )

  it.each(GLOB_PLACES.flatMap(({ place, holding }) => TIED_TO_NO_FOLDER.map((glob) => ({ place, holding, glob }))))(
    'leave $glob, tied to no folder, as it is in $place, beside the globs tied to one',
    ({ holding, glob }) => {
      expect(configsReadFromTheGitTopLevel(holding([glob, 'src/**']), CONFIG_FOLDER)).toStrictEqual(holding([glob, 'packages/web/src/**']))
    },
  )

  it.each(GLOB_PLACES.filter(({ key }) => key === 'ignores'))('put the config folder in front of a glob led by /, a root form of ignores, in $place', ({ holding }) => {
    expect(configsReadFromTheGitTopLevel(holding([LED_BY_A_SLASH.glob]), CONFIG_FOLDER)).toStrictEqual(holding([LED_BY_A_SLASH.read]))
  })

  it.each(GLOB_PLACES.filter(({ key }) => key === 'files'))('leave a glob led by /, which names no file, as it is in $place, beside a glob tied to a folder, which it prefixes', ({ holding }) => {
    expect(configsReadFromTheGitTopLevel(holding([LED_BY_A_SLASH.glob, 'src/**']), CONFIG_FOLDER)).toStrictEqual(holding([LED_BY_A_SLASH.glob, 'packages/web/src/**']))
  })

  it.each(GLOB_PLACES.filter(({ engine }) => engine === 'eslint'))('put the config folder in front of a slash-free glob, which ESLint reads from its root alone, in $place', ({ holding }) => {
    expect(configsReadFromTheGitTopLevel(holding([SLASH_FREE.glob]), CONFIG_FOLDER)).toStrictEqual(holding([SLASH_FREE.read]))
  })

  it.each(GLOB_PLACES.filter(({ engine }) => engine === 'oxlint'))('leave a slash-free glob, which oxlint reads at any depth, as it is in $place, beside the ESLint places, which prefix it', ({ holding }) => {
    expect(configsReadFromTheGitTopLevel(holding([SLASH_FREE.glob]), CONFIG_FOLDER)).toStrictEqual(holding([SLASH_FREE.glob]))
  })

  it.each(GLOB_PLACES)('are the configs given, equal, where the config sits at the git top level: $place', ({ holding }) => {
    const configs = holding([...TIED_TO_A_FOLDER.map(({ glob }) => glob), ...TIED_TO_NO_FOLDER])

    expect(configsReadFromTheGitTopLevel(configs, AT_THE_TOP)).toStrictEqual(configs)
  })

  it.each(GLOB_PLACES.flatMap(({ place, holding }) => FOLDERS_NAMED_WITH_GLOB_SYNTAX.map((row) => ({ place, holding, ...row }))))(
    'put a config folder named with glob syntax in front as a literal: $folder in $place',
    ({ holding, folder, read }) => {
      expect(configsReadFromTheGitTopLevel(holding(['src/**']), folder)).toStrictEqual(holding([read]))
    },
  )
})

describe('the configs check builds for a project, read from the git top level', () => {
  const tempProjects = setUpTempProjects()
  // A TS file no tsconfig takes in, which the ESLint build names by its path.
  const OUTSIDE_EVERY_TSCONFIG = 'scripts/seed.ts'
  const AT_THE_ROOT_OUTSIDE_EVERY_TSCONFIG = 'vite.config.ts'
  const IGNORES = ['src/generated/**', '!src/generated/keep.ts', './x/**', '**/dist/**']
  const OVERRIDE_FILES = ['src/**']
  const TIED_AS_BUILT = ['src/generated/**', '!src/generated/keep.ts', './x/**', '/x/**', 'src/**', OUTSIDE_EVERY_TSCONFIG, AT_THE_ROOT_OUTSIDE_EVERY_TSCONFIG]
  const TIED_AS_READ = [
    'packages/web/src/generated/**',
    '!packages/web/src/generated/keep.ts',
    'packages/web/x/**',
    'packages/web/src/**',
    `packages/web/${OUTSIDE_EVERY_TSCONFIG}`,
    `packages/web/${AT_THE_ROOT_OUTSIDE_EVERY_TSCONFIG}`,
  ]
  const ANY_FOLDER = '**/'
  const READ_FROM_THE_CONFIG_FOLDER = `${CONFIG_FOLDER}/`
  const NEGATION = '!'

  function builtFor(): ReturnType<typeof buildAgentConfigs> {
    const projectDir = tempProjects.create({
      files: { 'tsconfig.json': JSON.stringify(buildTsconfig({ include: ['src'] })), 'src/a.ts': 'export const a = 1\n', [OUTSIDE_EVERY_TSCONFIG]: 'export const seed = 1\n', [AT_THE_ROOT_OUTSIDE_EVERY_TSCONFIG]: 'export const config = 1\n' },
    })
    const lintRules = buildConsumerLintRules(
      projectDir,
      { agentRulesets: { quality: ['redundancy', 'correctness'] } },
      { ignores: IGNORES, fileOverrides: [{ files: OVERRIDE_FILES, rules: { 'no-debugger': 'off', '@typescript-eslint/only-throw-error': 'off' } }] },
    )
    return buildAgentConfigs(agentSettingsOf(defineLintRules(lintRules).editorRulesets.eslint))
  }

  function isReadAtAnyDepthOrFromTheConfigFolder(glob: string): boolean {
    const pattern = glob.startsWith(NEGATION) ? glob.slice(NEGATION.length) : glob
    return pattern.startsWith(ANY_FOLDER) || pattern.startsWith(READ_FROM_THE_CONFIG_FOLDER)
  }

  // A glob under another key, or in a rule's options, escapes this guard; only check-monorepo's real-engine runs would show it.
  it('hold no glob under files, ignores, ignorePatterns or excludeFiles that is not read at any depth or from the config folder, each tied glob read so, beside the build, which holds them unread', () => {
    const built = builtFor()
    const read = globsHeldBy(configsReadFromTheGitTopLevel(built, CONFIG_FOLDER))
    const asBuilt = globsHeldBy(built)

    expect({
      unreadAsBuilt: TIED_AS_BUILT.filter((glob) => !asBuilt.includes(glob)),
      readNeitherWay: read.filter((glob) => !isReadAtAnyDepthOrFromTheConfigFolder(glob)),
      missing: TIED_AS_READ.filter((glob) => !read.includes(glob)),
    }).toStrictEqual({ unreadAsBuilt: [], readNeitherWay: [], missing: [] })
  })
})
