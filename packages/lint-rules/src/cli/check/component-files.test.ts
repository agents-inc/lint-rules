import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildWithheldFixes } from '../../__tests__/factories/check-factories.ts'
import { buildFileOverride, buildLintRules } from '../../__tests__/factories/lint-rules-factories.ts'
import { setUpTempProjects } from '../../__tests__/temp-projects.ts'
import { componentFileBlocksOf, isAComponentExtension } from './component-files.ts'
import { eslintEngineFor } from './eslint-run.ts'

// oxlint alone lints a component; check asks its ESLint engine only whether the config ignores one, and whether
// it may hold suppressions. check-framework-files.integration.test.ts runs check on components.

type SuppressionSettings = Parameters<typeof componentFileBlocksOf>[0]

const tempProjects = setUpTempProjects()

const EXTENSIONS_CHECK_MEETS = ['js', 'mjs', 'cjs', 'jsx', 'ts', 'mts', 'cts', 'tsx', 'vue', 'svelte', 'astro', 'json', 'md', 'css']

const ENTRY_FOLDER = 'src/entry'
const ENTRY_FILES = [`${ENTRY_FOLDER}/**`]
const SOURCE_FILES = ['src/**']
const COMPONENT_NAMED_WITH_NO_SLASH = 'Greeting.vue'
const COMPONENTS_OUTSIDE_THE_ENTRY = [`src/${COMPONENT_NAMED_WITH_NO_SLASH}`, 'src/Legacy.svelte', 'src/index.astro']
const COMPONENTS_IN_THE_ENTRY = [`${ENTRY_FOLDER}/${COMPONENT_NAMED_WITH_NO_SLASH}`, `${ENTRY_FOLDER}/Legacy.svelte`, `${ENTRY_FOLDER}/index.astro`]
const EVERY_COMPONENT = [...COMPONENTS_OUTSIDE_THE_ENTRY, ...COMPONENTS_IN_THE_ENTRY]

/** What check's ESLint engine, given these blocks alone, says of each component. */
async function componentsAllowingSuppressions(settings: SuppressionSettings): Promise<string[]> {
  const projectDir = tempProjects.create({})
  const eslint = eslintEngineFor(projectDir, componentFileBlocksOf(settings), buildWithheldFixes())
  const allowed = await Promise.all(EVERY_COMPONENT.map((file) => eslint.allowsSuppressionsIn(join(projectDir, file))))
  return EVERY_COMPONENT.filter((_file, index) => allowed[index])
}

describe('isAComponentExtension', () => {
  it("is true of Vue's, Svelte's and Astro's extensions, and of no JS, TS or other one", () => {
    expect(EXTENSIONS_CHECK_MEETS.filter((extension) => isAComponentExtension(extension))).toStrictEqual(['vue', 'svelte', 'astro'])
  })
})

describe("the component files' blocks, as check's ESLint engine reads them", () => {
  it.each([
    { setting: 'left out', settings: buildLintRules({}) },
    { setting: 'false', settings: buildLintRules({}, { allowSuppressions: false }) },
  ])("allow suppressions in no component where the top level's allowSuppressions is $setting", async ({ settings }) => {
    expect(await componentsAllowingSuppressions(settings)).toStrictEqual([])
  })

  it('allow suppressions in every component where the top level allows them', async () => {
    expect(await componentsAllowingSuppressions(buildLintRules({}, { allowSuppressions: true }))).toStrictEqual(EVERY_COMPONENT)
  })

  it("allow suppressions in an entry's components alone where the entry allows them and the top level bans them", async () => {
    const settings = buildLintRules({}, { fileOverrides: [buildFileOverride(ENTRY_FILES, { allowSuppressions: true })] })

    expect(await componentsAllowingSuppressions(settings)).toStrictEqual(COMPONENTS_IN_THE_ENTRY)
  })

  it("ban suppressions in an entry's components alone where the entry bans them and the top level allows them", async () => {
    const settings = buildLintRules({}, { allowSuppressions: true, fileOverrides: [buildFileOverride(ENTRY_FILES, { allowSuppressions: false })] })

    expect(await componentsAllowingSuppressions(settings)).toStrictEqual(COMPONENTS_OUTSIDE_THE_ENTRY)
  })

  it('keep the setting before an entry that leaves allowSuppressions out, in the components it names', async () => {
    const settings = buildLintRules({}, { fileOverrides: [buildFileOverride(ENTRY_FILES, { allowSuppressions: true }), buildFileOverride(SOURCE_FILES, {})] })

    expect(await componentsAllowingSuppressions(settings)).toStrictEqual(COMPONENTS_IN_THE_ENTRY)
  })

  it('give the later entry the say in the components both entries name', async () => {
    const settings = buildLintRules({}, {
      fileOverrides: [buildFileOverride(SOURCE_FILES, { allowSuppressions: true }), buildFileOverride(ENTRY_FILES, { allowSuppressions: false })],
    })

    expect(await componentsAllowingSuppressions(settings)).toStrictEqual(COMPONENTS_OUTSIDE_THE_ENTRY)
  })

  it('reach a component an entry names with no slash in any folder', async () => {
    const settings = buildLintRules({}, { fileOverrides: [buildFileOverride([COMPONENT_NAMED_WITH_NO_SLASH], { allowSuppressions: true })] })

    expect(await componentsAllowingSuppressions(settings)).toStrictEqual([`src/${COMPONENT_NAMED_WITH_NO_SLASH}`, `${ENTRY_FOLDER}/${COMPONENT_NAMED_WITH_NO_SLASH}`])
  })
})
