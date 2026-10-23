import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { setUpTempProjects } from '../../__tests__/temp-projects.ts'
import { packageManagerOf } from './package-manager.ts'

const tempProjects = setUpTempProjects()

const BUN_LOCK = 'bun.lock'
const PNPM_LOCK = 'pnpm-lock.yaml'
const YARN_LOCK = 'yarn.lock'
const NPM_LOCK = 'package-lock.json'
const PACKAGES = 'packages'
const PACKAGE = join(PACKAGES, 'app')
const SOURCE_FILE = join(PACKAGE, 'index.ts')

const BUN = { install: 'bun install', runner: 'bun run' }
const PNPM = { install: 'pnpm install', runner: 'pnpm exec' }
const YARN = { install: 'yarn install', runner: 'yarn' }
const NPM = { install: 'npm install', runner: 'npx --no' }

/** The package's folder, then each above it up to the repo's. */
function foldersOfARepoWith(lockfiles: readonly string[]): string[] {
  const topLevel = tempProjects.create({ files: { [SOURCE_FILE]: '', ...Object.fromEntries(lockfiles.map((lockfile): [string, string] => [lockfile, ''])) } })
  return [join(topLevel, PACKAGE), join(topLevel, PACKAGES), topLevel]
}

describe('the package manager init names', () => {
  it("is the one whose lockfile is in the nearest folder holding one, beside another's in a folder above", () => {
    expect(packageManagerOf(foldersOfARepoWith([join(PACKAGES, PNPM_LOCK), BUN_LOCK]))).toStrictEqual(PNPM)
  })

  it('is the first of bun, pnpm, yarn and npm whose lockfile a folder holds, where it holds two', () => {
    expect([[NPM_LOCK, YARN_LOCK], [PNPM_LOCK, BUN_LOCK]].map((lockfiles) => packageManagerOf(foldersOfARepoWith(lockfiles)))).toStrictEqual([YARN, BUN])
  })

  it('is npm where no folder holds a lockfile', () => {
    expect(packageManagerOf(foldersOfARepoWith([]))).toStrictEqual(NPM)
  })
})
