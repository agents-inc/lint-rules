import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { PackageManagerCommands } from './texts.ts'

type Lockfile = { readonly name: string; readonly commands: PackageManagerCommands }

const BUN: PackageManagerCommands = { install: 'bun install', runner: 'bunx' }
const PNPM: PackageManagerCommands = { install: 'pnpm install', runner: 'pnpm exec' }
const YARN: PackageManagerCommands = { install: 'yarn install', runner: 'yarn' }
const NPM: PackageManagerCommands = { install: 'npm install', runner: 'npx' }

// In one folder, the first of these that is there names the package manager.
const LOCKFILES: readonly Lockfile[] = [
  { name: 'bun.lock', commands: BUN },
  { name: 'bun.lockb', commands: BUN },
  { name: 'pnpm-lock.yaml', commands: PNPM },
  { name: 'yarn.lock', commands: YARN },
  { name: 'package-lock.json', commands: NPM },
]

/** The nearest folder's lockfile decides; npm where none does. */
export function packageManagerOf(folders: readonly string[]): PackageManagerCommands {
  const nearest = folders.flatMap(lockfilesIn).at(0)
  return nearest === undefined ? NPM : nearest.commands
}

function lockfilesIn(folder: string): Lockfile[] {
  return LOCKFILES.filter(({ name }) => existsSync(join(folder, name)))
}
