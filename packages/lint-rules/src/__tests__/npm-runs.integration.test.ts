import { existsSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { jsonFileText } from './factories/team-config-file-factories.ts'
import { npmInstallIn, tarballPackedFrom } from './npm-runs.ts'
import { setUpRunsBeforeTheSuite } from './runs-before-the-suite.ts'
import type { ProjectFiles } from './temp-projects.ts'

// `npm publish --dry-run` runs prepublishOnly, and so this suite, with this variable set; under it npm pack writes
// no tarball and npm install installs nothing, each exiting 0 (measured, npm 10.9.2).
const DRY_RUN_VARIABLE = 'npm_config_dry_run'
const SET_BY_PUBLISH_DRY_RUN = 'true'
const PACKED_NAME = 'packed-by-the-suite'
const PACKED_VERSION = '1.0.0'
const INSTALLED_MANIFEST = join('node_modules', PACKED_NAME, 'package.json')

function packageToPack(): ProjectFiles {
  return { 'package.json': jsonFileText({ name: PACKED_NAME, version: PACKED_VERSION }) }
}

function projectInstalling(tarball: string): ProjectFiles {
  return { 'package.json': jsonFileText({ name: 'installing-the-packed-tarball', private: true, devDependencies: { [PACKED_NAME]: `file:${tarball}` } }) }
}

describe('npm, run as the packed-install suite runs it, under the variable `npm publish --dry-run` hands prepublishOnly', () => {
  const runs = setUpRunsBeforeTheSuite((tempProjects) => {
    const packageDir = tempProjects.create({ files: packageToPack() })
    // Packed with the variable unset, so the install has a tarball to read whatever the pack under it writes.
    const tarballToInstall = tarballPackedFrom(packageDir, tempProjects.create({}))
    vi.stubEnv(DRY_RUN_VARIABLE, SET_BY_PUBLISH_DRY_RUN)
    try {
      const destination = tempProjects.create({})
      const tarball = tarballPackedFrom(packageDir, destination)
      const projectDir = tempProjects.create({ files: projectInstalling(tarballToInstall) })
      return { destination, tarball, projectDir, install: npmInstallIn(projectDir) }
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('packs the tarball it names into the destination', () => {
    const { destination, tarball } = runs()

    expect(readdirSync(destination)).toStrictEqual([basename(tarball)])
  })

  it('installs a tarball into the project, exiting 0', () => {
    const { projectDir, install } = runs()

    expect({ exitCode: install.exitCode, installed: existsSync(join(projectDir, INSTALLED_MANIFEST)) }).toStrictEqual({ exitCode: 0, installed: true })
  })
})
