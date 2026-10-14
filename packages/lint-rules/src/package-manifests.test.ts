import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  dependenciesNotListedBy,
  installedManifestPath,
  listingDisagreements,
  type LockedWorkspace,
  lockDisagreements,
  type Manifest,
  nodeVersionsAdmittedBy,
  packagesAdmittingLessNodeThan,
  packagesInstalledFor,
  readLockedWorkspaces,
  readManifest,
  workspaceDirsOf,
} from './__tests__/package-manifests.ts'

// The manifest this package ships with, against what it installs, what its build inlines, and what
// the repo's bun.lock records of it.

function devDependencyNamesOf({ name, devDependencies }: Manifest): string[] {
  if (devDependencies === undefined) throw new Error(`${name}'s package.json lists no devDependencies`)
  return Object.keys(devDependencies)
}

const PACKAGE_DIR = fileURLToPath(new URL('..', import.meta.url))
const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const LOCKED_WORKSPACES = readLockedWorkspaces(join(REPO_ROOT, 'bun.lock'))
const WORKSPACE_DIRS = workspaceDirsOf(REPO_ROOT)
const SHIPPED = readManifest(join(PACKAGE_DIR, 'package.json'))
// tsdown inlines every @workspace package (tsdown.config.ts, deps.alwaysBundle), so the shipped
// manifest lists their dependencies itself, at the versions they were built and generated against.
const WORKSPACE_SCOPE = '@workspace/'
const INLINED: readonly Manifest[] = devDependencyNamesOf(SHIPPED)
  .filter((name) => name.startsWith(WORKSPACE_SCOPE))
  .map((name) => readManifest(installedManifestPath(PACKAGE_DIR, name)))

// Node versions at the edges of the decided engines range (decision D8, `^22.18.0 || >=24`): 22.18
// is the first Node 22 that loads agents-inc.lint.mts without a flag, and ESLint 10 admits no Node 23.
const NODE_VERSIONS = ['20.19.0', '22.17.1', '22.18.0', '22.23.0', '23.0.0', '23.11.1', '24.0.0', '26.0.0']
const NODE_VERSIONS_ADMITTED = ['22.18.0', '22.23.0', '24.0.0', '26.0.0']
// jsdoc-type-pratt-parser 9.x, which eslint-plugin-regexp 3.3.1 depends on (^9.0.0), admits Node
// 22.22.2 up and 24.15.0 up only; every 9.x release states the same range.
const KNOWN_GAP_NODE_RANGE = 'jsdoc-type-pratt-parser: ^22.22.2 || >=24.15.0'

function nodeRangeShipped(): string {
  const nodeRange = SHIPPED.engines?.node
  if (nodeRange === undefined) throw new Error(`${SHIPPED.name}'s package.json states no engines.node`)
  return nodeRange
}

describe('the Node versions @agents-inc/lint-rules admits, by its engines field', () => {
  let admittingLess: readonly string[] | undefined

  // Worked out before the tests, so a walk or a range that fails fails the file: inside it.fails it
  // would pass as the failure expected.
  beforeAll(() => {
    admittingLess = packagesAdmittingLessNodeThan(nodeRangeShipped(), packagesInstalledFor(PACKAGE_DIR))
  })

  function packagesAdmittingLessNode(): readonly string[] {
    if (admittingLess === undefined) throw new Error('the installed packages were read outside the suite that walked them')
    return admittingLess
  }

  it('are Node 22 from 22.18.0 and every Node from 24: no Node 23, which ESLint 10 refuses', () => {
    expect(nodeVersionsAdmittedBy(nodeRangeShipped(), NODE_VERSIONS)).toStrictEqual(NODE_VERSIONS_ADMITTED)
  })

  // KNOWN GAP: jsdoc-type-pratt-parser alone still refuses part of the range, so npm warns
  // EBADENGINE on Node 22.18 to 22.22.1 and 24.0 to 24.14 (an owner question: narrow the range,
  // or keep it). The strict claim is the it.fails below; this pins the gap to that one package.
  it('lie within the engines range of each package installed for it, but one', () => {
    expect(packagesAdmittingLessNode()).toStrictEqual([KNOWN_GAP_NODE_RANGE])
  })

  it.fails('lie within the engines range of each package installed for it', () => {
    expect(packagesAdmittingLessNode()).toStrictEqual([])
  })
})

describe.each(INLINED.map((manifest) => ({ manifest, name: manifest.name })))(
  'the packages @agents-inc/lint-rules lists, beside $name, which its build inlines',
  ({ manifest }) => {
    it('include every package it depends on', () => {
      expect(dependenciesNotListedBy(SHIPPED, manifest)).toStrictEqual([])
    })

    it('give each package both list the version it lists', () => {
      expect(listingDisagreements(SHIPPED, manifest)).toStrictEqual([])
    })
  },
)

describe('the workspace packages the build inlines', () => {
  it('are each @workspace package the shipped manifest lists', () => {
    expect(INLINED.map(({ name }) => name)).toStrictEqual([
      '@workspace/eslint-plugin-house',
      '@workspace/rule-data',
      '@workspace/typescript-config',
    ])
  })
})

function lockedWorkspaceAt(dir: string): LockedWorkspace {
  const locked = LOCKED_WORKSPACES[dir]
  if (locked === undefined) throw new Error(`bun.lock records no workspace at "${dir}"`)
  return locked
}

// bun 1.2.6's frozen install accepts a lock that misdescribes a workspace's manifest, exits 0 and
// leaves the lock as it is (measured: the oxlint peer range raised in package.json alone), so
// nothing else notices a stale line.
describe("the repo's bun.lock", () => {
  it('records each workspace of the repo, and no other', () => {
    expect(Object.keys(LOCKED_WORKSPACES).toSorted()).toStrictEqual(WORKSPACE_DIRS)
  })

  it.each(WORKSPACE_DIRS.map((dir) => ({ dir, workspace: dir === '' ? 'the root' : dir })))(
    'records the packages $workspace lists, under each dependency field, as its package.json lists them',
    ({ dir }) => {
      expect(lockDisagreements(lockedWorkspaceAt(dir), readManifest(join(REPO_ROOT, dir, 'package.json')))).toStrictEqual([])
    },
  )
})
