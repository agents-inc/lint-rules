import { describe, expect, it } from 'vitest'
import { buildEveryRulesetLintRules } from './__tests__/factories/lint-rules-factories.ts'
import {
  buildPackageJsonListingOthers,
  buildPackageJsonListingOxlint,
  packageJsonText,
} from './__tests__/factories/package-json-factories.ts'
import { pathsOfFunctionsIn } from './__tests__/functions-in.ts'
import { setUpTempProjects } from './__tests__/temp-projects.ts'
import { defineLintRules } from './index.ts'

// Owner, 2026-10-11: agents-inc.lint.mts ends with `export const { eslint, oxlint } = config.editorRulesets`.
// The parts are plain data, so importing the file costs only the catalog: plugins, the parser and
// the rest of ESLint's side load only when a team's ESLint config imports the merge.

const EDITOR_PART_KEYS = ['eslint', 'oxlint']

const tempProjects = setUpTempProjects()
const PROJECT_WITH_OXLINT = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()) } })
const PROJECT_WITHOUT_OXLINT = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOthers()) } })

const PROJECTS = [
  { project: 'whose package.json lists oxlint', projectDir: PROJECT_WITH_OXLINT, partTypes: { eslint: 'object', oxlint: 'object' } },
  { project: 'whose package.json lists no oxlint', projectDir: PROJECT_WITHOUT_OXLINT, partTypes: { eslint: 'object', oxlint: 'undefined' } },
]

describe('what defineLintRules returns', () => {
  it.each(PROJECTS)('is the editor parts and nothing else, for a project $project', ({ projectDir }) => {
    const config = defineLintRules(buildEveryRulesetLintRules(projectDir))

    expect({
      keys: Object.keys(config),
      partKeysBesideTheTwo: Object.keys(config.editorRulesets).filter((key) => !EDITOR_PART_KEYS.includes(key)),
    }).toStrictEqual({ keys: ['editorRulesets'], partKeysBesideTheTwo: [] })
  })

  it.each(PROJECTS)('holds parts that are data, with no function anywhere in them, for a project $project', ({ projectDir, partTypes }) => {
    const { editorRulesets } = defineLintRules(buildEveryRulesetLintRules(projectDir))

    expect({
      partTypes: { eslint: typeof editorRulesets.eslint, oxlint: typeof editorRulesets.oxlint },
      functions: pathsOfFunctionsIn(editorRulesets),
    }).toStrictEqual({ partTypes, functions: [] })
  })

  it('holds both parts for a project whose package.json lists oxlint', () => {
    const { eslint, oxlint } = defineLintRules(buildEveryRulesetLintRules(PROJECT_WITH_OXLINT)).editorRulesets

    expect({ eslint: typeof eslint, oxlint: typeof oxlint }).toStrictEqual({ eslint: 'object', oxlint: 'object' })
  })

  it('holds no oxlint part for a project whose package.json lists none', () => {
    const { eslint, oxlint } = defineLintRules(buildEveryRulesetLintRules(PROJECT_WITHOUT_OXLINT)).editorRulesets

    expect({ eslint: typeof eslint, oxlint }).toStrictEqual({ eslint: 'object', oxlint: undefined })
  })
})

// The parts carry nothing for turning off a rule the team's config sets (decisions.md, "Owner
// 2026-10-14"): the ESLint part keeps the oxlint part's layers, read for the off of
// typescript-eslint's extensions where oxlint runs their core rule (D10), and the oxlint part names
// the rules the ESLint part turns on, read for the off of oxlint's silent copies of them (decisions.md,
// "Owner 2026-10-14 (questions on the merge rework spec", point 1).
describe('the parts of a project whose package.json lists oxlint', () => {
  it("hold their engine, the project root and their layers, the ESLint part beside oxlint the oxlint part's layers too, the oxlint part the rules the ESLint part turns on, and nothing else", () => {
    const { eslint, oxlint } = defineLintRules(buildEveryRulesetLintRules(PROJECT_WITH_OXLINT)).editorRulesets

    expect({ eslint: Object.keys(eslint).toSorted(), oxlint: oxlint === undefined ? undefined : Object.keys(oxlint).toSorted() }).toStrictEqual({
      eslint: ['engine', 'layers', 'oxlintLayers', 'tsconfigRootDir', 'usesOxlint'],
      oxlint: ['engine', 'layers', 'tsconfigRootDir', 'turnedOnInEslint'],
    })
  })
})
