import type { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import { buildConsumerLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOthers, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { NO_TEAM_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'
import { isRecord } from './core/is-record.ts'
import { mergeEslintConfig } from './eslint.ts'
import { defineLintRules } from './index.ts'

// Without oxlint, ESLint runs our no-undef, so each layer's change to the runtime globals gets a block
// of its own, kept to the files our no-undef reads them in.

const tempProjects = setUpTempProjects()
const projectDir = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOthers()) } })

const JS_AND_TS_FILES = '**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}'
// no-undef ships ignoring TS and Svelte files (rule-data's rules.json), and the second entry turns it off in legacy/**.
const WHERE_NO_UNDEF_DOES_NOT_RUN = ['**/*.svelte', '**/*.{ts,tsx,mts,cts}', 'legacy/**']
const BROWSER_GLOBAL = 'window'
const NODE_GLOBAL = 'process'

const lintRules = buildConsumerLintRules(
  projectDir,
  { editorRulesets: { quality: ['correctness'], runtimes: ['browser'] } },
  {
    fileOverrides: [
      { files: ['lib/**'], editorRulesets: { runtimes: ['node'] } },
      { files: ['legacy/**'], rules: { 'no-undef': 'off' } },
      { files: ['scripts/**'], rules: { 'no-debugger': 'off' } },
    ],
  },
)

/** The merged config's runtime-globals blocks, merged in the test that reads them. */
function runtimeGlobalsBlocks(): Linter.Config[] {
  const { eslint } = defineLintRules(lintRules).editorRulesets
  return mergeEslintConfig([], eslint, NO_TEAM_OXLINT_CONFIG).filter(({ name }) => name?.includes('runtime-globals') === true)
}

function globalsOf({ languageOptions }: Readonly<Linter.Config>): Record<string, unknown> {
  const globals: unknown = languageOptions?.['globals']
  if (!isRecord(globals)) throw new Error('a runtime-globals block gives globals')
  return globals
}

describe("the ESLint merge's blocks of our runtimes' globals, in a project that lists no oxlint", () => {
  it('are one for the top level and one for the entry changing the globals, none for the entries changing none, each in the files our no-undef runs in', () => {
    expect(runtimeGlobalsBlocks().map(({ name, files, ignores }) => ({ name, files, ignores }))).toStrictEqual([
      { name: 'agents-inc/runtime-globals/0', files: [JS_AND_TS_FILES], ignores: WHERE_NO_UNDEF_DOES_NOT_RUN },
      { name: 'agents-inc/file-overrides/0/runtime-globals/0', files: [[JS_AND_TS_FILES, 'lib/**']], ignores: WHERE_NO_UNDEF_DOES_NOT_RUN },
    ])
  })

  it("give the top level's runtime in its block, and the entry's change of runtime in the entry's", () => {
    expect(runtimeGlobalsBlocks().map((block) => ({ browser: globalsOf(block)[BROWSER_GLOBAL], node: globalsOf(block)[NODE_GLOBAL] }))).toStrictEqual([
      { browser: false, node: undefined },
      { browser: 'off', node: false },
    ])
  })
})
