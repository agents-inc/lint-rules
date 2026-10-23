import { join } from 'node:path'
import type { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import { setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'
import { filesEntryAlsoMatching, TS_FILES } from './core/eslint-file-types.ts'

// ESLint documents only globs in a block's `files`, and its types hold no more. Our typed blocks AND a function
// with their globs, which @eslint/config-array, ESLint's matcher, calls with the file's absolute path, so ESLint
// asks as it lints a file whether a tsconfig takes it in. This fails where a later ESLint stops calling the
// function, hands it another form of the path, or stops ANDing it with the globs beside it.

const tempProjects = setUpTempProjects()
const { ruleSeverityInProjectFor } = setUpEslintConfigOracle()

const RULE = 'no-var'
const OTHER_RULE = 'eqeqeq'
const BOTH_MATCH = 'src/kept.ts'
const THE_GLOB_ALONE_MATCHES = 'src/left-out.ts'
const THE_FUNCTION_ALONE_MATCHES = 'src/kept.js'

/** Every JS and TS file gets the other rule; the rule only where both the TS glob and the function keep the file. */
function configKeeping(projectDir: string): Linter.Config[] {
  const kept: ReadonlySet<string> = new Set([BOTH_MATCH, THE_FUNCTION_ALONE_MATCHES].map((file) => join(projectDir, file)))
  return [
    { name: 'every JS and TS file', files: ['**/*.{js,ts}'], rules: { [OTHER_RULE]: 'error' } },
    { name: 'kept by the glob and the function', files: [filesEntryAlsoMatching(TS_FILES, (file) => kept.has(file))], rules: { [RULE]: 'error' } },
  ]
}

describe("ESLint, given a function ANDed with a glob in a block's files", () => {
  it('applies the block to a file both match, the function asked by its absolute path, and to none only one of them matches', async () => {
    const projectDir = tempProjects.create({})
    const config = configKeeping(projectDir)

    expect({
      both: await ruleSeverityInProjectFor(projectDir, config, BOTH_MATCH, RULE),
      theGlobAlone: await ruleSeverityInProjectFor(projectDir, config, THE_GLOB_ALONE_MATCHES, RULE),
      theFunctionAlone: await ruleSeverityInProjectFor(projectDir, config, THE_FUNCTION_ALONE_MATCHES, RULE),
    }).toStrictEqual({ both: 'error', theGlobAlone: undefined, theFunctionAlone: undefined })
  })
})
