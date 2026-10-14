import { readFile } from 'node:fs/promises'

import { beforeAll, describe, expect, it } from 'vitest'

import { type GeneratedFile, generateFiles } from './run-generate.ts'

const PACKAGE_ROOT = new URL('../../', import.meta.url)
const GENERATED_FILE_PATHS = [
  'src/generated/inventory.json',
  'src/generated/routing.json',
  'src/generated/rule-ids.ts',
  'src/generated/ruleset-names.ts',
]
const GENERATE_TIMEOUT_MS = 120_000

describe('the committed generated files', () => {
  let generatedContentsByPath: ReadonlyMap<string, string>

  beforeAll(async () => {
    const generated: readonly GeneratedFile[] = await generateFiles()
    generatedContentsByPath = new Map(generated.map((file) => [file.path, file.contents]))
  }, GENERATE_TIMEOUT_MS)

  it('are exactly the files the generator produces', () => {
    expect([...generatedContentsByPath.keys()].toSorted()).toStrictEqual(GENERATED_FILE_PATHS)
  })

  it.each(GENERATED_FILE_PATHS)(
    '%s equals what the generator produces now from the installed engines and data/',
    async (path) => {
      const committed = await readFile(new URL(path, PACKAGE_ROOT), 'utf8')

      expect(generatedContentsByPath.get(path)).toStrictEqual(committed)
    },
  )
})
