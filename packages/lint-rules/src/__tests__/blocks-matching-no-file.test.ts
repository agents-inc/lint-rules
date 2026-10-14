import { describe, expect, it } from 'vitest'
import { eslintBlocksMatchingNoFile, oxlintOverridesMatchingNoFile } from './blocks-matching-no-file.ts'
import { buildWrittenEslintBlock, buildWrittenOxlintConfig, buildWrittenOxlintOverride } from './factories/written-block-factories.ts'

describe('eslintBlocksMatchingNoFile', () => {
  it.each([
    { how: 'a glob ANDed with its own negation', files: [['**/*.ts', '!**/*.ts']], ignores: [] },
    { how: 'two literal paths ANDed', files: [['out/a.ts', 'out/b.ts']], ignores: [] },
    { how: 'a glob its own ignores leave out whole', files: ['**/*.ts'], ignores: ['**/*.ts'] },
    { how: 'a literal path its ignores name with a leading ./', files: [['**/*.ts', './src/a.ts']], ignores: ['src/a.ts'] },
    { how: 'a literal path with escaped glob syntax, its ignores naming it alike', files: ['app/\\[id\\]/a.ts'], ignores: ['app/\\[id\\]/a.ts'] },
  ])('names a block matching no file: $how', ({ files, ignores }) => {
    expect(eslintBlocksMatchingNoFile([buildWrittenEslintBlock('ours', files, ignores)])).toStrictEqual([`ours: ${JSON.stringify({ files, ignores })}`])
  })

  it.each([
    { how: 'a glob ANDed with the negation of another', block: buildWrittenEslintBlock('ours', [['**/*.ts', '!**/*.test.ts']]) },
    { how: 'a literal path ANDed with a glob', block: buildWrittenEslintBlock('ours', [['out/a.ts', '**/*.ts']]) },
    { how: 'one literal path written twice', block: buildWrittenEslintBlock('ours', [['out/a.ts', './out/a.ts']]) },
    { how: 'a glob its ignores leave out, a negated ignore after taking some back', block: buildWrittenEslintBlock('ours', ['**/*.ts'], ['**/*.ts', '!src/**']) },
    { how: 'a glob its ignores leave out in part', block: buildWrittenEslintBlock('ours', ['**/*.ts'], ['**/*.test.ts']) },
    { how: 'an entry matching no file beside one matching some', block: buildWrittenEslintBlock('ours', ['**/*.ts', 'src/**'], ['**/*.ts']) },
    { how: 'escaped glob syntax beside the same characters unescaped, a glob of its own', block: buildWrittenEslintBlock('ours', ['app/\\[id\\]/a.ts'], ['app/[id]/a.ts']) },
  ])('names no block matching some file: $how', ({ block }) => {
    expect(eslintBlocksMatchingNoFile([block])).toStrictEqual([])
  })

  it('names no block without files, which applies to every file it does not ignore', () => {
    expect(eslintBlocksMatchingNoFile([{ name: 'ours', ignores: ['**/*.ts'] }])).toStrictEqual([])
  })
})

describe('oxlintOverridesMatchingNoFile', () => {
  it.each([
    { how: 'every glob of its files excluded', override: buildWrittenOxlintOverride(['lib/a.ts', 'lib/**'], ['lib/**', 'lib/a.ts']) },
    { how: 'a glob with no slash excluded at any depth', override: buildWrittenOxlintOverride(['a.ts'], ['**/a.ts']) },
    { how: 'a path excluded with a leading ./', override: buildWrittenOxlintOverride(['lib/a.ts'], ['./lib/a.ts']) },
  ])('names an override matching no file: $how', ({ override }) => {
    expect(oxlintOverridesMatchingNoFile(buildWrittenOxlintConfig([override]))).toStrictEqual([
      JSON.stringify({ files: override.files, excludeFiles: override.excludeFiles }),
    ])
  })

  it.each([
    { how: 'a glob of its files left in', override: buildWrittenOxlintOverride(['lib/**', 'src/**'], ['lib/**']) },
    { how: 'a glob with no slash beside a path from the root', override: buildWrittenOxlintOverride(['a.ts'], ['a.ts/**']) },
  ])('names no override matching some file: $how', ({ override }) => {
    expect(oxlintOverridesMatchingNoFile(buildWrittenOxlintConfig([override]))).toStrictEqual([])
  })

  it('reads the overrides of a config the merged one extends as an object', () => {
    const matchingNoFile = buildWrittenOxlintOverride(['lib/a.ts'], ['lib/a.ts'])

    expect(oxlintOverridesMatchingNoFile(buildWrittenOxlintConfig([], [buildWrittenOxlintConfig([matchingNoFile])]))).toStrictEqual([
      JSON.stringify({ files: ['lib/a.ts'], excludeFiles: ['lib/a.ts'] }),
    ])
  })
})
