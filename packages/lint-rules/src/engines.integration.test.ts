import { readdir } from 'node:fs/promises'
import { relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { catalog } from '@workspace/rule-data'
import { eslintPlugins } from '@workspace/rule-data/eslint-plugins'
import { describe, expect, it } from 'vitest'
import { suppressionOfARuleNobodyDefines } from './__tests__/cases/suppression-comments.ts'
import { setUpEngineRun } from './__tests__/engine-run.ts'
import { pluginRegisteredUnder } from './__tests__/eslint-config-reads.ts'
import { buildEditorBuild } from './__tests__/factories/engine-build-factories.ts'
import { buildEslintError } from './__tests__/factories/engine-error-factories.ts'
import { buildConsumerLintRules, buildEveryRulesetLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { buildTeamEslintBlock } from './__tests__/factories/team-config-factories.ts'
import { canonicalIdOfOxlintName } from './__tests__/rules-on-engines.ts'
import { defineLintRules } from './index.ts'

const FIXTURES_DIR = fileURLToPath(new URL('../test-fixtures/engines', import.meta.url))
const FILE_OVERRIDES_FIXTURES_DIR = fileURLToPath(new URL('../test-fixtures/file-overrides', import.meta.url))
const LINTED_SOURCE = /\.(?:[cm]?[jt]s|[jt]sx)$/u
const FILE_OVERRIDE_BLOCK_PREFIX = 'agents-inc/file-overrides/'
const SUPPRESSES_A_RULE_NOBODY_DEFINES_FILE = 'nobody-suppression.ts'

// Rules oxlint runs: the diagnostic code is oxlint's own spelling of the rule.
const FIRES_IN_OXLINT = [
  // Not shipped on: turned on through `rules`, and written `node/` in the oxlint config.
  { rule: 'n/no-exports-assign', file: 'exports-assign.cjs', code: 'node(no-exports-assign)' },
  // Owner, 2026-10-10: shipped in correctness. A for…of whose body always returns runs once.
  { rule: 'no-unreachable-loop', file: 'unreachable-loop.ts', code: 'eslint(no-unreachable-loop)' },
]

const FIRES_IN_ESLINT = [
  // oxlint has it under react/, but refuses an option ESLint's version takes (spec-merge-model.md, 3.2).
  { rule: 'react-hooks/rules-of-hooks', file: 'rules-of-hooks.tsx' },
  { rule: 'n/prefer-global/buffer', file: 'prefer-global-buffer.ts' },
  { rule: '@typescript-eslint/no-floating-promises', file: 'floating-promises.ts' },
  { rule: 'house/no-section-banner', file: 'section-banner.ts' },
  { rule: 'house/no-classic-loops', file: 'classic-loop.ts' },
  // Reads the sibling undef-class.module.css.
  { rule: 'css-modules/no-undef-class', file: 'undef-class.tsx' },
  { rule: 'storybook/default-exports', file: 'story.stories.tsx' },
]

// functional/no-loop-statements bans for…of too, so it no longer ships (owner, 2026-10-10).
const LOOP_BANNING_RULES = ['functional/no-loop-statements', 'house/no-classic-loops']

type OxlintPrintedConfig = { rules: Record<string, unknown> }

const fullConfig = setUpEngineRun(FIXTURES_DIR, (projectDir) =>
  defineLintRules(buildEveryRulesetLintRules(projectDir, { rules: { 'n/no-exports-assign': 'error' } })),
)

function oxlintPrintedConfig(): OxlintPrintedConfig {
  return JSON.parse(fullConfig.oxlintPrint().stdout) as OxlintPrintedConfig
}

function emittedOxlintRules(): Record<string, unknown> {
  const { rules } = fullConfig.emittedOxlintConfig()
  if (rules === undefined) throw new Error('oxlintConfig emitted no rules')
  return rules
}

function canonicalIdsOfRulesOn(rules: Record<string, unknown>): string[] {
  return Object.entries(rules)
    .filter(([, entry]) => {
      const severity: unknown = Array.isArray(entry) ? entry[0] : entry
      return severity !== 'off' && severity !== 'allow'
    })
    .map(([oxlintName]) => canonicalIdOfOxlintName(oxlintName))
    .sort()
}

function routeOf(ruleId: string) {
  const rule = catalog.rules.get(ruleId)
  if (rule === undefined) throw new Error(`${ruleId} is not in the catalog`)
  return rule
}

describe('oxlint, given the full config', () => {
  it('loads it: exits 0 or 1 and prints a JSON report', () => {
    expect([0, 1]).toContain(fullConfig.oxlintLint().exitCode)
    expect(() => fullConfig.oxlintReport()).not.toThrow()
  })

  it('enables exactly the rules the config emits, so none is dropped for a missing plugin', () => {
    expect(canonicalIdsOfRulesOn(oxlintPrintedConfig().rules)).toStrictEqual(canonicalIdsOfRulesOn(emittedOxlintRules()))
  })

  it('runs as many rules as its printed config enables', () => {
    expect(fullConfig.oxlintReport().number_of_rules).toBe(canonicalIdsOfRulesOn(oxlintPrintedConfig().rules).length)
  })
})

describe('ESLint, given the full config', () => {
  it('lints every fixture source file', async () => {
    const fixtureSources = (await readdir(FIXTURES_DIR, { recursive: true }))
      .filter((file) => LINTED_SOURCE.test(file))
      .sort()

    expect(
      fullConfig
        .eslintResults()
        .map((result) => relative(fullConfig.projectDir(), result.filePath))
        .sort(),
    ).toStrictEqual(fixtureSources)
  })

  it('reports no fatal message on any of them', () => {
    expect(fullConfig.eslintFatalMessages()).toStrictEqual([])
  })
})

describe('each rule fires on its routed engine only, under its exact ID', () => {
  it.each(FIRES_IN_OXLINT)('$rule fires in oxlint as $code', ({ file, code }) => {
    expect(fullConfig.oxlintCodesOn(file)).toContain(code)
  })

  it.each(FIRES_IN_OXLINT)('$rule stays off in ESLint, under its ID and every alias', ({ rule, file }) => {
    const reported = fullConfig.eslintRuleIdsOn(file)

    expect([rule, ...routeOf(rule).eslintAliases].filter((id) => reported.includes(id))).toStrictEqual([])
  })

  it.each(FIRES_IN_ESLINT)('$rule fires in ESLint', ({ rule, file }) => {
    expect(fullConfig.eslintRuleIdsOn(file)).toContain(rule)
  })

  it('keeps storybook/default-exports to story files: silent on the same code in story.tsx', () => {
    expect(fullConfig.eslintRuleIdsOn('story.tsx')).not.toContain('storybook/default-exports')
  })

  // classic-loop.ts, beside it, is the loop the same rules report.
  it('lets a for…of loop through: no loop-banning rule reports for-of-loop.ts', () => {
    const reported = fullConfig.eslintRuleIdsOn('for-of-loop.ts')

    expect(LOOP_BANNING_RULES.filter((rule) => reported.includes(rule))).toStrictEqual([])
  })

  // unreachable-loop.ts, beside it, is the for…of no-unreachable-loop reports.
  it('keeps no-unreachable-loop silent on a for…of loop that runs for every item: for-of-loop.ts', () => {
    expect(fullConfig.oxlintCodesOn('for-of-loop.ts')).not.toContain('eslint(no-unreachable-loop)')
  })
})

// Shipped in the class-names ruleset (owner, 2026-10-14); a consumer can also turn it on by ID. The
// fixture's classNames(…) and buttonVariants(…) calls, which its defaults accept, stay silent.
describe('house/require-class-helper, turned on through rules', () => {
  const classHelper = setUpEngineRun(FIXTURES_DIR, (projectDir) =>
    defineLintRules(buildConsumerLintRules(projectDir, {}, { rules: { 'house/require-class-helper': 'error' } })),
  )

  it('is loaded by ESLint with no fatal message on any file', () => {
    expect(classHelper.eslintFatalMessages()).toStrictEqual([])
  })

  it('fires in ESLint, once, on a template literal composing classes in a TSX file', () => {
    expect(classHelper.errorsOn('class-helper.tsx')).toStrictEqual([buildEslintError('house/require-class-helper', 2)])
  })
})

// eslint-plugin-unicorn 78 adds both rules, opt-in upstream and shipped in no ruleset here
// (q-r2-plugin-upgrades); oxlint has neither. Each fixture holds a call each rule reports and,
// below it, one it leaves alone: a default passed a value of its own, and a wrapper one call skips.
describe('the rules eslint-plugin-unicorn 78 adds, turned on through rules', () => {
  const unicorn78Rules = setUpEngineRun(FIXTURES_DIR, (projectDir) =>
    defineLintRules(
      buildConsumerLintRules(projectDir, {}, {
        rules: { 'unicorn/no-repeated-call-wrappers': 'error', 'unicorn/no-unnecessary-default-arguments': 'error' },
      }),
    ),
  )

  it('are loaded by ESLint with no fatal message on any file', () => {
    expect(unicorn78Rules.eslintFatalMessages()).toStrictEqual([])
  })

  it('fire no-unnecessary-default-arguments once, on the argument that matches its default', () => {
    expect(unicorn78Rules.errorsOn('unnecessary-default-arguments.ts')).toStrictEqual([
      buildEslintError('unicorn/no-unnecessary-default-arguments', 5),
    ])
  })

  it('fire no-repeated-call-wrappers once, on the function every call wraps alike', () => {
    expect(unicorn78Rules.errorsOn('repeated-call-wrappers.ts')).toStrictEqual([buildEslintError('unicorn/no-repeated-call-wrappers', 1)])
  })
})

// While suppressions are banned, ESLint reads no directive at all (noInlineConfig), so a
// suppression never needs a stub. The stubs serve a consumer who allows suppressions.
describe('a suppression comment in ESLint, with the suppression ban on as shipped', () => {
  it.each([
    { comment: 'an oxc rule', file: 'oxc-suppression.ts', named: 'oxc/approx-constant' },
    { comment: 'an oxlint-only rule under a registered prefix', file: 'oxlint-only-name-suppression.tsx', named: 'react/no-clone-element' },
  ])('naming $comment draws the ban and is never looked up', ({ file, named }) => {
    const reported = fullConfig.eslintRuleIdsOn(file)

    expect(['house/no-suppressions', named].filter((id) => reported.includes(id))).toStrictEqual(['house/no-suppressions'])
  })
})

describe('a suppression comment in ESLint, with suppressions allowed', () => {
  const suppressionsAllowed = setUpEngineRun(FIXTURES_DIR, (projectDir) =>
    defineLintRules(buildEveryRulesetLintRules(projectDir, { allowSuppressions: true })),
  )

  it('loads for an oxc rule, through its stub', () => {
    expect(suppressionsAllowed.eslintRuleIdsOn('oxc-suppression.ts')).not.toContain('oxc/approx-constant')
  })

  // react/no-clone-element exists only in oxlint, under the react prefix eslint-plugin-react holds
  // in ESLint: it loads through the copy of that plugin carrying a stub for it.
  it('loads for an oxlint-only rule under a prefix whose ESLint plugin is registered', () => {
    expect(suppressionsAllowed.eslintRuleIdsOn('oxlint-only-name-suppression.tsx')).not.toContain('react/no-clone-element')
  })
})

// With oxlint, the editor ESLint part merges its plugin under each prefix the team registers with
// the team's own object, adding a do-nothing stub for each oxlint-only name: react/no-clone-element
// exists only in oxlint, under the react prefix eslint-plugin-react holds in ESLint. The editor
// parts allow suppressions, so ESLint reads and looks up every directive.
describe('a suppression comment in ESLint, in a team config registering react merged with the editor part, with oxlint', () => {
  const teamRegistersReact = setUpEngineRun(
    FIXTURES_DIR,
    (projectDir) => defineLintRules(buildEveryRulesetLintRules(projectDir)),
    {
      'package.json': packageJsonText(buildPackageJsonListingOxlint()),
      [SUPPRESSES_A_RULE_NOBODY_DEFINES_FILE]: suppressionOfARuleNobodyDefines,
    },
    buildEditorBuild({ teamEslintConfig: [buildTeamEslintBlock('team-react', { plugins: { react: pluginRegisteredUnder(eslintPlugins, 'react') } })] }),
  )

  it('is loaded by ESLint without a fatal message on any file', () => {
    expect(teamRegistersReact.eslintFatalMessages()).toStrictEqual([])
  })

  it('loads for the oxlint-only rule under that prefix: only the rule nobody defines is "not found"', () => {
    expect(teamRegistersReact.eslintRulesNotFound()).toStrictEqual([`${SUPPRESSES_A_RULE_NOBODY_DEFINES_FILE}: nobody/rule`])
  })
})

describe('a config whose file overrides emit every override shape, run by the real engines', () => {
  const overridden = setUpEngineRun(FILE_OVERRIDES_FIXTURES_DIR, (projectDir) =>
    defineLintRules(
      buildConsumerLintRules(
        projectDir,
        { agentRulesets: { runtimes: ['node', 'browser'] } },
        {
          rules: { 'no-undef': 'error' },
          fileOverrides: [
            { files: ['server/**'], agentRulesets: { runtimes: ['node'] } },
            { files: ['strict/**'], agentRulesets: { quality: ['type-safety'] } },
            { files: ['stories/**'], agentRulesets: { libs: { testing: ['storybook'] } } },
            { files: ['typed/**'], rules: { '@typescript-eslint/no-floating-promises': 'error' } },
          ],
        },
      ),
    ),
  )

  const OXLINT_OVERRIDES = [
    {
      code: 'eslint(no-undef)',
      entry: 'drops the browser env for server/**',
      firesOn: 'server/window.js',
      silentOn: ['client/window.js'],
    },
    {
      code: 'typescript(no-non-null-assertion)',
      entry: 'adds type-safety for strict/**, minus the rule\'s own ignores for tests',
      firesOn: 'strict/non-null.ts',
      silentOn: ['strict/non-null.test.ts', 'loose/non-null.ts'],
    },
  ]

  const ESLINT_OVERRIDES = [
    {
      rule: 'storybook/default-exports',
      entry: 'adds storybook for stories/**, ANDed with the rule\'s own story globs',
      firesOn: 'stories/thing.stories.tsx',
      silentOn: ['stories/thing.tsx', 'loose/thing.stories.tsx'],
    },
    {
      rule: '@typescript-eslint/no-unsafe-return',
      entry: 'adds the typed rules of type-safety for strict/**',
      firesOn: 'strict/unsafe-return.ts',
      silentOn: ['loose/unsafe-return.ts'],
    },
    {
      rule: '@typescript-eslint/no-floating-promises',
      entry: 'turns a typed rule on for typed/**',
      firesOn: 'typed/floating.ts',
      silentOn: ['loose/floating.ts'],
    },
  ]

  it('emits each shape the engines are here to load', () => {
    const { overrides } = overridden.emittedOxlintConfig()
    if (overrides === undefined) throw new Error('oxlintConfig emitted no overrides')
    const blocks = overridden.emittedEslintConfig()

    expect({
      oxlintOverrideWithExcludeFiles: overrides.some((override) => override.excludeFiles !== undefined),
      oxlintOverrideWithEnv: overrides.some((override) => override.env !== undefined),
      eslintBlockWithNestedArrayFiles: blocks.some((block) => block.files?.some((files) => Array.isArray(files))),
      eslintEntryBlockWithTypedRule: blocks.some(
        (block) =>
          block.name?.startsWith(FILE_OVERRIDE_BLOCK_PREFIX) === true &&
          Object.keys(block.rules ?? {}).some((id) => routeOf(id).typed),
      ),
    }).toStrictEqual({
      oxlintOverrideWithExcludeFiles: true,
      oxlintOverrideWithEnv: true,
      eslintBlockWithNestedArrayFiles: true,
      eslintEntryBlockWithTypedRule: true,
    })
  })

  it('is loaded by oxlint: exits 0 or 1 and prints a JSON report', () => {
    expect([0, 1]).toContain(overridden.oxlintLint().exitCode)
    expect(() => overridden.oxlintReport()).not.toThrow()
  })

  it('is loaded by ESLint without a fatal message on any file', () => {
    expect(overridden.eslintFatalMessages()).toStrictEqual([])
  })

  it.each(OXLINT_OVERRIDES)('makes oxlint report $code where the entry $entry', ({ code, firesOn }) => {
    expect(overridden.oxlintCodesOn(firesOn)).toContain(code)
  })

  it.each(OXLINT_OVERRIDES)('keeps oxlint silent on $code elsewhere, where the entry $entry', ({ code, silentOn }) => {
    expect(silentOn.filter((file) => overridden.oxlintCodesOn(file).includes(code))).toStrictEqual([])
  })

  it.each(ESLINT_OVERRIDES)('makes ESLint report $rule where the entry $entry', ({ rule, firesOn }) => {
    expect(overridden.eslintRuleIdsOn(firesOn)).toContain(rule)
  })

  it.each(ESLINT_OVERRIDES)('keeps ESLint silent on $rule elsewhere, where the entry $entry', ({ rule, silentOn }) => {
    expect(silentOn.filter((file) => overridden.eslintRuleIdsOn(file).includes(rule))).toStrictEqual([])
  })
})
