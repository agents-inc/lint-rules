import { realpathSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { bunLockText, workspacesInTheBunLockText } from './cases/bun-lock-text.ts'
import { buildLockedWorkspace, buildManifest, installedManifestFile, manifestFileIn } from './factories/manifest-factories.ts'
import {
  dependenciesNotListedBy,
  installedManifestPath,
  listingDisagreements,
  lockDisagreements,
  nodeVersionsAdmittedBy,
  packagesAdmittingLessNodeThan,
  packagesInstalledFor,
  readLockedWorkspaces,
  workspaceDirsOf,
} from './package-manifests.ts'
import { setUpTempProjects } from './temp-projects.ts'

const tempProjects = setUpTempProjects()

const SHARED = 'shared-plugin'
const NESTED_DIR = 'node_modules/needs-another-shared'
const LINKED_SIBLING_DIR = 'packages/a-sibling'

describe('installedManifestPath', () => {
  const projectDir = tempProjects.create({
    files: {
      ...installedManifestFile(buildManifest(SHARED, { version: '1.0.0' })),
      ...installedManifestFile(buildManifest(SHARED, { version: '2.0.0' }), NESTED_DIR),
      ...installedManifestFile(buildManifest('needs-another-shared')),
    },
  })

  it('finds the install in the nearest node_modules, nested before hoisted, by path whatever its exports', () => {
    expect({
      fromTheProject: installedManifestPath(projectDir, SHARED),
      fromTheNestingPackage: installedManifestPath(join(projectDir, NESTED_DIR), SHARED),
    }).toStrictEqual({
      fromTheProject: realpathSync(join(projectDir, 'node_modules', SHARED, 'package.json')),
      fromTheNestingPackage: realpathSync(join(projectDir, NESTED_DIR, 'node_modules', SHARED, 'package.json')),
    })
  })

  it('throws, naming the package, when nothing up from the directory installs it', () => {
    expect(() => installedManifestPath(projectDir, '@nowhere/not-installed')).toThrowError(
      new Error(`@nowhere/not-installed is not installed where ${projectDir} can resolve it`),
    )
  })
})

describe('packagesInstalledFor', () => {
  const projectDir = tempProjects.create({
    files: {
      ...manifestFileIn(
        buildManifest('shipped', {
          dependencies: { 'a-plugin': '1.0.0', 'needs-another-shared': '1.0.0' },
          devDependencies: { 'a-dev-tool': '1.0.0' },
          peerDependencies: { 'a-peer': '^1.0.0' },
        }),
      ),
      ...installedManifestFile(
        buildManifest('a-plugin', {
          dependencies: { [SHARED]: '^1.0.0' },
          devDependencies: { 'a-dev-tool-nobody-installs': '1.0.0' },
          engines: { node: '>=20' },
        }),
      ),
      ...installedManifestFile(buildManifest('needs-another-shared', { dependencies: { [SHARED]: '^2.0.0' } })),
      ...installedManifestFile(
        buildManifest(SHARED, {
          version: '1.0.0',
          dependencies: { 'a-plugin': '^1.0.0' },
          peerDependencies: { 'a-peer-of-a-dependency': '^1.0.0' },
        }),
      ),
      ...installedManifestFile(buildManifest(SHARED, { version: '2.0.0' }), 'node_modules/needs-another-shared'),
      ...installedManifestFile(buildManifest('a-peer', { dependencies: { [SHARED]: '^1.0.0' }, engines: { node: '^22.0.0' } })),
      ...installedManifestFile(buildManifest('a-dev-tool')),
      ...installedManifestFile(buildManifest('a-peer-of-a-dependency')),
    },
  })

  it("lists its dependencies and peers, then their dependencies, each install once through a cycle too, with each one's Node range", () => {
    expect(packagesInstalledFor(projectDir)).toStrictEqual([
      { name: 'a-peer', version: '1.0.0', nodeRange: '^22.0.0' },
      { name: 'a-plugin', version: '1.0.0', nodeRange: '>=20' },
      { name: 'needs-another-shared', version: '1.0.0', nodeRange: null },
      { name: SHARED, version: '1.0.0', nodeRange: null },
      { name: SHARED, version: '2.0.0', nodeRange: null },
    ])
  })

  // As in a bun or npm workspace: the shipped package links a sibling, whose own dependency is
  // installed only in the workspace's node_modules, beside the sibling's real directory.
  it('resolves the dependencies of a linked package from where the link points, as Node does', () => {
    const workspaceDir = tempProjects.create({
      files: {
        ...manifestFileIn(buildManifest('workspace')),
        ...installedManifestFile(buildManifest('hoisted-in-the-workspace')),
        ...manifestFileIn(buildManifest('a-sibling', { dependencies: { 'hoisted-in-the-workspace': '1.0.0' } }), LINKED_SIBLING_DIR),
      },
    })
    const shippedDir = tempProjects.create({
      files: manifestFileIn(buildManifest('shipped', { dependencies: { 'a-sibling': 'workspace:*' } })),
      linkedPackages: [{ name: 'a-sibling', dir: join(workspaceDir, LINKED_SIBLING_DIR) }],
    })

    expect(packagesInstalledFor(shippedDir).map(({ name }) => name)).toStrictEqual(['a-sibling', 'hoisted-in-the-workspace'])
  })
})

describe('packagesAdmittingLessNodeThan', () => {
  const ourRange = '^22.18.0 || >=24'

  it('names a package whose range leaves out a Node ours admits, and not one admitting all of ours or stating none', () => {
    const packages = [
      { name: 'refuses-node-25', version: '1.0.0', nodeRange: '^22.18.0 || ^24.0.0' },
      { name: 'admits-23-too', version: '1.0.0', nodeRange: '^20.19.0 || >=22.13.0' },
      { name: 'the-same-range', version: '1.0.0', nodeRange: ourRange },
      { name: 'states-none', version: '1.0.0', nodeRange: null },
    ]

    expect(packagesAdmittingLessNodeThan(ourRange, packages)).toStrictEqual(['refuses-node-25: ^22.18.0 || ^24.0.0'])
  })
})

describe('nodeVersionsAdmittedBy', () => {
  it('keeps the versions the range admits, in their order', () => {
    expect(nodeVersionsAdmittedBy('^22.18.0 || >=24', ['22.17.1', '22.18.0', '23.0.0', '24.0.0'])).toStrictEqual(['22.18.0', '24.0.0'])
  })
})

describe('dependenciesNotListedBy', () => {
  it('names a dependency of the inlined package the shipped one lists nowhere, and not one it lists under devDependencies', () => {
    const shipped = buildManifest('shipped', { dependencies: { [SHARED]: '1.0.0' }, devDependencies: { 'inlined-sibling': 'workspace:*' } })
    const inlined = buildManifest('inlined', {
      dependencies: { [SHARED]: '1.0.0', 'inlined-sibling': 'workspace:*', 'missing-plugin': '1.0.0' },
      devDependencies: { 'a-dev-tool': '1.0.0' },
    })

    expect(dependenciesNotListedBy(shipped, inlined)).toStrictEqual(['missing-plugin'])
  })
})

describe('listingDisagreements', () => {
  it('names a package both list at different versions, under either field, and not one at the same version or listed by one only', () => {
    const shipped = buildManifest('shipped', {
      dependencies: { [SHARED]: '1.0.0', 'drifted-plugin': '2.0.0', 'shipped-only': '1.0.0' },
      devDependencies: { 'drifted-tool': '3.0.0' },
    })
    const inlined = buildManifest('inlined', {
      dependencies: { [SHARED]: '1.0.0', 'drifted-plugin': '2.0.1', 'inlined-only': '1.0.0' },
      devDependencies: { 'drifted-tool': '3.1.0' },
    })

    expect(listingDisagreements(shipped, inlined)).toStrictEqual([
      { name: 'drifted-plugin', shipped: '2.0.0', inlined: '2.0.1' },
      { name: 'drifted-tool', shipped: '3.0.0', inlined: '3.1.0' },
    ])
  })
})

describe('workspaceDirsOf', () => {
  it("lists the root and each directory its workspaces globs name that holds a package.json, sorted, and no other", () => {
    const rootDir = tempProjects.create({
      files: {
        ...manifestFileIn(buildManifest('a-monorepo', { workspaces: ['packages/*', 'tools/one'] })),
        ...manifestFileIn(buildManifest('b-package'), 'packages/b'),
        ...manifestFileIn(buildManifest('a-package'), 'packages/a'),
        ...manifestFileIn(buildManifest('a-tool'), 'tools/one'),
        ...manifestFileIn(buildManifest('not-a-workspace'), 'tools/two'),
        'packages/no-manifest/README.md': 'no package here\n',
      },
    })

    expect(workspaceDirsOf(rootDir)).toStrictEqual(['', 'packages/a', 'packages/b', 'tools/one'])
  })
})

describe('readLockedWorkspaces', () => {
  it('reads the workspaces of a bun.lock, trailing commas and all', () => {
    const projectDir = tempProjects.create({ files: { 'bun.lock': bunLockText } })

    expect(readLockedWorkspaces(join(projectDir, 'bun.lock'))).toStrictEqual(workspacesInTheBunLockText)
  })

  it('throws, naming the file, for text that is not JSON', () => {
    const projectDir = tempProjects.create({ files: { 'bun.lock': '{ "workspaces": ' } })

    expect(() => readLockedWorkspaces(join(projectDir, 'bun.lock'))).toThrowError(join(projectDir, 'bun.lock'))
  })
})

describe('lockDisagreements', () => {
  const listings = {
    dependencies: { [SHARED]: '1.0.0' },
    devDependencies: { 'a-dev-tool': '1.0.0' },
    peerDependencies: { 'a-peer': '^1.86.0' },
  }

  it('finds none where the lock records every field as the manifest lists it', () => {
    expect(lockDisagreements(buildLockedWorkspace('shipped', listings), buildManifest('shipped', listings))).toStrictEqual([])
  })

  it('names a range the lock records stale, a package it lacks, and one only it records, under each field', () => {
    const locked = buildLockedWorkspace('shipped', {
      dependencies: { [SHARED]: '1.0.0', 'removed-plugin': '1.0.0' },
      devDependencies: {},
      peerDependencies: { 'a-peer': '^1.87.0' },
    })

    expect(lockDisagreements(locked, buildManifest('shipped', listings))).toStrictEqual([
      { field: 'dependencies', name: 'removed-plugin', locked: '1.0.0', listed: null },
      { field: 'devDependencies', name: 'a-dev-tool', locked: null, listed: '1.0.0' },
      { field: 'peerDependencies', name: 'a-peer', locked: '^1.87.0', listed: '^1.86.0' },
    ])
  })
})
