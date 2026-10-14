import { existsSync, globSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { satisfies, subset } from 'semver'
import ts from 'typescript'

/** The fields of a package.json the manifest checks read. */
export type Manifest = {
  readonly name: string
  readonly version: string
  readonly engines?: { readonly node?: string }
  readonly dependencies?: Readonly<Record<string, string>>
  readonly devDependencies?: Readonly<Record<string, string>>
  readonly peerDependencies?: Readonly<Record<string, string>>
  /** The globs naming a workspace root's packages. */
  readonly workspaces?: readonly string[]
}

/** A package as installed: its name, its version, and the Node versions its engines field admits, null where it states none. */
export type InstalledPackage = { readonly name: string; readonly version: string; readonly nodeRange: string | null }

/** A package two manifests both list, at different versions: the shipped package's and the one its build inlines. */
export type ListingDisagreement = { readonly name: string; readonly shipped: string; readonly inlined: string }

type DependencyField = 'dependencies' | 'devDependencies' | 'peerDependencies'

/** A workspace as bun.lock records it: its name, its version but the root's, and the packages it lists under each dependency field. */
export type LockedWorkspace = Pick<Manifest, 'name' | DependencyField> & Partial<Pick<Manifest, 'version'>>

/** Each workspace bun.lock records, by its directory from the repo root: `''` for the root. */
export type LockedWorkspaces = Readonly<Record<string, LockedWorkspace>>

/** A package a dependency field lists at one version in the manifest and another in the lock, null where one side lists none. */
export type LockDisagreement = {
  readonly field: DependencyField
  readonly name: string
  readonly locked: string | null
  readonly listed: string | null
}

/** bun.lock's top level, as far as the checks read it. */
type BunLock = { readonly workspaces: LockedWorkspaces }

const PACKAGE_JSON = 'package.json'
const NODE_MODULES = 'node_modules'
// The fields that pin the version installed; a peer dependency gives a range the consumer meets.
const LISTING_FIELDS: readonly DependencyField[] = ['dependencies', 'devDependencies']
// Every field bun.lock records for a workspace from its manifest.
const LOCKED_FIELDS: readonly DependencyField[] = ['dependencies', 'devDependencies', 'peerDependencies']
const ROOT_WORKSPACE = ''
const LINE_BREAK = '\n'

/** Parse boundary: a package.json on disk. */
export function readManifest(path: string): Manifest {
  return JSON.parse(readFileSync(path, 'utf8')) as Manifest
}

/**
 * The package.json of the package installed under the name given, as Node finds it from the
 * directory given: in the nearest node_modules holding it, symlinks resolved. Looked up by path,
 * since a package's `exports` may leave its package.json out.
 */
export function installedManifestPath(fromDir: string, name: string): string {
  const manifestPath = nearestInstalledManifestPath(fromDir, name)
  if (manifestPath === null) throw new Error(`${name} is not installed where ${fromDir} can resolve it`)
  return realpathSync(manifestPath)
}

/** In the directory's own node_modules, then each parent's in turn: null once the root lacks it too. */
function nearestInstalledManifestPath(dir: string, name: string): string | null {
  const candidate = join(dir, NODE_MODULES, name, PACKAGE_JSON)
  if (existsSync(candidate)) return candidate
  const parent = dirname(dir)
  return parent === dir ? null : nearestInstalledManifestPath(parent, name)
}

/**
 * Every package installed for the package in the directory given: those it lists under
 * dependencies and peerDependencies, then each one's dependencies in turn, each install once,
 * sorted by name and version. A dependency's own peers and optional dependencies are left out.
 */
export function packagesInstalledFor(packageDir: string): InstalledPackage[] {
  const found = new Map<string, InstalledPackage>()
  const visit = (fromDir: string, names: readonly string[]): void => {
    names.forEach((name) => {
      const manifestPath = installedManifestPath(fromDir, name)
      if (found.has(manifestPath)) return
      const manifest = readManifest(manifestPath)
      found.set(manifestPath, installedPackageOf(manifest))
      visit(dirname(manifestPath), namesListedUnder(manifest, ['dependencies']))
    })
  }
  visit(packageDir, namesListedUnder(readManifest(join(packageDir, PACKAGE_JSON)), ['dependencies', 'peerDependencies']))
  return [...found.values()].toSorted((first, second) => first.name.localeCompare(second.name) || first.version.localeCompare(second.version))
}

/**
 * Each package whose engines field leaves out a Node version the range given admits, as
 * `name: its engines.node range`. A package stating no Node range admits every Node.
 */
export function packagesAdmittingLessNodeThan(nodeRange: string, packages: readonly InstalledPackage[]): string[] {
  return packages.flatMap(({ name, nodeRange: theirs }) => (theirs === null || subset(nodeRange, theirs) ? [] : [`${name}: ${theirs}`]))
}

/** The Node versions given that the range admits, in their order. */
export function nodeVersionsAdmittedBy(nodeRange: string, versions: readonly string[]): string[] {
  return versions.filter((version) => satisfies(version, nodeRange))
}

/** Each package the inlined package depends on that the shipped package lists under neither dependencies nor devDependencies. */
export function dependenciesNotListedBy(shipped: Manifest, inlined: Manifest): string[] {
  const listed = listingsOf(shipped)
  return namesListedUnder(inlined, ['dependencies']).filter((name) => !listed.has(name))
}

/** Each package both manifests list under dependencies or devDependencies, at a version they disagree on. */
export function listingDisagreements(shipped: Manifest, inlined: Manifest): ListingDisagreement[] {
  const shippedListings = listingsOf(shipped)
  return [...listingsOf(inlined)].flatMap(([name, inlinedVersion]) => {
    const shippedVersion = shippedListings.get(name)
    return shippedVersion === undefined || shippedVersion === inlinedVersion ? [] : [{ name, shipped: shippedVersion, inlined: inlinedVersion }]
  })
}

/** Every package listed under dependencies or devDependencies, by name, with the version it is listed at. */
function listingsOf(manifest: Manifest): ReadonlyMap<string, string> {
  return new Map(LISTING_FIELDS.flatMap((field) => Object.entries(listedUnder(manifest, field))))
}

function namesListedUnder(manifest: Manifest, fields: readonly DependencyField[]): string[] {
  return fields.flatMap((field) => Object.keys(listedUnder(manifest, field)))
}

/** A dependency field a package.json or a lock entry may leave out, which then lists nothing. */
function listedUnder(manifest: Pick<Manifest, DependencyField>, field: DependencyField): Readonly<Record<string, string>> {
  const listed = manifest[field]
  return listed === undefined ? {} : listed
}

/**
 * Each workspace of a bun workspace root, by its directory from the root, sorted: `''` for the root
 * itself, and each directory holding a package.json that its `workspaces` globs name.
 */
export function workspaceDirsOf(rootDir: string): string[] {
  const { workspaces = [] } = readManifest(join(rootDir, PACKAGE_JSON))
  const packageDirs = workspaces.flatMap((glob) => globSync(join(glob, PACKAGE_JSON), { cwd: rootDir }).map(dirname))
  return [ROOT_WORKSPACE, ...packageDirs].toSorted()
}

/** Parse boundary: bun.lock, JSON with trailing commas, read by TypeScript's JSON reader, which takes them. */
export function readLockedWorkspaces(lockPath: string): LockedWorkspaces {
  const { config, error } = ts.parseConfigFileTextToJson(lockPath, readFileSync(lockPath, 'utf8'))
  if (error !== undefined) throw new Error(`${lockPath}: ${ts.flattenDiagnosticMessageText(error.messageText, LINE_BREAK)}`)
  const { workspaces } = config as BunLock
  return workspaces
}

/**
 * Each package a dependency field of the workspace's manifest lists otherwise than bun.lock records
 * it: at another version or range, or on one side only. bun 1.2.6's frozen install accepts such a
 * lock and leaves it as it is, so nothing else notices.
 */
export function lockDisagreements(locked: LockedWorkspace, manifest: Manifest): LockDisagreement[] {
  return LOCKED_FIELDS.flatMap((field) => disagreementsUnder(field, listedUnder(locked, field), listedUnder(manifest, field)))
}

function disagreementsUnder(
  field: DependencyField,
  locked: Readonly<Record<string, string>>,
  listed: Readonly<Record<string, string>>,
): LockDisagreement[] {
  const names = [...new Set([...Object.keys(locked), ...Object.keys(listed)])].toSorted()
  return names.flatMap((name) => {
    const lockedVersion = versionOrNull(locked, name)
    const listedVersion = versionOrNull(listed, name)
    return lockedVersion === listedVersion ? [] : [{ field, name, locked: lockedVersion, listed: listedVersion }]
  })
}

/** The version a field lists the package at: null where it lists no such package. */
function versionOrNull(listed: Readonly<Record<string, string>>, name: string): string | null {
  const version = listed[name]
  return version === undefined ? null : version
}

function installedPackageOf({ name, version, engines }: Manifest): InstalledPackage {
  const nodeRange = engines?.node
  return { name, version, nodeRange: nodeRange === undefined ? null : nodeRange }
}
