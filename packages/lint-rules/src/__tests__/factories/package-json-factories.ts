import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { INSTALLED_OXLINT } from '../temp-projects.ts'

/** The fields of a project's package.json that say which packages it uses. */
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
 * The parts of oxlint's configuration_schema.json the merge's name check reads: rule keys under
 * `DummyRuleMap.properties`, plugin names in the enum of `LintPluginOptionsSchema`. Every other key
 * is carried along unread.
 */
type OxlintSchema = Readonly<Record<string, unknown>> & {
  readonly definitions: Readonly<Record<string, unknown>> & {
    readonly DummyRuleMap: Readonly<Record<string, unknown>> & { readonly properties: Readonly<Record<string, unknown>> }
    readonly LintPluginOptionsSchema: Readonly<Record<string, unknown>> & { readonly enum: readonly string[] }
  }
}

/** The rule and plugin names a fake install's schema leaves out of the installed one's. */
export type NamesLeftOut = { readonly ruleNames: readonly string[]; readonly pluginNames: readonly string[] }

const OXLINT = 'oxlint'
const PROJECT_NAME = 'consumer-project'
const LINT_RULES_MANIFEST = fileURLToPath(new URL('../../../package.json', import.meta.url))
const CARET = '^'
/** Where every oxlint release ships its schema: in its package's `files`, beside its package.json, not in `exports`. */
export const OXLINT_SCHEMA_FILE = 'configuration_schema.json'
const INSTALLED_OXLINT_DIR = 'node_modules/oxlint'

/** The oxlint versions this package supports, as its package.json gives them to npm. */
export function oxlintPeerRange(): string {
  const range = lintRulesManifest().peerDependencies[OXLINT]
  if (range === undefined) throw new Error('package.json lists no oxlint peer dependency')
  return range
}

/** The lowest oxlint the caret peer range admits: the version after its caret. */
export function oxlintPeerFloor(): string {
  const range = oxlintPeerRange()
  if (!range.startsWith(CARET)) throw new Error(`the oxlint peer range ${range} is not a caret range`)
  return range.slice(CARET.length)
}

/** This package's version, as its package.json gives it to npm. */
export function lintRulesPackageVersion(): string {
  return lintRulesManifest().version
}

function lintRulesManifest(): LintRulesManifest {
  // Parse boundary: this package's own manifest.
  return JSON.parse(readFileSync(LINT_RULES_MANIFEST, 'utf8')) as LintRulesManifest
}

/** A project's package.json listing no dependency unless given. */
export function buildPackageJson(fields: Pick<PackageJson, DependencyField> = {}): PackageJson {
  return { name: PROJECT_NAME, private: true, type: 'module', ...fields }
}

/** A project that uses oxlint, listed under the field given. */
export function buildPackageJsonListingOxlint(field: DependencyField = 'devDependencies'): PackageJson {
  const oxlint = { [OXLINT]: oxlintPeerRange() }
  return field === 'dependencies' ? buildPackageJson({ dependencies: oxlint }) : buildPackageJson({ devDependencies: oxlint })
}

/** A project that lists packages, none of them oxlint. */
export function buildPackageJsonListingOthers(): PackageJson {
  return buildPackageJson({ devDependencies: { eslint: '^10.0.0', typescript: '^6.0.0' } })
}

export function packageJsonText(packageJson: PackageJson): string {
  return `${JSON.stringify(packageJson, null, 2)}\n`
}

/**
 * An oxlint install of the given version, as files under the project's node_modules: its manifest
 * and an entry module, so it resolves whether it is looked up by its manifest or its entry, and the
 * schema text given beside the manifest (none where null). The schema is the one this repo's oxlint
 * ships unless given.
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

/** The schema this repo's oxlint ships, as its text. */
export function installedOxlintSchemaText(): string {
  return readFileSync(join(INSTALLED_OXLINT.dir, OXLINT_SCHEMA_FILE), 'utf8')
}

/** The schema this repo's oxlint ships, less the rule and plugin names given: an oxlint that lacks them. */
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

/** A schema of another shape than the merge reads: the installed one's, less its rule map or its plugin list. */
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
