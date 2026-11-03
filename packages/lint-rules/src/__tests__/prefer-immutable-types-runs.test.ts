import { promises } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import type { ESLint } from 'eslint'
import { describe, expect, it, type MockInstance, vi } from 'vitest'
import { A_READONLY_PICK, B_MUTABLE_PICK, NODE_ENV_OUTSIDE_TESTS } from './cases/pick-parameter-sources.ts'
import { lintedBy, PREFER_IMMUTABLE_TYPES, typedProjectOf } from './prefer-immutable-types-runs.ts'
import { setUpTempProjects } from './temp-projects.ts'

// Long beside reading a file of a few lines: where both files' reads start at once, the other one's ends first.
const HELD_BACK_MS = 500

/** A stand-in for functional's plugin: its prefer-immutable-types reports nothing and hands on each file it is run on. */
function pluginHandingOnEachFileLinted(linted: (file: string) => void): ESLint.Plugin {
  return {
    rules: {
      [PREFER_IMMUTABLE_TYPES]: {
        meta: { type: 'problem', schema: [] },
        create(context) {
          linted(context.filename)
          return {}
        },
      },
    },
  }
}

/** ESLint reads each file it lints through fs.promises.readFile. */
function holdingBackTheReadOf(file: string): MockInstance<typeof promises.readFile> {
  return vi.spyOn(promises, 'readFile').mockImplementation(async (path, options) => {
    if (typeof path === 'string' && path.endsWith(file)) await delay(HELD_BACK_MS)
    return readFile(path, options)
  })
}

describe('lintedBy', () => {
  const tempProjects = setUpTempProjects()

  it("lints the project's files in turn in path order, where the first file's read ends after the second's", async () => {
    const linted = vi.fn<(file: string) => void>()
    const projectDir = typedProjectOf(tempProjects, [A_READONLY_PICK, B_MUTABLE_PICK])
    const readHeldBack = holdingBackTheReadOf(A_READONLY_PICK.file)
    try {
      await lintedBy({ functional: pluginHandingOnEachFileLinted(linted), blockName: 'a stand-in handing on each file linted', nodeEnv: NODE_ENV_OUTSIDE_TESTS }, projectDir, [])
    } finally {
      readHeldBack.mockRestore()
    }

    expect(linted.mock.calls).toStrictEqual([[join(projectDir, A_READONLY_PICK.file)], [join(projectDir, B_MUTABLE_PICK.file)]])
  })
})
