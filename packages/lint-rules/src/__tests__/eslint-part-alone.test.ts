import { catalog } from '@workspace/rule-data'
import { describe, expect, it } from 'vitest'
import type { EslintPart } from '../core/editor-parts.ts'
import { eslintPluginRegistry } from '../eslint-plugin-registry.ts'
import { defineLintRules, type LintRules } from '../index.ts'
import { NOT_LINTED, setUpEslintConfigOracle } from './eslint-config-oracle.ts'
import { ABSENT, type CalculatedEntry, entriesOfEachFileIn } from './eslint-entries-owed.ts'
import { eslintPartAlone } from './eslint-part-alone.ts'
import { buildConsumerLintRules } from './factories/lint-rules-factories.ts'
import { buildPackageJsonListingOthers, createProjectListingOxlint, packageJsonText } from './factories/package-json-factories.ts'
import { setUpTempProjects } from './temp-projects.ts'

// The ESLint differential's "ours alone": an oracle built by the merge would agree with the merge
// on any defect that also shows with an empty team config, as our ignores going unread does.

type SharedFields = Partial<Omit<LintRules, 'tsconfigRootDir' | 'agentRulesets' | 'editorRulesets'>>

const ARRAY_TYPE = '@typescript-eslint/array-type'
const MAX_PARAMS = 'max-params'
const MAX_PARAMS_TWIN = '@typescript-eslint/max-params'

const tempProjects = setUpTempProjects()
const PROJECT_WITH_OXLINT = createProjectListingOxlint(tempProjects)
const PROJECT_WITHOUT_OXLINT = tempProjects.create({ files: { 'package.json': packageJsonText(buildPackageJsonListingOthers()) } })

const { calculatedRulesOfEach } = setUpEslintConfigOracle()

function ourEslintPart(projectDir: string, fields: SharedFields): EslintPart {
  return defineLintRules(buildConsumerLintRules(projectDir, {}, fields)).editorRulesets.eslint
}

/** Each file's calculated entry of each rule given, or NOT_LINTED: the always-on rules every part states are left out. */
async function entriesIn(
  part: EslintPart,
  files: readonly string[],
  ruleIds: readonly string[],
): Promise<Record<string, Record<string, CalculatedEntry> | typeof NOT_LINTED>> {
  return entriesOfEachFileIn(await calculatedRulesOfEach(eslintPartAlone(part, catalog, eslintPluginRegistry), files), ruleIds, files)
}

describe('eslintPartAlone', () => {
  it("runs each rule our ESLint part states where it states it, an entry's off included", async () => {
    const part = ourEslintPart(PROJECT_WITH_OXLINT, { rules: { [ARRAY_TYPE]: 'error' }, fileOverrides: [{ files: ['legacy/**'], rules: { [ARRAY_TYPE]: 'off' } }] })

    expect(await entriesIn(part, ['src/a.ts', 'legacy/a.ts'], [ARRAY_TYPE])).toStrictEqual({
      'src/a.ts': { [ARRAY_TYPE]: [2, { default: 'array-simple' }] },
      'legacy/a.ts': { [ARRAY_TYPE]: [0, { default: 'array-simple' }] },
    })
  })

  // ESLint reads a global ignore matching a folder as leaving out every file under it.
  it.each(['vendor', 'legacy/vendor/', 'legacy/vendor/**'])(
    'lints no file our ignores leave out, read as global ignores, where they are %s, and lints the rest',
    async (ignore) => {
      const part = ourEslintPart(PROJECT_WITH_OXLINT, { rules: { [ARRAY_TYPE]: 'error' }, ignores: [ignore] })

      expect(await entriesIn(part, ['legacy/vendor/a.ts', 'src/a.ts'], [ARRAY_TYPE])).toStrictEqual({
        'legacy/vendor/a.ts': NOT_LINTED,
        'src/a.ts': { [ARRAY_TYPE]: [2, { default: 'array-simple' }] },
      })
    },
  )

  it('states no ESLint name of a rule our oxlint part runs, in a project whose package.json lists oxlint', async () => {
    const part = ourEslintPart(PROJECT_WITH_OXLINT, { rules: { 'import-x/first': 'error' } })

    expect(await entriesIn(part, ['src/a.ts'], ['import-x/first', 'import/first'])).toStrictEqual({
      'src/a.ts': { 'import-x/first': ABSENT, 'import/first': ABSENT },
    })
  })

  // Without oxlint the ESLint part runs typescript-eslint's extension of a core rule on TS files (#39).
  it('runs the extension of a core rule it takes over from oxlint on TS files, and the core rule on JS files, in a project whose package.json lists no oxlint', async () => {
    const part = ourEslintPart(PROJECT_WITHOUT_OXLINT, { rules: { [MAX_PARAMS]: ['error', { max: 3 }] } })

    expect(await entriesIn(part, ['src/a.ts', 'src/a.js'], [MAX_PARAMS, MAX_PARAMS_TWIN])).toStrictEqual({
      'src/a.ts': { [MAX_PARAMS]: [0, { max: 3 }], [MAX_PARAMS_TWIN]: [2, { max: 3 }] },
      'src/a.js': { [MAX_PARAMS]: [2, { max: 3 }], [MAX_PARAMS_TWIN]: ABSENT },
    })
  })
})
