import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll } from 'vitest'

/** File contents by path relative to the project. */
export type ProjectFiles = Readonly<Record<string, string>>

/** A package installed into a project by a link: its name under node_modules and the directory it points to. */
export type LinkedPackage = { readonly name: string; readonly dir: string }

export type TempProject = {
  /** Copied from, when the project starts as a fixture directory. */
  readonly fixturesDir?: string
  readonly files?: ProjectFiles
  readonly linkedPackages?: readonly LinkedPackage[]
}

export type TempProjects = {
  /** A new project directory, holding the fixtures and then the files, and resolving each linked package. */
  readonly create: (project: TempProject) => string
}

const EMPTY_FOLDER_PREFIX = 'lint-rules-empty-'
const TEMP_DIR_PREFIX = 'lint-rules-project-'
const PROJECT_DIR_NAME = 'project'
const NODE_MODULES = 'node_modules'

/**
 * Whether the directory is a project setUpTempProjects made: `project`, in a folder of its own under
 * the temp dir. Not the temp dir, nor a shared folder in it, which a write would leave for every
 * later spec of the test file.
 */
export function isATempProject(dir: string): boolean {
  const root = dirname(dir)
  return basename(dir) === PROJECT_DIR_NAME && basename(root).startsWith(TEMP_DIR_PREFIX) && dirname(root) === tmpdir()
}

/** A package as this repo installs it, to link into a project that must resolve it. */
export function installedPackage(name: string): LinkedPackage {
  return { name, dir: dirname(createRequire(import.meta.url).resolve(`${name}/package.json`)) }
}

/** The oxlint this repo installs, at the version the package was generated against. */
export const INSTALLED_OXLINT = installedPackage('oxlint')

/** This package, as a consumer installs it: its package.json `exports` lead to `dist`. */
export const THIS_PACKAGE: LinkedPackage = {
  name: '@agents-inc/lint-rules',
  dir: fileURLToPath(new URL('../..', import.meta.url)),
}

/** The build output of this package, which `turbo test` builds first. */
export const BUILT_DIST_DIR = join(THIS_PACKAGE.dir, 'dist')

/** A consumer's install: this package, and the oxlint it runs. */
export const CONSUMER_INSTALL: readonly LinkedPackage[] = [THIS_PACKAGE, INSTALLED_OXLINT]

/**
 * Temp projects, removed after the suite, or with the test file's temp dir where the suite never
 * runs (temp-dir-per-test-file.ts). A project sits one level below a root whose node_modules
 * holds the linked packages: Node and the engines resolve them by walking up, while neither engine,
 * linting the project, walks into them. Call it at the top of a test file or a describe block: it
 * registers that scope's cleanup.
 */
export function setUpTempProjects(): TempProjects {
  const roots: string[] = []

  afterAll(() => {
    roots.forEach((root) => rmSync(root, { recursive: true, force: true }))
  })

  return {
    create: ({ fixturesDir, files = {}, linkedPackages = [] }) => {
      const root = mkdtempSync(join(tmpdir(), TEMP_DIR_PREFIX))
      roots.push(root)
      const projectDir = join(root, PROJECT_DIR_NAME)
      mkdirSync(projectDir)
      if (fixturesDir !== undefined) cpSync(fixturesDir, projectDir, { recursive: true })
      Object.entries(files).forEach(([file, content]) => writeFileCreatingItsDir(join(projectDir, file), content))
      linkedPackages.forEach((linked) => linkPackage(join(root, NODE_MODULES, linked.name), linked.dir))
      return projectDir
    },
  }
}

/**
 * Empty folders, removed after the suite, for a run to point HOME, XDG_STATE_HOME or TMPDIR at:
 * anything the run writes outside the project shows up in one. Call it at the top of a test file or
 * a describe block: it registers that scope's cleanup.
 */
export function setUpEmptyFolders(): () => string {
  const made: string[] = []
  afterAll(() => {
    made.forEach((folder) => rmSync(folder, { recursive: true, force: true }))
  })
  return () => {
    const folder = realpathSync(mkdtempSync(join(tmpdir(), EMPTY_FOLDER_PREFIX)))
    made.push(folder)
    return folder
  }
}

/** Every entry under the folder, by its path relative to it, sorted. */
export function entriesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' }).toSorted()
}

/** The files given, by their path in the folder, as they are now. */
export function textsOf(dir: string, files: readonly string[]): Record<string, string> {
  return Object.fromEntries(files.map((file) => [file, readFileSync(join(dir, file), 'utf8')]))
}

/** Writes the file, making the folders above it first where they are missing. */
export function writeFileCreatingItsDir(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

function linkPackage(linkPath: string, target: string): void {
  mkdirSync(dirname(linkPath), { recursive: true })
  symlinkSync(target, linkPath, 'dir')
}
