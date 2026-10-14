import { catalog, type RuleRoute } from '@workspace/rule-data'
import type { Linter } from 'eslint'
import type { OxlintConfig } from 'oxlint'
import { describe, expect, it } from 'vitest'
import { oxlintOnlyRules, provenMovedRules, skippedRuleIds, twinnedMovedRules } from './__tests__/eslint-versions.ts'
import { buildEveryRulesetLintRules } from './__tests__/factories/lint-rules-factories.ts'
import {
  buildPackageJsonListingOthers,
  buildPackageJsonListingOxlint,
  packageJsonText,
} from './__tests__/factories/package-json-factories.ts'
import {
  onEslint,
  onItsEngine,
  type RuleOnEngine,
  ruleIdsStatedInEslint,
  rulesOnInEslint,
  rulesOnInOxlint,
  sortedById,
  uniqueById,
} from './__tests__/rules-on-engines.ts'
import { EMPTY_TEAM_OXLINT_CONFIG, NO_TEAM_ESLINT_CONFIG, writeTeamOxlintConfigSettingNoRule } from './__tests__/team-configs-of-the-other-engine.ts'
import { INSTALLED_OXLINT, setUpTempProjects } from './__tests__/temp-projects.ts'
import { mergeEslintConfig } from './eslint.ts'
import { defineLintRules } from './index.ts'
import { mergeOxlintConfig } from './oxlint.ts'

// The editor parts of a config listing every ruleset in its editor set, merged into empty team
// configs, read the way gate-equivalence reads the agent build. The team's oxlint config turns every
// category off, so the team sets no rule. The editor parts always allow suppressions, whatever
// allowSuppressions says (owner, 2026-10-11).

type MergedEditorConfigs = { readonly eslint: Linter.Config[]; readonly oxlint: OxlintConfig | null }

const SUPPRESSION_RULE_IDS: ReadonlySet<string> = new Set([
  '@typescript-eslint/ban-ts-comment',
  'house/no-suppressions',
  'unicorn/no-abusive-eslint-disable',
])
const BAN_TS_COMMENTS_BUT_A_DESCRIBED_EXPECT_ERROR = {
  'ts-expect-error': 'allow-with-description',
  'ts-ignore': true,
  'ts-nocheck': true,
}

const tempProjects = setUpTempProjects()
const PROJECT_WITH_OXLINT = tempProjects.create({
  files: { 'package.json': packageJsonText(buildPackageJsonListingOxlint()) },
  linkedPackages: [INSTALLED_OXLINT],
})
const PROJECT_WITHOUT_OXLINT = tempProjects.create({
  files: { 'package.json': packageJsonText(buildPackageJsonListingOthers()) },
})

function mergedEditorConfigsOf(projectDir: string): MergedEditorConfigs {
  const { eslint, oxlint } = defineLintRules(buildEveryRulesetLintRules(projectDir)).editorRulesets
  return {
    eslint: mergeEslintConfig([], eslint, writeTeamOxlintConfigSettingNoRule(eslint)),
    oxlint: oxlint === undefined ? null : mergeOxlintConfig(EMPTY_TEAM_OXLINT_CONFIG, oxlint, NO_TEAM_ESLINT_CONFIG),
  }
}

function oxlintConfigOf({ oxlint }: MergedEditorConfigs): OxlintConfig {
  if (oxlint === null) throw new Error('the project got no oxlint part')
  return oxlint
}

function routeOf(id: string): RuleRoute {
  const route = catalog.rules.get(id)
  if (route === undefined) throw new Error(`${id} is not in the catalog`)
  return route
}

/** Every shipped rule allowSuppressions does not decide, as the catalog ships it. */
function shippedRoutesBesidesTheSuppressionRules(): RuleRoute[] {
  return [...catalog.rules.values()].filter((route) => route.shipped !== null && !SUPPRESSION_RULE_IDS.has(route.id))
}

function shippedOptionsOf(route: RuleRoute): readonly unknown[] {
  if (route.shipped === null) throw new Error(`${route.id} is not shipped`)
  return route.shipped.options
}

describe('the editor parts of a project whose package.json lists oxlint, merged into empty team configs', () => {
  const merged = (): MergedEditorConfigs => mergedEditorConfigsOf(PROJECT_WITH_OXLINT)

  it('run exactly the editor rules, each once, on its routed engine, with its options, suppressions allowed', () => {
    const configs = merged()
    const expected = sortedById([
      ...shippedRoutesBesidesTheSuppressionRules().map((route) => onItsEngine(route.id, shippedOptionsOf(route))),
      onItsEngine('@typescript-eslint/ban-ts-comment', [BAN_TS_COMMENTS_BUT_A_DESCRIBED_EXPECT_ERROR]),
      onItsEngine('unicorn/no-abusive-eslint-disable', []),
    ])

    expect(uniqueById([...rulesOnInOxlint(oxlintConfigOf(configs)), ...rulesOnInEslint(configs.eslint)])).toStrictEqual(expected)
  })

  it('run no rule in both engines', () => {
    const configs = merged()
    const eslintIds = new Set(rulesOnInEslint(configs.eslint).map((rule) => rule.id))

    expect(uniqueById(rulesOnInOxlint(oxlintConfigOf(configs))).filter((rule) => eslintIds.has(rule.id))).toStrictEqual([])
  })

  // Nothing is turned off across engines (decisions.md, "Owner 2026-10-14"): ESLint states no rule
  // oxlint runs for us, under its ID or an alias.
  it('state in ESLint no oxlint-routed rule, under its ID or an alias', () => {
    const { eslint } = merged()
    const oxlintRoutedNames = new Set(
      [...catalog.rules.values()].filter((route) => route.engine === 'oxlint').flatMap((route) => [route.id, ...route.eslintAliases]),
    )

    expect(ruleIdsStatedInEslint(eslint).filter((id) => oxlintRoutedNames.has(id))).toStrictEqual([])
  })
})

describe('the editor ESLint part of a project whose package.json lists no oxlint, merged into an empty team config', () => {
  const merged = (): MergedEditorConfigs => mergedEditorConfigsOf(PROJECT_WITHOUT_OXLINT)

  it('comes with no oxlint part', () => {
    expect(merged().oxlint).toBeNull()
  })

  // Each moved core rule a current typescript-eslint rule extends is no longer skipped: it runs on JS
  // files, and its twin on TS files in its place, with the core rule's options (questions.md #39).
  // Twins are read from the installed typescript-eslint.
  it("runs every ESLint-routed rule and every moved rule not skipped, with its options, suppressions allowed, and typescript-eslint's twin of each moved core rule with the core rule's options", () => {
    const provenMovedIds = new Set(provenMovedRules().map((route) => route.id))
    const twinned = twinnedMovedRules()
    const twinnedCoreRules = new Set(twinned.map(({ core }) => core))
    const ranInEslint = (route: RuleRoute): boolean =>
      route.engine === 'eslint' || provenMovedIds.has(route.id) || twinnedCoreRules.has(route.id)
    const expected: RuleOnEngine[] = sortedById([
      ...shippedRoutesBesidesTheSuppressionRules()
        .filter(ranInEslint)
        .map((route) => onEslint(route.id, shippedOptionsOf(route))),
      ...twinned.map(({ core, twin }) => onEslint(twin, shippedOptionsOf(routeOf(core)))),
      // A moved rule, which ESLint runs here.
      onEslint('@typescript-eslint/ban-ts-comment', [BAN_TS_COMMENTS_BUT_A_DESCRIBED_EXPECT_ERROR]),
      onEslint('unicorn/no-abusive-eslint-disable', []),
    ])

    expect(uniqueById(rulesOnInEslint(merged().eslint))).toStrictEqual(expected)
  })

  it('states no skipped rule and none ESLint has no version of, so the team keeps its own settings of them', () => {
    const notOurs = new Set([...skippedRuleIds(), ...oxlintOnlyRules().map((route) => route.id)])

    expect(ruleIdsStatedInEslint(merged().eslint).filter((id) => notOurs.has(id))).toStrictEqual([])
  })
})
