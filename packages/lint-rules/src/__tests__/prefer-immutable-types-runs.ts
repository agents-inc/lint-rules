import { createHash, randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { createRequire, findPackageJSON, registerHooks } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { catalog, routeOf } from '@workspace/rule-data'
import { foundOr } from '@workspace/rule-data/collections'
import { eslintPlugins } from '@workspace/rule-data/eslint-plugins'
import { ESLint, type Linter } from 'eslint'
import tseslint from 'typescript-eslint'
import { vi } from 'vitest'
import { isRecord } from '../core/is-record.ts'
import { type ParameterSource, parameterImmutabilityMessage } from './cases/pick-parameter-sources.ts'
import { describeFinding, eslintEngineFindingsIn, fatalMessagesIn } from './engine-clis.ts'
import { moduleText } from './factories/check-factories.ts'
import { buildTeamEslintBlock } from './factories/team-config-factories.ts'
import { buildTsconfig } from './factories/tsconfig-factories.ts'
import type { TempProjects } from './temp-projects.ts'

export const FUNCTIONAL = 'functional'
export const PREFER_IMMUTABLE_TYPES = 'prefer-immutable-types'
export const RULE_ID = `${FUNCTIONAL}/${PREFER_IMMUTABLE_TYPES}`
export const READ_ONLY_SHALLOW = 'ReadonlyShallow'
export const IMMUTABLE = 'Immutable'
export const MUTABLE = 'Mutable'

const FUNCTIONAL_PACKAGE = 'eslint-plugin-functional'
const TYPE_IMMUTABILITY_PACKAGE = 'is-immutable-type'
// Applied at install by the root package.json's patchedDependencies; each file's diff names that file's git blob id before it.
const TYPE_IMMUTABILITY_PATCH = new URL('../../../../patches/is-immutable-type@5.0.4.patch', import.meta.url)
// The package's `import` export, which functional loads.
const TYPE_IMMUTABILITY_MODULE = 'dist/index.mjs'
const FILE_DIFF_START = /^diff --git /mu
const HUNK_HEADER = /^@@ .*\n/mu
const BLOB_ID_BEFORE = /^index (?<before>[\da-f]+)\.\./mu
const ADDED = '+'
const REMOVED = '-'
const TYPESCRIPT_EXTENSION = '.ts'

export type NodeEnv = { readonly NODE_ENV: string }

/** functional's plugin, the name of the block running its prefer-immutable-types alone, and NODE_ENV for the run. */
export type PreferImmutableTypesRun = { readonly functional: Readonly<ESLint.Plugin>; readonly blockName: string; readonly nodeEnv: NodeEnv }

type Reported = { readonly at: string; readonly message: string }

export type Linted = { readonly fatal: readonly string[]; readonly reported: readonly Reported[] }

/** As rule-data registers it, which is as npm gives it. */
export function functionalPlugin(): ESLint.Plugin {
  return foundOr(eslintPlugins[FUNCTIONAL], 'rule-data registers no functional plugin')
}

/**
 * functional's plugin loaded afresh, over a copy of its own of is-immutable-type as npm ships it: no answer the
 * library kept for the whole process in another load reaches it, as none reaches a team's next run.
 */
export async function functionalOverTypeImmutabilityAsNpmShipsIt(): Promise<ESLint.Plugin> {
  const functionalEntry = functionalEntryUrl()
  const installedEntry = installedTypeImmutabilityUrl(functionalEntry)
  const load = randomUUID()
  const functionalOfThisLoad = `${functionalEntry}?${load}`
  const typeImmutabilityOfThisLoad = `${moduleDataUrl(typeImmutabilityAsNpmShipsIt(readFileSync(new URL(installedEntry), 'utf8')))}#${load}`
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === TYPE_IMMUTABILITY_PACKAGE && context.parentURL === functionalOfThisLoad) return { url: typeImmutabilityOfThisLoad, format: 'module', shortCircuit: true }
      // A data: URL resolves no package, so the copy's imports resolve as the installed copy's do.
      if (context.parentURL === typeImmutabilityOfThisLoad) return nextResolve(specifier, { ...context, parentURL: installedEntry })
      return nextResolve(specifier, context)
    },
  })
  try {
    // Parse boundary: a JS module, typed as any by import().
    const loaded: unknown = await import(functionalOfThisLoad)
    return pluginExportedBy(loaded)
  } finally {
    hooks.deregister()
  }
}

/** The copy functional loads, which this repo installs patched. */
export function installedTypeImmutability(): string {
  return readFileSync(new URL(installedTypeImmutabilityUrl(functionalEntryUrl())), 'utf8')
}

/** The patched copy with this repo's patch taken back, refused unless it is then the file the patch was made from. */
export function typeImmutabilityAsNpmShipsIt(installed: string): string {
  const fileDiff = fileDiffOf(readFileSync(TYPE_IMMUTABILITY_PATCH, 'utf8'), TYPE_IMMUTABILITY_MODULE)
  const original = hunksOf(fileDiff).reduce(withHunkTakenBack, installed)
  const shipped = blobIdBeforeIn(fileDiff)
  if (gitBlobIdOf(original) !== shipped) throw new Error(`${TYPE_IMMUTABILITY_PACKAGE} with its patch taken back is not the file the patch was made from, blob ${shipped}`)
  return original
}

export function shippedOptions(): readonly unknown[] {
  const { shipped } = routeOf(RULE_ID, catalog)
  if (shipped === null) throw new Error(`${RULE_ID} is not shipped`)
  return shipped.options
}

export function typedProjectOf(tempProjects: TempProjects, sources: readonly ParameterSource[]): string {
  return tempProjects.create({
    files: {
      'tsconfig.json': JSON.stringify(buildTsconfig({ include: ['src'] })),
      ...Object.fromEntries(sources.map(({ file, lines }) => [file, moduleText(...lines)])),
    },
  })
}

export function reportedAlone(at: string, least: string, actual: string): Linted {
  return reportedAtEach([at], least, actual)
}

export function reportedAtEach(ats: readonly string[], least: string, actual: string): Linted {
  return { fatal: [], reported: ats.map((at) => ({ at: `${at} ${RULE_ID}`, message: parameterImmutabilityMessage(least, actual) })) }
}

/**
 * Each TypeScript file of the project linted in this process in turn, in path order. One lintFiles call over them all
 * reads every file at once and lints each as its read ends, so which it lints first would vary from run to run.
 */
export async function lintedBy(run: PreferImmutableTypesRun, projectDir: string, options: readonly unknown[]): Promise<Linted> {
  vi.stubEnv('NODE_ENV', run.nodeEnv.NODE_ENV)
  try {
    const eslint = new ESLint({ cwd: projectDir, overrideConfigFile: true, overrideConfig: typedBlockOf(run, projectDir, options) })
    const results = await lintedInTurn(eslint, typeScriptFilesOf(projectDir))
    return {
      fatal: fatalMessagesIn(results, projectDir),
      reported: eslintEngineFindingsIn(results, projectDir).map((finding) => ({ at: describeFinding(finding), message: finding.message })),
    }
  } finally {
    vi.unstubAllEnvs()
  }
}

/** Relative to the project, in path order. */
function typeScriptFilesOf(projectDir: string): string[] {
  return readdirSync(projectDir, { recursive: true, encoding: 'utf8' })
    .filter((path) => path.endsWith(TYPESCRIPT_EXTENSION))
    .toSorted()
}

/** Each file's lint starts once the lint before it has ended. */
async function lintedInTurn(eslint: Readonly<ESLint>, files: readonly string[]): Promise<readonly ESLint.LintResult[]> {
  return files.reduce<Promise<readonly ESLint.LintResult[]>>(async (lintedBefore, file) => {
    const before = await lintedBefore
    return [...before, ...(await eslint.lintFiles([file]))]
  }, Promise.resolve([]))
}

function typedBlockOf({ functional, blockName }: PreferImmutableTypesRun, projectDir: string, options: readonly unknown[]): Linter.Config {
  return buildTeamEslintBlock(blockName, {
    files: [`**/*${TYPESCRIPT_EXTENSION}`],
    languageOptions: { parser: tseslint.parser, parserOptions: { projectService: true, tsconfigRootDir: projectDir } },
    plugins: { [FUNCTIONAL]: functional },
    rules: { [RULE_ID]: ['error', ...options] },
  })
}

function functionalEntryUrl(): string {
  return pathToFileURL(createRequire(import.meta.url).resolve(FUNCTIONAL_PACKAGE)).href
}

function installedTypeImmutabilityUrl(functionalEntry: string): string {
  const packageJson = findPackageJSON(TYPE_IMMUTABILITY_PACKAGE, functionalEntry)
  if (packageJson === undefined) throw new Error(`${FUNCTIONAL_PACKAGE} finds no ${TYPE_IMMUTABILITY_PACKAGE}`)
  return pathToFileURL(join(dirname(packageJson), TYPE_IMMUTABILITY_MODULE)).href
}

function moduleDataUrl(source: string): string {
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
}

function pluginExportedBy(loaded: unknown): ESLint.Plugin {
  if (!isRecord(loaded) || !isPluginWithRules(loaded.default)) throw new Error(`${FUNCTIONAL_PACKAGE} exports no plugin with rules`)
  return loaded.default
}

function isPluginWithRules(value: unknown): value is ESLint.Plugin {
  return isRecord(value) && isRecord(value.rules)
}

function fileDiffOf(patch: string, file: string): string {
  const fileDiff = patch.split(FILE_DIFF_START).find((diff) => diff.startsWith(`a/${file} b/${file}\n`))
  if (fileDiff === undefined) throw new Error(`the ${TYPE_IMMUTABILITY_PACKAGE} patch changes no ${file}`)
  return fileDiff
}

function blobIdBeforeIn(fileDiff: string): string {
  return foundOr(BLOB_ID_BEFORE.exec(fileDiff)?.groups?.before, `the ${TYPE_IMMUTABILITY_PACKAGE} patch names no blob id for the file before it`)
}

/** Each hunk's lines, each marked by its first character: a space for context, + added by the patch, - removed by it. */
function hunksOf(fileDiff: string): string[][] {
  return fileDiff.split(HUNK_HEADER).slice(1).map((hunk) => hunk.split('\n').slice(0, -1))
}

function withHunkTakenBack(text: string, hunk: readonly string[]): string {
  const around = text.split(textWithout(hunk, REMOVED))
  if (around.length !== 2) throw new Error(`a hunk of the ${TYPE_IMMUTABILITY_PACKAGE} patch is not in the installed copy once`)
  return around.join(textWithout(hunk, ADDED))
}

function textWithout(hunk: readonly string[], mark: string): string {
  return hunk
    .filter((line) => !line.startsWith(mark))
    .map((line) => line.slice(1))
    .join('\n')
}

/** As git names a file's content, and the patch each side of a file. */
function gitBlobIdOf(text: string): string {
  // eslint-disable-next-line sonarjs/hashing -- git names a blob by its SHA-1, which is the id the patch gives each side: no other hash can match it
  return createHash('sha1').update(`blob ${String(Buffer.byteLength(text))}\0`).update(text).digest('hex')
}
