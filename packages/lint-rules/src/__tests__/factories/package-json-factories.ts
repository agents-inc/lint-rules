import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PackageJsonFile } from '../../core/package-json-files.ts'
import { INSTALLED_OXLINT, type TempProjects } from '../temp-projects.ts'

export type DependencyField = 'dependencies' | 'devDependencies'

export type PackageJson = {
  readonly name: string
  readonly private: true
  readonly type: 'module'
  readonly dependencies?: Readonly<Record<string, string>>
  readonly devDependencies?: Readonly<Record<string, string>>
}

type LintRulesManifest = { readonly version: string; readonly peerDependencies: Readonly<Record<string, string>> }

/**
* The parts the merge's name check reads: rule keys under `DummyRuleMap.properties`, plugin names in
* `LintPluginOptionsSchema`'s enum. Every other key is carried along unread.
*/
type OxlintSchema = Readonly<Record<string, unknown>> & {
  readonly definitions: Readonly<Record<string, unknown>> & {
    readonly DummyRuleMap: Readonly<Record<string, unknown>> & { readonly properties: Readonly<Record<string, unknown>> }
    readonly LintPluginOptionsSchema: Readonly<Record<string, unknown>> & { readonly enum: readonly string[] }
  }
}

export type NamesLeftOut = { readonly ruleNames: readonly string[]; readonly pluginNames: readonly string[] }

const OXLINT = 'oxlint'
const PROJECT_NAME = 'consumer-project'
const LINT_RULES_MANIFEST = fileURLToPath(new URL('../../../package.json', import.meta.url))
const CARET = '^'
/** Every oxlint release ships it in `files`, beside package.json, not in `exports`. */
export const OXLINT_SCHEMA_FILE = 'configuration_schema.json'
const INSTALLED_OXLINT_DIR = 'node_modules/oxlint'
const ESLINT = 'eslint'
export const INSTALLED_ESLINT_MANIFEST = 'node_modules/eslint/package.json'
export const PACKAGE_JSON_FILE_PATH = '/project/package.json'

export function oxlintPeerRange(): string {
  const range = lintRulesManifest().peerDependencies[OXLINT]
  if (range === undefined) throw new Error('package.json lists no oxlint peer dependency')
  return range
}

/** The version after the caret. */
export function oxlintPeerFloor(): string {
  const range = oxlintPeerRange()
  if (!range.startsWith(CARET)) throw new Error(`the oxlint peer range ${range} is not a caret range`)
  return range.slice(CARET.length)
}

export function lintRulesPackageVersion(): string {
  return lintRulesManifest().version
}

function lintRulesManifest(): LintRulesManifest {
  // Parse boundary: this package's own manifest.
  return JSON.parse(readFileSync(LINT_RULES_MANIFEST, 'utf8')) as LintRulesManifest
}

export function buildPackageJson(fields: Pick<PackageJson, DependencyField> = {}): PackageJson {
  return { name: PROJECT_NAME, private: true, type: 'module', ...fields }
}

export function buildPackageJsonListingOxlint(field: DependencyField = 'devDependencies'): PackageJson {
  const oxlint = { [OXLINT]: oxlintPeerRange() }
  return field === 'dependencies' ? buildPackageJson({ dependencies: oxlint }) : buildPackageJson({ devDependencies: oxlint })
}

/** One that uses oxlint, as our parts read it. */
export function createProjectListingOxlint(tempProjects: TempProjects): string {
  return tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()) } })
}

export function buildPackageJsonListingOthers(): PackageJson {
  return buildPackageJson({ devDependencies: { eslint: '^10.0.0', typescript: '^6.0.0' } })
}

export function packageJsonText(packageJson: PackageJson): string {
  return `${JSON.stringify(packageJson, null, 2)}\n`
}

/**
* A manifest and an entry module, so it resolves either way, and the schema text given beside the manifest
* (none where null): this repo's oxlint's unless given.
*/
export function buildInstalledOxlintFiles(
  version: string,
  schemaText: string | null = installedOxlintSchemaText(),
): Readonly<Record<string, string>> {
  return {
    [`${INSTALLED_OXLINT_DIR}/package.json`]: `${JSON.stringify({
      name: OXLINT,
      version,
      type: 'module',
      main: './dist/index.js',
      exports: { '.': './dist/index.js', './package.json': './package.json' },
    })}\n`,
    [`${INSTALLED_OXLINT_DIR}/dist/index.js`]: 'export {}\n',
    ...(schemaText === null ? {} : { [`${INSTALLED_OXLINT_DIR}/${OXLINT_SCHEMA_FILE}`]: schemaText }),
  }
}

export function installedOxlintSchemaText(): string {
  return readFileSync(join(INSTALLED_OXLINT.dir, OXLINT_SCHEMA_FILE), 'utf8')
}

/** An oxlint that lacks the names given. */
export function installedOxlintSchemaTextLacking({ ruleNames, pluginNames }: NamesLeftOut): string {
  const schema = installedOxlintSchema()
  const { definitions } = schema
  const { DummyRuleMap: ruleMap, LintPluginOptionsSchema: pluginList } = definitions
  const lacking: OxlintSchema = {
    ...schema,
    definitions: {
      ...definitions,
      DummyRuleMap: {
        ...ruleMap,
        properties: Object.fromEntries(Object.entries(ruleMap.properties).filter(([name]) => !ruleNames.includes(name))),
      },
      LintPluginOptionsSchema: { ...pluginList, enum: pluginList.enum.filter((name) => !pluginNames.includes(name)) },
    },
  }
  return `${JSON.stringify(lacking)}\n`
}

/** The installed schema less its rule map or its plugin list. */
export function oxlintSchemaTextWithout(part: 'rule map' | 'plugin list'): string {
  const { definitions, ...rest } = installedOxlintSchema()
  const { DummyRuleMap: ruleMap, LintPluginOptionsSchema: pluginList, ...otherDefinitions } = definitions
  const kept = part === 'rule map' ? { LintPluginOptionsSchema: pluginList } : { DummyRuleMap: ruleMap }
  return `${JSON.stringify({ ...rest, definitions: { ...otherDefinitions, ...kept } })}\n`
}

function installedOxlintSchema(): OxlintSchema {
  // Parse boundary: the schema this repo's oxlint ships.
  return JSON.parse(installedOxlintSchemaText()) as OxlintSchema
}

/** A manifest exported as ESLint 10 exports its own (`./package.json`), and a module exporting nothing. */
export function buildInstalledEslintFiles(version: string): Readonly<Record<string, string>> {
  return {
    [INSTALLED_ESLINT_MANIFEST]: `${JSON.stringify({
      name: ESLINT,
      version,
      type: 'commonjs',
      main: './lib/api.js',
      exports: { '.': './lib/api.js', './package.json': './package.json' },
    })}\n`,
    'node_modules/eslint/lib/api.js': 'module.exports = {}\n',
  }
}

/** A manifest exporting its entry alone, `./index.js`, and that module, exporting nothing. */
export function buildInstalledPackageExportingItsEntryAlone(name: string): Readonly<Record<string, string>> {
  return {
    [`node_modules/${name}/package.json`]: `${JSON.stringify({ name, version: '1.0.0', exports: { '.': './index.js' } })}\n`,
    [`node_modules/${name}/index.js`]: 'module.exports = {}\n',
  }
}

/** A fake install of React: its manifest and a module exporting its version, as eslint-plugin-react's `detect` reads it. */
export function buildInstalledReactFiles(version: string): Readonly<Record<string, string>> {
  return {
    'node_modules/react/package.json': `${JSON.stringify({ name: 'react', version, main: 'index.js' })}\n`,
    'node_modules/react/index.js': `module.exports = { version: '${version}' }\n`,
  }
}

/** As readPackageJsonFile gives a manifest: each field it reads unset unless given. */
export function buildPackageJsonFile(fields: Partial<PackageJsonFile> = {}): PackageJsonFile {
  return { path: PACKAGE_JSON_FILE_PATH, version: undefined, dependencies: undefined, devDependencies: undefined, peerDependencies: undefined, ...fields }
}
