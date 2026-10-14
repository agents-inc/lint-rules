import { buildTsconfig } from '../factories/tsconfig-factories.ts'
import type { RuleByItsNames } from '../findings-beside-the-team.ts'
import type { ProjectFiles } from '../temp-projects.ts'

// A publishable package in a monorepo, shaped like real run 3's case R-ALL-6 (turborepo-monorepo's
// packages/ui): it publishes `dist` and `src`, its tsconfig maps `@/*` to `./src/*`, and its stories
// import a helper of `src` through that alias, where n/no-unpublished-import reported every story
// (`"@/internal/story/story" is not published.`) when ESLint ran from the monorepo's root. Beside the
// alias, three imports the rule must still report: a package the package lists in devDependencies
// alone, as packages/ui's `@repo/api-mocks` was, and a file it does not publish, through an alias
// eslint-plugin-n reads as a path, as it reads `@/`, and through a relative path.

export const NO_UNPUBLISHED_IMPORT: RuleByItsNames = { rule: 'n/no-unpublished-import', names: ['n/no-unpublished-import'] }

/** The story importing through the alias, which the package publishes. */
export const STORY_FILE = 'packages/ui/src/components/button/button.stories.tsx'

const PACKAGE_JSON = {
  name: '@repo/ui',
  version: '0.0.0',
  files: ['dist', 'src'],
  peerDependencies: { react: '^19.0.0' },
  devDependencies: { '@repo/api-mocks': '*' },
}

// No baseUrl, which TypeScript 6 deprecates: each path is relative to the tsconfig. `#scripts/*`
// names the unpublished scripts folder; like `@/`, it fails the plugin's package-name pattern.
const TSCONFIG = buildTsconfig({
  compilerOptions: {
    target: 'ES2022',
    module: 'esnext',
    moduleResolution: 'bundler',
    jsx: 'react-jsx',
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    paths: { '@/*': ['./src/*'], '#scripts/*': ['./scripts/*'] },
  },
  include: ['src', 'scripts'],
})

// The story helper packages/ui imports by its alias; a .tsx file, as story.tsx was there.
const STORY_HELPER = `export function StoryWrapper({ title }: { readonly title: string }) {
  return <section aria-label={title} />
}
`

// The alias to src (1), a package listed in devDependencies alone (2), the alias to the unpublished
// scripts folder (3) and a relative path into it (4).
const STORY = `import { StoryWrapper } from '@/internal/story/story'
import { mockHandlers } from '@repo/api-mocks'
import { buildStory } from '#scripts/build-story'
import { storyTitle } from '../../../scripts/story-title'

export const Primary = buildStory(StoryWrapper, mockHandlers, storyTitle)
`

const BUILD_STORY_SCRIPT = `export function buildStory(...parts: readonly unknown[]): readonly unknown[] {
  return parts
}
`

const STORY_TITLE_SCRIPT = `export const storyTitle = 'Button'
`

/** The package's files, under packages/ui of the project's root. */
export const workspacePackageFiles: ProjectFiles = {
  'packages/ui/package.json': `${JSON.stringify(PACKAGE_JSON, null, 2)}\n`,
  'packages/ui/tsconfig.json': `${JSON.stringify(TSCONFIG, null, 2)}\n`,
  'packages/ui/src/internal/story/story.tsx': STORY_HELPER,
  [STORY_FILE]: STORY,
  'packages/ui/scripts/build-story.ts': BUILD_STORY_SCRIPT,
  'packages/ui/scripts/story-title.ts': STORY_TITLE_SCRIPT,
}

/** What the rule owes in the story: each import of something the package does not publish, and not the alias to src. */
export const OWED_IN_THE_STORY = {
  [STORY_FILE]: {
    'n/no-unpublished-import': [
      `${STORY_FILE}:2 n/no-unpublished-import`,
      `${STORY_FILE}:3 n/no-unpublished-import`,
      `${STORY_FILE}:4 n/no-unpublished-import`,
    ],
  },
}

// Two more publishable packages, whose tsconfig maps `@/*` to `./src/*` and does not allow importing
// TS extensions, as packages/ui's did: eslint-plugin-n then tries no TS or JSX extension of its own
// (lib/util/get-try-extensions.js, 18.4.1). In the first, a module imports through the alias a file
// of each extension we lint and a JSON file, all published. In the second, `@/both` names both.ts,
// which the package does not publish, beside both.json, which it does: TypeScript and bundlers
// resolve it to both.ts.

/** The module importing through the alias a published file of each extension. */
export const EVERY_EXTENSION_MODULE = 'packages/ui/src/every-extension.tsx'

/** The module importing `@/both`. */
export const BOTH_MODULE = 'packages/conf/src/uses-both.ts'

const ALIAS_TSCONFIG = buildTsconfig({
  compilerOptions: {
    target: 'ES2022',
    module: 'esnext',
    moduleResolution: 'bundler',
    jsx: 'react-jsx',
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    allowJs: true,
    resolveJsonModule: true,
    paths: { '@/*': ['./src/*'] },
  },
  include: ['src'],
})

const PUBLISHING_SRC = { name: '@repo/ui', version: '0.0.0', files: ['src'] }

const PUBLISHING_BOTH_JSON_ALONE = { name: '@repo/conf', version: '0.0.0', files: ['src/both.json', 'src/uses-both.ts'] }

// Each extension we lint, then JSON: .ts (1), .tsx (2), .jsx (3), .mts (4), .cts (5), .js (6),
// .mjs (7), .cjs (8), .json (9).
const EVERY_EXTENSION = `import { a } from '@/a'
import { b } from '@/b'
import { c } from '@/c'
import { d } from '@/d'
import { e } from '@/e'
import { f } from '@/f'
import { g } from '@/g'
import { h } from '@/h'
import data from '@/data'

export const all = [a, b, c, d, e, f, g, h, data]
`

const USES_BOTH = `import both from '@/both'

export const all = [both]
`

/** The two packages' files, under packages/ui and packages/conf of the project's root. */
export const aliasedFilesOfEachExtension: ProjectFiles = {
  'packages/ui/package.json': `${JSON.stringify(PUBLISHING_SRC, null, 2)}\n`,
  'packages/ui/tsconfig.json': `${JSON.stringify(ALIAS_TSCONFIG, null, 2)}\n`,
  'packages/ui/src/a.ts': 'export const a = 1\n',
  'packages/ui/src/b.tsx': 'export const b = <i />\n',
  'packages/ui/src/c.jsx': 'export const c = <i />\n',
  'packages/ui/src/d.mts': 'export const d = 1\n',
  'packages/ui/src/e.cts': 'export const e = 1\n',
  'packages/ui/src/f.js': 'export const f = 1\n',
  'packages/ui/src/g.mjs': 'export const g = 1\n',
  'packages/ui/src/h.cjs': 'module.exports = { h: 1 }\n',
  'packages/ui/src/data.json': '{ "data": 1 }\n',
  [EVERY_EXTENSION_MODULE]: EVERY_EXTENSION,
  'packages/conf/package.json': `${JSON.stringify(PUBLISHING_BOTH_JSON_ALONE, null, 2)}\n`,
  'packages/conf/tsconfig.json': `${JSON.stringify(ALIAS_TSCONFIG, null, 2)}\n`,
  'packages/conf/src/both.json': '{ "both": 1 }\n',
  'packages/conf/src/both.ts': 'const both = 1\nexport default both\n',
  [BOTH_MODULE]: USES_BOTH,
}

/** What the rule owes in the two modules: nothing through the alias to a published file, and the import TypeScript resolves to the unpublished both.ts. */
export const OWED_THROUGH_THE_ALIAS = {
  [EVERY_EXTENSION_MODULE]: { 'n/no-unpublished-import': [] },
  [BOTH_MODULE]: { 'n/no-unpublished-import': [`${BOTH_MODULE}:1 n/no-unpublished-import`] },
}
