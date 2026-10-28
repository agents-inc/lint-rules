import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONFIG_FILE, PACKAGE_JSON_FILE } from '../../__tests__/factories/check-factories.ts'
import { CONFIG_INIT_WRITES, PACKAGE_JSON_BEFORE_INIT, PACKAGE_JSON_LEFT_MID_MERGE } from '../../__tests__/factories/init-factories.ts'
import { setUpTempProjects, textsOf } from '../../__tests__/temp-projects.ts'
import { EXIT_FINDINGS } from '../exit-codes.ts'
import { initIn } from './run-init.ts'

// init reads package.json before it looks for the config, so a package.json it cannot read refuses the run
// whether or not the config is there.

const tempProjects = setUpTempProjects()

const BOTH_FILES = [PACKAGE_JSON_FILE, CONFIG_FILE]

describe('init where agents-inc.lint.mts already exists', () => {
  it('refuses, naming package.json, where package.json is not valid JSON, and changes neither file', () => {
    const dir = tempProjects.create({ files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_LEFT_MID_MERGE, [CONFIG_FILE]: CONFIG_INIT_WRITES } })

    expect(() => initIn(dir, new AbortController().signal)).toThrow(new Error(`${join(dir, PACKAGE_JSON_FILE)}: not valid JSON`))
    expect(textsOf(dir, BOTH_FILES)).toStrictEqual({ [PACKAGE_JSON_FILE]: PACKAGE_JSON_LEFT_MID_MERGE, [CONFIG_FILE]: CONFIG_INIT_WRITES })
  })

  it('says the config exists, exiting 1, and changes neither file where package.json is valid, beside that one', () => {
    const dir = tempProjects.create({ files: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_BEFORE_INIT, [CONFIG_FILE]: CONFIG_INIT_WRITES } })

    expect({ outcome: initIn(dir, new AbortController().signal), texts: textsOf(dir, BOTH_FILES) }).toStrictEqual({
      outcome: { stdout: '', stderr: `init: ${CONFIG_FILE} already exists in ${dir}; nothing was changed. Delete it to start again.\n`, exitCode: EXIT_FINDINGS },
      texts: { [PACKAGE_JSON_FILE]: PACKAGE_JSON_BEFORE_INIT, [CONFIG_FILE]: CONFIG_INIT_WRITES },
    })
  })
})
