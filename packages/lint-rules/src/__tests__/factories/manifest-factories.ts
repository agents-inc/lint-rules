import type { LockedWorkspace, Manifest } from '../package-manifests.ts'
import type { ProjectFiles } from '../temp-projects.ts'

const DEFAULT_VERSION = '1.0.0'

/** A package's manifest at version 1.0.0 unless given, listing nothing unless given. */
export function buildManifest(name: string, fields: Omit<Partial<Manifest>, 'name'> = {}): Manifest {
  return { name, version: DEFAULT_VERSION, ...fields }
}

/** The manifest as the package.json of the directory given, the project's root unless given. */
export function manifestFileIn(manifest: Manifest, dir = '.'): ProjectFiles {
  return { [`${dir}/package.json`]: `${JSON.stringify(manifest)}\n` }
}

/** The manifest installed under the node_modules of the directory given, the project's root unless given. */
export function installedManifestFile(manifest: Manifest, underDir = '.'): ProjectFiles {
  return manifestFileIn(manifest, `${underDir}/node_modules/${manifest.name}`)
}

/** A workspace as bun.lock records it, listing nothing unless given. */
export function buildLockedWorkspace(name: string, fields: Omit<Partial<LockedWorkspace>, 'name'> = {}): LockedWorkspace {
  return { name, ...fields }
}
