import type { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import { setUpEslintConfigOracle } from '../__tests__/eslint-config-oracle.ts'
import { buildFilesTerm } from '../__tests__/factories/files-condition-factories.ts'
import { buildTeamEslintBlock } from '../__tests__/factories/team-config-factories.ts'
import { offBlocksOf } from './eslint-off-blocks.ts'

// An entry asking files of one extension outside a folder has no glob for ignores to take back: the folder
// is left out by ignores, and the off holds in the files left.

const RULE = 'no-debugger'
const VUE_FILES = '**/*.vue'
const SVELTE_FILES = '**/*.svelte'
const OUTSIDE_THE_LEGACY_FOLDER = '!legacy/**'
const IN_THE_SRC_FOLDER = 'src/**'
const IN_THE_LIB_FOLDER = 'lib/**'
const IN_A_COMPONENTS_FOLDER = '**/components/**'
const IN_A_ROUTES_FOLDER = '**/routes/**'
const VUE_FILE = 'src/a.vue'
const VUE_FILE_IN_THE_LEGACY_FOLDER = 'legacy/a.vue'
const VUE_FILE_IN_THE_LIB_FOLDER = 'lib/a.vue'
const VUE_FILE_IN_THE_TEST_FOLDER = 'test/a.vue'
const VUE_FILE_IN_A_COMPONENTS_FOLDER = 'src/components/a.vue'
const VUE_FILE_IN_A_ROUTES_FOLDER = 'src/routes/a.vue'
const SVELTE_FILE_IN_A_COMPONENTS_FOLDER = 'src/components/a.svelte'
const SVELTE_FILE_IN_A_ROUTES_FOLDER = 'src/routes/a.svelte'
// The off block's ignores: every file, then a folder taken back, then every file but a .vue.
const EVERY_FILE_IGNORED = '**'
const EVERY_FILE_BUT_A_VUE_FILE = '**/!(*.vue)'
const VUE_FILES_RUNNING_THE_RULE = buildTeamEslintBlock('vue-files', { files: [VUE_FILES], rules: { [RULE]: 'error' } })
const VUE_AND_SVELTE_FILES_RUNNING_THE_RULE = buildTeamEslintBlock('vue-and-svelte-files', {
  files: [VUE_FILES, SVELTE_FILES],
  rules: { [RULE]: 'error' },
})

const { ruleSeverityFor } = setUpEslintConfigOracle()

function offBlockName(index: number): string {
  return `off/${String(index)}`
}

/** With the off blocks after a block running it. */
async function severitiesOf(
  runningTheRule: Linter.Config,
  offs: readonly Linter.Config[],
  files: readonly string[],
): Promise<{ file: string; severity: Linter.StringSeverity | undefined }[]> {
  const config = [runningTheRule, ...offs]
  return Promise.all(files.map(async (file) => ({ file, severity: await ruleSeverityFor(config, file, RULE) })))
}

describe('offBlocksOf, for files of another type outside a folder', () => {
  it('turns the rule off in those files, and leaves it as it was in the folder', async () => {
    const offs = offBlocksOf([{ names: [RULE], where: [buildFilesTerm([VUE_FILES, OUTSIDE_THE_LEGACY_FOLDER])] }], offBlockName)
    const config = [VUE_FILES_RUNNING_THE_RULE, ...offs]
    const severities = await Promise.all(
      [VUE_FILE, VUE_FILE_IN_THE_LEGACY_FOLDER].map(async (file) => ({ file, severity: await ruleSeverityFor(config, file, RULE) })),
    )

    expect(severities).toStrictEqual([
      { file: VUE_FILE, severity: 'off' },
      { file: VUE_FILE_IN_THE_LEGACY_FOLDER, severity: 'error' },
    ])
  })
})

describe('offBlocksOf, for files of another type in a folder', () => {
  it('turns the rule off in the folder, and leaves it as it was outside', async () => {
    const offs = offBlocksOf([{ names: [RULE], where: [buildFilesTerm([VUE_FILES, IN_THE_SRC_FOLDER])] }], offBlockName)

    expect(await severitiesOf(VUE_FILES_RUNNING_THE_RULE, offs, [VUE_FILE, VUE_FILE_IN_THE_LIB_FOLDER])).toStrictEqual([
      { file: VUE_FILE, severity: 'off' },
      { file: VUE_FILE_IN_THE_LIB_FOLDER, severity: 'error' },
    ])
  })
})

describe('offBlocksOf, for files of one type in either of two folders', () => {
  const offs = offBlocksOf(
    [{ names: [RULE], where: [buildFilesTerm([VUE_FILES, IN_THE_SRC_FOLDER]), buildFilesTerm([VUE_FILES, IN_THE_LIB_FOLDER])] }],
    offBlockName,
  )

  it('writes one block, whose ignores take both folders back', () => {
    expect(offs).toStrictEqual([
      { name: offBlockName(0), ignores: [EVERY_FILE_IGNORED, `!${IN_THE_SRC_FOLDER}`, `!${IN_THE_LIB_FOLDER}`, EVERY_FILE_BUT_A_VUE_FILE], rules: { [RULE]: 'off' } },
    ])
  })

  it('turns the rule off in both folders, and leaves it as it was outside them', async () => {
    expect(
      await severitiesOf(VUE_FILES_RUNNING_THE_RULE, offs, [VUE_FILE, VUE_FILE_IN_THE_LIB_FOLDER, VUE_FILE_IN_THE_TEST_FOLDER]),
    ).toStrictEqual([
      { file: VUE_FILE, severity: 'off' },
      { file: VUE_FILE_IN_THE_LIB_FOLDER, severity: 'off' },
      { file: VUE_FILE_IN_THE_TEST_FOLDER, severity: 'error' },
    ])
  })
})

describe('offBlocksOf, for files of two types, each in folders of its own', () => {
  it('turns the rule off in each type where its entry asks, and leaves it as it was elsewhere', async () => {
    const offs = offBlocksOf(
      [{ names: [RULE], where: [buildFilesTerm([VUE_FILES, IN_A_COMPONENTS_FOLDER]), buildFilesTerm([SVELTE_FILES, IN_A_ROUTES_FOLDER])] }],
      offBlockName,
    )
    const files = [VUE_FILE_IN_A_COMPONENTS_FOLDER, VUE_FILE_IN_A_ROUTES_FOLDER, SVELTE_FILE_IN_A_ROUTES_FOLDER, SVELTE_FILE_IN_A_COMPONENTS_FOLDER]

    expect(await severitiesOf(VUE_AND_SVELTE_FILES_RUNNING_THE_RULE, offs, files)).toStrictEqual([
      { file: VUE_FILE_IN_A_COMPONENTS_FOLDER, severity: 'off' },
      { file: VUE_FILE_IN_A_ROUTES_FOLDER, severity: 'error' },
      { file: SVELTE_FILE_IN_A_ROUTES_FOLDER, severity: 'off' },
      { file: SVELTE_FILE_IN_A_COMPONENTS_FOLDER, severity: 'error' },
    ])
  })
})

describe('offBlocksOf, for files of another type in two folders at once', () => {
  it('leaves the rule as it was in a file of that type outside them', async () => {
    const offs = offBlocksOf([{ names: [RULE], where: [buildFilesTerm([VUE_FILES, IN_THE_SRC_FOLDER, IN_A_COMPONENTS_FOLDER])] }], offBlockName)

    expect(await severitiesOf(VUE_FILES_RUNNING_THE_RULE, offs, [VUE_FILE_IN_THE_LIB_FOLDER])).toStrictEqual([
      { file: VUE_FILE_IN_THE_LIB_FOLDER, severity: 'error' },
    ])
  })
})

describe('offBlocksOf, for files of one type everywhere, and in a folder too', () => {
  it('writes one block, as for every file of that type', () => {
    const offs = offBlocksOf([{ names: [RULE], where: [buildFilesTerm([VUE_FILES]), buildFilesTerm([VUE_FILES, IN_THE_LIB_FOLDER])] }], offBlockName)

    expect(offs).toStrictEqual([{ name: offBlockName(0), ignores: [EVERY_FILE_BUT_A_VUE_FILE], rules: { [RULE]: 'off' } }])
  })
})
