import { jsonFileText } from '../factories/team-config-file-factories.ts'
import { buildTsconfig } from '../factories/tsconfig-factories.ts'
import type { RuleByItsNames } from '../findings-beside-the-team.ts'
import type { ProjectFiles } from '../temp-projects.ts'

// A publishable package whose tsconfig maps `@/*` to `./src/*`, whose stories import a helper of `src` through
// that alias. Beside it, three imports the rule must still report: a devDependency, and an unpublished file
// through an alias eslint-plugin-n reads as a path and through a relative path.

export const NO_UNPUBLISHED_IMPORT: RuleByItsNames = { rule: 'n/no-unpublished-import', names: ['n/no-unpublished-import'] }

export const STORY_FILE = 'packages/ui/src/components/button/button.stories.tsx'

const PACKAGE_JSON = {
  name: '@repo/ui',
  version: '0.0.0',
  files: ['dist', 'src'],
  peerDependencies: { react: '^19.0.0' },
  devDependencies: { '@repo/api-mocks': '*' },
}

// No baseUrl, which TypeScript 6 deprecates. `#scripts/*`, like `@/`, fails the plugin's package-name pattern.
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

export const workspacePackageFiles: ProjectFiles = {
  'packages/ui/package.json': jsonFileText(PACKAGE_JSON),
  'packages/ui/tsconfig.json': jsonFileText(TSCONFIG),
  'packages/ui/src/internal/story/story.tsx': STORY_HELPER,
  [STORY_FILE]: STORY,
  'packages/ui/scripts/build-story.ts': BUILD_STORY_SCRIPT,
  'packages/ui/scripts/story-title.ts': STORY_TITLE_SCRIPT,
}

/** Each import of something unpublished, not the alias to src. */
export const OWED_IN_THE_STORY = {
  [STORY_FILE]: {
    'n/no-unpublished-import': [
      `${STORY_FILE}:2 n/no-unpublished-import`,
      `${STORY_FILE}:3 n/no-unpublished-import`,
      `${STORY_FILE}:4 n/no-unpublished-import`,
    ],
  },
}

// Two more packages whose tsconfig does not allow importing TS extensions: eslint-plugin-n 18.4.1 then tries no
// TS or JSX extension of its own (get-try-extensions.js). In the second, `@/both` resolves to the unpublished
// both.ts, as TypeScript and bundlers resolve it, beside the published both.json.

export const EVERY_EXTENSION_MODULE = 'packages/ui/src/every-extension.tsx'

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

export const aliasedFilesOfEachExtension: ProjectFiles = {
  'packages/ui/package.json': jsonFileText(PUBLISHING_SRC),
  'packages/ui/tsconfig.json': jsonFileText(ALIAS_TSCONFIG),
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
  'packages/conf/package.json': jsonFileText(PUBLISHING_BOTH_JSON_ALONE),
  'packages/conf/tsconfig.json': jsonFileText(ALIAS_TSCONFIG),
  'packages/conf/src/both.json': '{ "both": 1 }\n',
  'packages/conf/src/both.ts': 'const both = 1\nexport default both\n',
  [BOTH_MODULE]: USES_BOTH,
}

/** Nothing through the alias to a published file; the import TypeScript resolves to the unpublished both.ts. */
export const OWED_THROUGH_THE_ALIAS = {
  [EVERY_EXTENSION_MODULE]: { 'n/no-unpublished-import': [] },
  [BOTH_MODULE]: { 'n/no-unpublished-import': [`${BOTH_MODULE}:1 n/no-unpublished-import`] },
}
