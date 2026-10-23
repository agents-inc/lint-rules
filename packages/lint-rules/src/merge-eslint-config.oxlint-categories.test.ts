import { describe, expect, it } from 'vitest'
import {
  CONFIG_SETTING_TYPESCRIPT_RULES_BY_CATEGORY,
  CONFIG_TURNING_TYPE_AWARE_RULES_ON,
  CONFIGS_LEAVING_TYPE_AWARE_RULES_OUT,
  CONFIGS_LISTING_A_PLUGIN_BY_ANOTHER_NAME,
  CONFIGS_SETTING_NO_TYPESCRIPT_RULE_BY_CATEGORY,
  NO_FLOATING_PROMISES,
  NO_THIS_ALIAS,
} from './__tests__/cases/oxlint-categories-and-plugin-names.ts'
import { filesOf } from './__tests__/cases/other-engine-configs.ts'
import { setUpEslintConfigOracle } from './__tests__/eslint-config-oracle.ts'
import { buildConsumerLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { buildTsconfig } from './__tests__/factories/tsconfig-factories.ts'
import { INSTALLED_OXLINT, setUpTempProjects } from './__tests__/temp-projects.ts'
import { mergeEslintConfig } from './eslint.ts'
import { defineLintRules } from './index.ts'

// Which rules a team's oxlint config sets by the categories it writes: each rule of a category written
// on, of a plugin it lists under any name oxlint takes (measured, oxlint 1.87), a type-aware one only
// where its options turn those on. Our ESLint part runs no-this-alias and no-floating-promises.

const tempProjects = setUpTempProjects()
const { ruleSeverityInProjectFor } = setUpEslintConfigOracle()

const SOURCE_FILE = 'src/a.ts'
const SOURCE = 'export const total = 1\n'

const projectDir = tempProjects.create({
  files: {
    'package.json': packageJsonText(buildPackageJsonListingOxlint()),
    // A typed rule of ours runs only where a tsconfig takes the file in.
    'tsconfig.json': JSON.stringify(buildTsconfig({ include: ['src'] })),
    [SOURCE_FILE]: SOURCE,
    ...filesOf([
      ...CONFIGS_SETTING_NO_TYPESCRIPT_RULE_BY_CATEGORY,
      CONFIG_SETTING_TYPESCRIPT_RULES_BY_CATEGORY,
      ...CONFIGS_LEAVING_TYPE_AWARE_RULES_OUT,
      CONFIG_TURNING_TYPE_AWARE_RULES_ON,
      ...CONFIGS_LISTING_A_PLUGIN_BY_ANOTHER_NAME,
    ]),
  },
  linkedPackages: [INSTALLED_OXLINT],
})
const { eslint } = defineLintRules(buildConsumerLintRules(projectDir, {}, { rules: { [NO_THIS_ALIAS]: 'error', [NO_FLOATING_PROMISES]: 'error' } })).editorRulesets

/** Our rule's severity in a source file, merged beside the team oxlint config given: undefined where no block sets it. */
async function oursBeside(oxlintConfig: string, ruleId: string): Promise<string | undefined> {
  return ruleSeverityInProjectFor(projectDir, mergeEslintConfig([], eslint, { oxlintConfig }), SOURCE_FILE, ruleId)
}

describe('mergeEslintConfig, given a team oxlint config writing categories', () => {
  it.each(CONFIGS_SETTING_NO_TYPESCRIPT_RULE_BY_CATEGORY)('keeps our no-this-alias where the config writes $writes', async ({ file }) => {
    expect(await oursBeside(file, NO_THIS_ALIAS)).toBe('error')
  })

  it('drops ours where the config writes correctness on for typescript, which runs it as the team set it', async () => {
    expect(await oursBeside(CONFIG_SETTING_TYPESCRIPT_RULES_BY_CATEGORY.file, NO_THIS_ALIAS)).toBeUndefined()
  })
})

describe('mergeEslintConfig, given a team oxlint config writing correctness on for typescript, beside a typed rule oxlint runs only type-aware', () => {
  it.each(CONFIGS_LEAVING_TYPE_AWARE_RULES_OUT)('keeps our no-floating-promises where the config gives $writes', async ({ file }) => {
    expect(await oursBeside(file, NO_FLOATING_PROMISES)).toBe('error')
  })

  it('drops ours where the config turns type-aware rules on', async () => {
    expect(await oursBeside(CONFIG_TURNING_TYPE_AWARE_RULES_ON.file, NO_FLOATING_PROMISES)).toBeUndefined()
  })
})

describe('mergeEslintConfig, given a team oxlint config listing a plugin by another name oxlint takes for it, and writing correctness on', () => {
  it.each(CONFIGS_LISTING_A_PLUGIN_BY_ANOTHER_NAME)('reads the config listing $plugin as $alias', ({ file }) => {
    expect(() => mergeEslintConfig([], eslint, { oxlintConfig: file })).not.toThrow()
  })

  it.each(CONFIGS_LISTING_A_PLUGIN_BY_ANOTHER_NAME.filter(({ plugin }) => plugin === 'typescript'))(
    'drops our no-this-alias where the config lists typescript as $alias',
    async ({ file }) => {
      expect(await oursBeside(file, NO_THIS_ALIAS)).toBeUndefined()
    },
  )
})
