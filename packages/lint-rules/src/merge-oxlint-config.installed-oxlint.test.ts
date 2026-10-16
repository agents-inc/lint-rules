import { realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildConsumerLintRules } from './__tests__/factories/lint-rules-factories.ts'
import {
  buildInstalledOxlintFiles,
  buildPackageJsonListingOthers,
  buildPackageJsonListingOxlint,
  installedOxlintSchemaTextLacking,
  type NamesLeftOut,
  OXLINT_SCHEMA_FILE,
  oxlintSchemaTextWithout,
  oxlintPeerFloor,
  oxlintPeerRange,
  packageJsonText,
} from './__tests__/factories/package-json-factories.ts'
import { buildTeamOxlintConfig } from './__tests__/factories/team-config-factories.ts'
import { NO_TEAM_ESLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { INSTALLED_OXLINT, setUpTempProjects } from './__tests__/temp-projects.ts'
import type { OxlintPart } from './core/editor-parts.ts'
import { defineLintRules } from './index.ts'
import { mergeOxlintConfig } from './oxlint.ts'

// The merged config names rules and plugins from the catalog, and oxlint refuses a name it does not
// know even when it is off. So the oxlint a project installs, whatever its version, must have a
// schema the merge can read, holding every name the merge may write (questions.md #32 Q7, spec C2;
// #56: the owner's answer, no version check).

const THIS_PACKAGE = '@agents-inc/lint-rules'
const NESTED_PACKAGE = 'packages/app'
const INSTALLED_OXLINT_DIR = 'node_modules/oxlint'
const NOT_JSON = '{ "definitions": '

// The floor of our peer range is 1.86.0 (spec D-d): the oxlint differentials pass against oxlint
// 1.86.0 as they do against 1.87. Outside the range: 1.85.x, the minor below it; 2.x, the next
// major, at a minor above the floor's too; and a prerelease, which npm's caret range never holds.
const OXLINT_FLOOR = '1.86.0'
const OXLINT_VERSION_BELOW_THE_RANGE = '1.85.9'
const OXLINT_VERSION_OF_THE_NEXT_MAJOR = '2.0.0'
const OXLINT_VERSION_OF_THE_NEXT_MAJOR_ABOVE_THE_FLOORS_MINOR = '2.99.0'
const OXLINT_PRERELEASE_INSIDE_THE_RANGE = '1.87.0-beta.1'
const OXLINT_VERSION_A_LATER_PATCH = '1.86.9'
const OXLINT_VERSION_INSIDE_THE_RANGE = '1.87.9'
const OXLINT_VERSION_AT_THE_TOP_OF_THE_MAJOR = '1.99.0'

// Names the catalog writes for oxlint, spelled the same in oxlint's schema.
const A_RULE_THE_MERGE_WRITES = 'no-debugger'
const A_PLUGIN_THE_MERGE_WRITES = 'vitest'
const ANOTHER_PLUGIN_THE_MERGE_WRITES = 'jsx-a11y'

const tempProjects = setUpTempProjects()

/** A project listing oxlint, with a fake install of the version given and the schema text given beside it (none where null). */
function projectWithInstalledOxlint(version: string, schemaText?: string | null): string {
  return tempProjects.create({
    files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()), ...buildInstalledOxlintFiles(version, schemaText) },
  })
}

function mergedInto(projectDir: string): () => unknown {
  return () => mergeOxlintConfig(buildTeamOxlintConfig(), oxlintPartOf(projectDir), NO_TEAM_ESLINT_CONFIG)
}

function oxlintPartOf(projectDir: string): OxlintPart | undefined {
  return defineLintRules(buildConsumerLintRules(projectDir, {})).editorRulesets.oxlint
}

/** Where the merge reads the schema: beside the oxlint package.json the project resolves, symlinks resolved. */
function schemaPathIn(projectDir: string): string {
  return join(realpathSync(join(projectDir, INSTALLED_OXLINT_DIR)), OXLINT_SCHEMA_FILE)
}

function lackingNamesError(projectDir: string, version: string, sortedNames: readonly string[]): Error {
  return new Error(
    `oxlint.config.mts: the oxlint installed for ${projectDir} is ${version}, which has no rule or plugin named ${sortedNames.join(', ')}; ${THIS_PACKAGE} writes these names, so oxlint would refuse the merged config: install another oxlint within ${oxlintPeerRange()}`,
  )
}

function unreadableSchemaError(projectDir: string, version: string): Error {
  return new Error(
    `oxlint.config.mts: the oxlint installed for ${projectDir} (${version}) has no rule list ${THIS_PACKAGE} can read at ${schemaPathIn(projectDir)}, so it cannot check that oxlint knows every name the merge writes: install another oxlint within ${oxlintPeerRange()}`,
  )
}

const OUTSIDE_THE_RANGE = [
  { where: 'below the range', version: OXLINT_VERSION_BELOW_THE_RANGE },
  { where: 'in the next major', version: OXLINT_VERSION_OF_THE_NEXT_MAJOR },
  { where: "in the next major, at a minor above the floor's", version: OXLINT_VERSION_OF_THE_NEXT_MAJOR_ABOVE_THE_FLOORS_MINOR },
  { where: 'that is a prerelease of a version inside the range', version: OXLINT_PRERELEASE_INSIDE_THE_RANGE },
]

describe("mergeOxlintConfig, given a project's installed oxlint", () => {
  // #56 (owner): an oxlint outside the range is checked by its own rule list, as one inside it is.
  it.each(OUTSIDE_THE_RANGE)('accepts one $where, $version, whose schema holds every name the merge writes', ({ version }) => {
    expect(mergedInto(projectWithInstalledOxlint(version))).not.toThrow()
  })

  it.each([
    { which: 'the floor of the range', version: oxlintPeerFloor() },
    { which: 'the floor the peer range sets', version: OXLINT_FLOOR },
    { which: 'a later patch inside the range', version: OXLINT_VERSION_A_LATER_PATCH },
    { which: 'a later minor inside the range', version: OXLINT_VERSION_INSIDE_THE_RANGE },
    { which: 'a later minor of the same major', version: OXLINT_VERSION_AT_THE_TOP_OF_THE_MAJOR },
  ])('accepts $which, $version, whose schema holds every name the merge writes', ({ version }) => {
    expect(mergedInto(projectWithInstalledOxlint(version))).not.toThrow()
  })

  // The real install, with the schema it ships: the check must read its names as oxlint does.
  it('accepts the oxlint this repo installs, with the schema it ships', () => {
    const projectDir = tempProjects.create({
      files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()) },
      linkedPackages: [INSTALLED_OXLINT],
    })

    expect(mergedInto(projectDir)).not.toThrow()
  })

  it.each(OUTSIDE_THE_RANGE)('refuses one $where, $version, whose schema lacks a rule the merge writes, naming the rule and the version', ({ version }) => {
    const projectDir = projectWithInstalledOxlint(version, installedOxlintSchemaTextLacking({ ruleNames: [A_RULE_THE_MERGE_WRITES], pluginNames: [] }))

    expect(mergedInto(projectDir)).toThrowError(lackingNamesError(projectDir, version, [A_RULE_THE_MERGE_WRITES]))
  })

  it.each(OUTSIDE_THE_RANGE)('refuses one $where, $version, that ships no schema, naming where it looked', ({ version }) => {
    const projectDir = projectWithInstalledOxlint(version, null)

    expect(mergedInto(projectDir)).toThrowError(unreadableSchemaError(projectDir, version))
  })
})

describe('mergeOxlintConfig, given an installed oxlint inside the range whose schema lacks a name the merge writes', () => {
  const lacking: readonly { readonly what: string; readonly leftOut: NamesLeftOut; readonly named: readonly string[] }[] = [
    { what: 'a rule', leftOut: { ruleNames: [A_RULE_THE_MERGE_WRITES], pluginNames: [] }, named: [A_RULE_THE_MERGE_WRITES] },
    { what: 'a plugin', leftOut: { ruleNames: [], pluginNames: [A_PLUGIN_THE_MERGE_WRITES] }, named: [A_PLUGIN_THE_MERGE_WRITES] },
    {
      what: 'a rule and a plugin',
      leftOut: { ruleNames: [A_RULE_THE_MERGE_WRITES], pluginNames: [ANOTHER_PLUGIN_THE_MERGE_WRITES] },
      named: [ANOTHER_PLUGIN_THE_MERGE_WRITES, A_RULE_THE_MERGE_WRITES],
    },
  ]

  it.each(lacking)('refuses one lacking $what, naming each missing name, sorted', ({ leftOut, named }) => {
    const projectDir = projectWithInstalledOxlint(OXLINT_VERSION_INSIDE_THE_RANGE, installedOxlintSchemaTextLacking(leftOut))

    expect(mergedInto(projectDir)).toThrowError(lackingNamesError(projectDir, OXLINT_VERSION_INSIDE_THE_RANGE, named))
  })

  it('accepts the same version when its schema lacks nothing', () => {
    const projectDir = projectWithInstalledOxlint(
      OXLINT_VERSION_INSIDE_THE_RANGE,
      installedOxlintSchemaTextLacking({ ruleNames: [], pluginNames: [] }),
    )

    expect(mergedInto(projectDir)).not.toThrow()
  })
})

describe('mergeOxlintConfig, given an installed oxlint inside the range whose schema it cannot read', () => {
  const unreadable: readonly { readonly schema: string; readonly schemaText: string | null }[] = [
    { schema: 'missing', schemaText: null },
    { schema: 'not JSON', schemaText: NOT_JSON },
    { schema: 'without a rule map', schemaText: oxlintSchemaTextWithout('rule map') },
    { schema: 'without a plugin list', schemaText: oxlintSchemaTextWithout('plugin list') },
  ]

  it.each(unreadable)('refuses one whose schema is $schema, naming where it looked', ({ schemaText }) => {
    const projectDir = projectWithInstalledOxlint(OXLINT_VERSION_INSIDE_THE_RANGE, schemaText)

    expect(mergedInto(projectDir)).toThrowError(unreadableSchemaError(projectDir, OXLINT_VERSION_INSIDE_THE_RANGE))
  })
})

// Spec C2: the schema is read at most once per process for each installed oxlint path, so a schema
// that changes after the first merge goes unread, while another install's is read for itself.
describe('the name check, over two merges in one process', () => {
  it('reads an install\'s schema once: the second merge accepts it though the schema became unreadable since', () => {
    const projectDir = projectWithInstalledOxlint(OXLINT_VERSION_INSIDE_THE_RANGE)
    const firstMerge = mergedInto(projectDir)
    firstMerge()
    writeFileSync(schemaPathIn(projectDir), NOT_JSON)

    expect(mergedInto(projectDir)).not.toThrow()
  })

  it('reads another install\'s schema for itself, refusing it when unreadable', () => {
    const readable = projectWithInstalledOxlint(OXLINT_VERSION_INSIDE_THE_RANGE)
    const unreadable = projectWithInstalledOxlint(OXLINT_VERSION_INSIDE_THE_RANGE, NOT_JSON)
    mergedInto(readable)()

    expect(mergedInto(unreadable)).toThrowError(unreadableSchemaError(unreadable, OXLINT_VERSION_INSIDE_THE_RANGE))
  })
})

// Spec C1 (#32 D1, #40): only the package.json nearest to tsconfigRootDir says whether a project uses
// oxlint, so a monorepo package whose own package.json lists none has no oxlint part to merge.
describe('mergeOxlintConfig, in a package whose nearest package.json lists no oxlint', () => {
  const monorepoRoot = tempProjects.create({
    files: {
      'package.json': packageJsonText(buildPackageJsonListingOxlint()),
      [`${NESTED_PACKAGE}/package.json`]: packageJsonText(buildPackageJsonListingOthers()),
    },
    linkedPackages: [INSTALLED_OXLINT],
  })

  it('is handed no oxlint part, while the root listing oxlint is handed one', () => {
    expect({
      nestedPackage: oxlintPartOf(join(monorepoRoot, NESTED_PACKAGE)) === undefined,
      root: oxlintPartOf(monorepoRoot) !== undefined,
    }).toStrictEqual({ nestedPackage: true, root: true })
  })

  it("refuses the package's missing part, naming the nearest package.json as the reason", () => {
    expect(mergedInto(join(monorepoRoot, NESTED_PACKAGE))).toThrowError(
      new Error(
        'oxlint.config.mts: the package.json nearest to tsconfigRootDir does not list oxlint under dependencies or devDependencies, so there is no oxlint part to merge',
      ),
    )
  })
})
