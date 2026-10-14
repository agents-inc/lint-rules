import { beforeAll, describe, expect, it } from 'vitest'
import {
  ARRAY_TYPE,
  ARRAY_TYPE_SOURCE,
  BLOCK_TURNING_NO_DEBUGGER_OFF,
  COMMENT_AS_JSX_TEXT_AND_DEBUGGER_SOURCE,
  DEBUGGER_SOURCE,
  ESLINT_REACT_IMPORT,
  FLOATING_PROMISE_SOURCE,
  FLOATING_PROMISES,
  JSX_NO_COMMENT_TEXTNODES,
  MAX_LINES,
  NO_DEBUGGER,
  NO_DUPLICATE_ENUM_VALUES,
  NO_THIS_ALIAS,
  NO_UNREACHABLE_LOOP,
  NO_UNUSED_EXPRESSIONS,
  NO_UNUSED_VARS,
  NO_VAR,
  NO_WARNING_COMMENTS,
  OURS_ARRAY_TYPE_AND_NO_VAR,
  OURS_COMMENT_TEXTNODES_AND_DEBUGGER,
  OURS_DEBUGGER,
  OURS_DEBUGGER_AND_MAX_LINES,
  OURS_FLOATING_PROMISES,
  OURS_NO_THIS_ALIAS,
  OURS_TYPESCRIPT_ESLINT_UNUSED_VARS,
  OURS_TYPESCRIPT_ESLINT_UNUSED_VARS_AND_DEBUGGER,
  OURS_UNREACHABLE_LOOP,
  OURS_UNUSED_AND_DEBUGGER,
  OURS_WARNING_COMMENTS_AND_DEBUGGER,
  TEAMS_ESLINT_ESLINT_REACT_UNDER_REACT,
  TEAMS_ESLINT_MAX_LINES_IN_LEGACY,
  TEAMS_ESLINT_TWIN_OF_NO_UNUSED_VARS,
  TEAMS_ESLINT_WARNING_COMMENTS,
  TEAMS_JSON_OXLINT_CONFIG,
  TEAMS_OXLINT_ARRAY_TYPE,
  TEAMS_OXLINT_DEBUGGER_OFF_IN_LEGACY,
  TEAMS_OXLINT_EXTENDING_AN_OBJECT_TURNING_NO_VAR_ON,
  TEAMS_OXLINT_LEAVING_EVERY_KEY_OUT,
  TEAMS_OXLINT_NO_UNUSED_VARS,
  TEAMS_OXLINT_WARNING_COMMENTS,
  TEAMS_OXLINT_WRITING_CORRECTNESS_ON,
  TEAMS_OXLINT_WRITING_NURSERY_ON,
  teamsJsonOxlintConfigExtendingByPathFiles,
  teamsOxlintCorrectnessErrors,
  teamsOxlintListingTypescriptForLegacyBeside,
  teamsOxlintStyleCategoryListing,
  teamsOxlintStyleCategoryListingTypescriptForLegacyBeside,
  THIS_ALIAS_AND_DUPLICATE_ENUM_SOURCE,
  THIS_ALIAS_SOURCE,
  TYPESCRIPT_ESLINT_RECOMMENDED,
  UNREACHABLE_LOOP_SOURCE,
  UNUSED_SOURCE,
  WARNING_COMMENTS_SOURCE,
} from './__tests__/cases/team-sets-a-rule.ts'
import {
  bothEnginesFindingsOf,
  type ConsumerCliRuns,
  eslintEngineFindingsOf,
  eslintFatalMessagesOf,
  oxlintFindingsWithSeverityOf,
  setUpConsumerCliRuns,
  setUpConsumerEslintCliRun,
  setUpMergedAndTeamAloneCliRuns,
} from './__tests__/consumer-cli-runs.ts'
import {
  CONSUMER_CONFIG_FILES,
  eslintConfigAddingABlockAfterTheMergeText,
  projectNamingEachConfigText,
  type TeamConfigSources,
} from './__tests__/factories/consumer-project-factories.ts'
import { buildConsumerSettings } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJson, buildPackageJsonListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { buildTsconfig } from './__tests__/factories/tsconfig-factories.ts'
import { type FindingsByFileAndRule, findingsByFileAndRule, type RuleByItsNames } from './__tests__/findings-beside-the-team.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { EMPTY_TEAM_OXLINT_CONFIG } from './__tests__/team-configs-of-the-other-engine.ts'
import { installedPackage, type ProjectFiles } from './__tests__/temp-projects.ts'
import type { LintRules } from './index.ts'

// The owner's model (decisions.md, "Owner 2026-10-14"; spec-merge-model.md, 4.1), on the real CLIs
// through the built package: each project's eslint.config.mjs and oxlint.config.mts merge our part
// into the team's configs, each naming the other. A rule the team's ESLint or oxlint config sets
// anywhere (a block or override, a preset, a category on) is the team's in every file, a core rule
// and typescript-eslint's twin of it counting as one rule: our part runs it in neither engine, and
// the team's findings are what its configs alone give. A rule the team sets in neither is ours,
// reported once: by oxlint where the project lists oxlint, else by ESLint. Each case pairs the
// team's setting with a rule it does not set, so a merge dropping everything fails too.

allowEveryTestForParallelLoad()

const TYPESCRIPT_ESLINT = installedPackage('typescript-eslint')
const ESLINT_REACT = installedPackage('@eslint-react/eslint-plugin')
const SOURCE_FILE = 'src/a.ts'
const LEGACY_FILE = 'legacy/a.ts'
// max-lines ships for TSX files alone.
const TSX_SOURCE_FILE = 'src/a.tsx'
const LEGACY_TSX_FILE = 'legacy/a.tsx'
const MERGED_AND_TEAM_ALONE = {
  merged: { oxlintConfigFile: CONSUMER_CONFIG_FILES.oxlint },
  teamAlone: { oxlintConfigFile: CONSUMER_CONFIG_FILES.teamAloneOxlint, eslintConfigFile: CONSUMER_CONFIG_FILES.teamAloneEslint },
}

type OurRules = NonNullable<LintRules['rules']>

/** A project listing oxlint, our settings turning on the rules given and listing no ruleset, the team's two configs, and the sources given. */
function projectListingOxlint(ourRules: OurRules, team: TeamConfigSources, sources: ProjectFiles): ProjectFiles {
  return {
    'package.json': packageJsonText(buildPackageJsonListingOxlint()),
    ...projectNamingEachConfigText(buildConsumerSettings({}, { rules: ourRules }), team),
    ...sources,
  }
}

/** Each file's findings of each rule given, from both CLIs. */
function findingsOf(runs: ConsumerCliRuns, files: readonly string[], rules: readonly RuleByItsNames[]): FindingsByFileAndRule {
  return findingsByFileAndRule(bothEnginesFindingsOf(runs), files, rules)
}

describe("a rule the team's ESLint config alone sets, which oxlint runs for us: no-warning-comments under the team's terms", () => {
  const runs = setUpConsumerCliRuns(
    projectListingOxlint(OURS_WARNING_COMMENTS_AND_DEBUGGER, { eslintBlockSources: [TEAMS_ESLINT_WARNING_COMMENTS], oxlint: EMPTY_TEAM_OXLINT_CONFIG }, { [SOURCE_FILE]: WARNING_COMMENTS_SOURCE }),
    CONSUMER_CONFIG_FILES.oxlint,
    [TYPESCRIPT_ESLINT],
  )

  // Ours alone, oxlint's default terms report todo and fixme: neither is owed.
  it("is reported once, by ESLint, where the team's terms draw it and nowhere else; and no-debugger, which the team sets nowhere, once, by oxlint", () => {
    expect(findingsOf(runs(), [SOURCE_FILE], [NO_WARNING_COMMENTS, NO_DEBUGGER])).toStrictEqual({
      [SOURCE_FILE]: { 'no-warning-comments': ['src/a.ts:2 no-warning-comments'], 'no-debugger': ['src/a.ts:5 eslint(no-debugger)'] },
    })
  })
})

describe("a rule the team's oxlint config alone sets, which ESLint runs for us: array-type under generic", () => {
  const runs = setUpConsumerCliRuns(
    projectListingOxlint(OURS_ARRAY_TYPE_AND_NO_VAR, { eslintBlockSources: [], oxlint: TEAMS_OXLINT_ARRAY_TYPE }, { [SOURCE_FILE]: ARRAY_TYPE_SOURCE }),
    CONSUMER_CONFIG_FILES.oxlint,
    [TYPESCRIPT_ESLINT],
  )

  // Ours alone, array-simple reports line 1, which generic leaves alone.
  it("is reported by oxlint alone, under the team's options; and no-var, which the team sets nowhere, once, by ESLint", () => {
    expect(findingsOf(runs(), [SOURCE_FILE], [ARRAY_TYPE, NO_VAR])).toStrictEqual({
      [SOURCE_FILE]: { '@typescript-eslint/array-type': ['src/a.ts:2 typescript(array-type)'], 'no-var': ['src/a.ts:3 no-var'] },
    })
  })
})

describe('a rule both of the team\'s configs set, each with options of its own: no-warning-comments', () => {
  const runs = setUpMergedAndTeamAloneCliRuns(
    projectListingOxlint(
      OURS_WARNING_COMMENTS_AND_DEBUGGER,
      { eslintBlockSources: [TEAMS_ESLINT_WARNING_COMMENTS], oxlint: TEAMS_OXLINT_WARNING_COMMENTS },
      { [SOURCE_FILE]: WARNING_COMMENTS_SOURCE },
    ),
    MERGED_AND_TEAM_ALONE,
    [TYPESCRIPT_ESLINT],
  )

  it("is reported by each engine as the team's configs alone report it, none of it ours", () => {
    const { merged, teamAlone } = runs()

    expect(findingsOf(merged, [SOURCE_FILE], [NO_WARNING_COMMENTS])).toStrictEqual(findingsOf(teamAlone, [SOURCE_FILE], [NO_WARNING_COMMENTS]))
  })

  it('is reported where the team\'s ESLint terms draw it, by ESLint, and where its oxlint terms do, by oxlint, and on no line only ours would report', () => {
    expect(findingsOf(runs().merged, [SOURCE_FILE], [NO_WARNING_COMMENTS, NO_DEBUGGER])).toStrictEqual({
      [SOURCE_FILE]: {
        'no-warning-comments': ['src/a.ts:2 no-warning-comments', 'src/a.ts:3 eslint(no-warning-comments)'],
        'no-debugger': ['src/a.ts:5 eslint(no-debugger)'],
      },
    })
  })
})

describe("rules a preset the team's ESLint config spreads sets: typescript-eslint's recommended", () => {
  const runs = setUpMergedAndTeamAloneCliRuns(
    projectListingOxlint(OURS_UNUSED_AND_DEBUGGER, { eslintBlockSources: [TYPESCRIPT_ESLINT_RECOMMENDED], oxlint: EMPTY_TEAM_OXLINT_CONFIG }, { [SOURCE_FILE]: UNUSED_SOURCE }),
    MERGED_AND_TEAM_ALONE,
    [TYPESCRIPT_ESLINT],
  )

  it("report no-unused-vars and no-unused-expressions, ours by oxlint among them, as the team's configs alone report them", () => {
    const { merged, teamAlone } = runs()

    expect(findingsOf(merged, [SOURCE_FILE], [NO_UNUSED_VARS, NO_UNUSED_EXPRESSIONS])).toStrictEqual(
      findingsOf(teamAlone, [SOURCE_FILE], [NO_UNUSED_VARS, NO_UNUSED_EXPRESSIONS]),
    )
  })

  it("report each of them once, by typescript-eslint's twin in ESLint; and no-debugger, which the preset leaves out, once, by oxlint", () => {
    expect(findingsOf(runs().merged, [SOURCE_FILE], [NO_UNUSED_VARS, NO_UNUSED_EXPRESSIONS, NO_DEBUGGER])).toStrictEqual({
      [SOURCE_FILE]: {
        'no-unused-vars': ['src/a.ts:2 @typescript-eslint/no-unused-vars'],
        'no-unused-expressions': ['src/a.ts:3 @typescript-eslint/no-unused-expressions'],
        'no-debugger': ['src/a.ts:4 eslint(no-debugger)'],
      },
    })
  })
})

describe("a rule an object the team's oxlint config extends sets, which ESLint runs for us: no-var", () => {
  const runs = setUpConsumerCliRuns(
    projectListingOxlint(OURS_ARRAY_TYPE_AND_NO_VAR, { eslintBlockSources: [], oxlint: TEAMS_OXLINT_EXTENDING_AN_OBJECT_TURNING_NO_VAR_ON }, { [SOURCE_FILE]: ARRAY_TYPE_SOURCE }),
    CONSUMER_CONFIG_FILES.oxlint,
    [TYPESCRIPT_ESLINT],
  )

  it("is reported by oxlint alone, at the team's severity; and array-type, which the team sets nowhere, once, by ESLint", () => {
    expect(findingsOf(runs(), [SOURCE_FILE], [NO_VAR, ARRAY_TYPE])).toStrictEqual({
      [SOURCE_FILE]: { 'no-var': ['src/a.ts:3 eslint(no-var)'], '@typescript-eslint/array-type': ['src/a.ts:1 @typescript-eslint/array-type'] },
    })
  })
})

describe("array-type, which ESLint runs for us, beside a team oxlint config turning on the style category it is in", () => {
  const listingTypescript = setUpConsumerCliRuns(
    projectListingOxlint(OURS_ARRAY_TYPE_AND_NO_VAR, { eslintBlockSources: [], oxlint: teamsOxlintStyleCategoryListing(['typescript']) }, { [SOURCE_FILE]: ARRAY_TYPE_SOURCE }),
    CONSUMER_CONFIG_FILES.oxlint,
    [TYPESCRIPT_ESLINT],
  )
  const listingUnicorn = setUpConsumerCliRuns(
    projectListingOxlint(OURS_ARRAY_TYPE_AND_NO_VAR, { eslintBlockSources: [], oxlint: teamsOxlintStyleCategoryListing(['unicorn']) }, { [SOURCE_FILE]: ARRAY_TYPE_SOURCE }),
    CONSUMER_CONFIG_FILES.oxlint,
    [TYPESCRIPT_ESLINT],
  )
  const listingTypescriptForLegacyAlone = setUpConsumerCliRuns(
    projectListingOxlint(
      OURS_ARRAY_TYPE_AND_NO_VAR,
      { eslintBlockSources: [], oxlint: teamsOxlintStyleCategoryListingTypescriptForLegacyBeside(['unicorn']) },
      { [SOURCE_FILE]: ARRAY_TYPE_SOURCE, [LEGACY_FILE]: ARRAY_TYPE_SOURCE },
    ),
    CONSUMER_CONFIG_FILES.oxlint,
    [TYPESCRIPT_ESLINT],
  )
  const listingTypescriptForLegacyBesideNoRootPlugin = setUpConsumerCliRuns(
    projectListingOxlint(
      OURS_ARRAY_TYPE_AND_NO_VAR,
      { eslintBlockSources: [], oxlint: teamsOxlintStyleCategoryListingTypescriptForLegacyBeside([]) },
      { [SOURCE_FILE]: ARRAY_TYPE_SOURCE, [LEGACY_FILE]: ARRAY_TYPE_SOURCE },
    ),
    CONSUMER_CONFIG_FILES.oxlint,
    [TYPESCRIPT_ESLINT],
  )

  it("is the team's, reported by oxlint alone under its default options, where the team lists typescript at its root", () => {
    expect(findingsOf(listingTypescript(), [SOURCE_FILE], [ARRAY_TYPE])).toStrictEqual({
      [SOURCE_FILE]: { '@typescript-eslint/array-type': ['src/a.ts:1 typescript(array-type)'] },
    })
  })

  it('stays ours, reported by ESLint alone, where the team lists typescript nowhere, so the category runs none of its rules', () => {
    expect(findingsOf(listingUnicorn(), [SOURCE_FILE], [ARRAY_TYPE])).toStrictEqual({
      [SOURCE_FILE]: { '@typescript-eslint/array-type': ['src/a.ts:1 @typescript-eslint/array-type'] },
    })
  })

  // The category runs array-type in legacy/** alone; outside it the team's setting decides too, so nobody reports it there.
  it("is the team's in every file where one override alone lists typescript beside a root listing unicorn: oxlint's in legacy/**, and nobody's outside it", () => {
    expect(findingsOf(listingTypescriptForLegacyAlone(), [SOURCE_FILE, LEGACY_FILE], [ARRAY_TYPE])).toStrictEqual({
      [SOURCE_FILE]: { '@typescript-eslint/array-type': [] },
      [LEGACY_FILE]: { '@typescript-eslint/array-type': ['legacy/a.ts:1 typescript(array-type)'] },
    })
  })

  // The team writes the category on and lists typescript (spec-merge-model.md, 1.2): the rule is the
  // team's, though under a root listing no plugin oxlint runs the category in no file.
  it("is the team's, and nobody's in any file, where one override alone lists typescript beside a root listing no plugin", () => {
    expect(findingsOf(listingTypescriptForLegacyBesideNoRootPlugin(), [SOURCE_FILE, LEGACY_FILE], [ARRAY_TYPE])).toStrictEqual({
      [SOURCE_FILE]: { '@typescript-eslint/array-type': [] },
      [LEGACY_FILE]: { '@typescript-eslint/array-type': [] },
    })
  })
})

describe("no-unused-vars, a core rule whose typescript-eslint twin counts as the same rule, set by the team under one name in one config", () => {
  const twinInEslint = setUpMergedAndTeamAloneCliRuns(
    projectListingOxlint(OURS_UNUSED_AND_DEBUGGER, { eslintBlockSources: [TEAMS_ESLINT_TWIN_OF_NO_UNUSED_VARS], oxlint: EMPTY_TEAM_OXLINT_CONFIG }, { [SOURCE_FILE]: UNUSED_SOURCE }),
    MERGED_AND_TEAM_ALONE,
    [TYPESCRIPT_ESLINT],
  )
  const coreRuleInOxlint = setUpMergedAndTeamAloneCliRuns(
    projectListingOxlint(OURS_TYPESCRIPT_ESLINT_UNUSED_VARS_AND_DEBUGGER, { eslintBlockSources: [], oxlint: TEAMS_OXLINT_NO_UNUSED_VARS }, { [SOURCE_FILE]: UNUSED_SOURCE }),
    MERGED_AND_TEAM_ALONE,
    [TYPESCRIPT_ESLINT],
  )

  it.each([
    { how: "typescript-eslint's twin in its ESLint config, ours the core rule", runs: twinInEslint, owed: ['src/a.ts:2 @typescript-eslint/no-unused-vars'] },
    { how: 'the core rule in its oxlint config, ours naming the twin', runs: coreRuleInOxlint, owed: ['src/a.ts:2 eslint(no-unused-vars)'] },
  ])("is reported under no name of ours, only as the team's configs alone report it, where the team sets $how", ({ runs, owed }) => {
    const { merged, teamAlone } = runs()

    expect({ merged: findingsOf(merged, [SOURCE_FILE], [NO_UNUSED_VARS]), teamAlone: findingsOf(teamAlone, [SOURCE_FILE], [NO_UNUSED_VARS]) }).toStrictEqual({
      merged: { [SOURCE_FILE]: { 'no-unused-vars': owed } },
      teamAlone: { [SOURCE_FILE]: { 'no-unused-vars': owed } },
    })
  })

  it.each([
    { how: "typescript-eslint's twin in its ESLint config", runs: twinInEslint },
    { how: 'the core rule in its oxlint config', runs: coreRuleInOxlint },
  ])('leaves no-debugger, which the team sets nowhere, reported once, by oxlint, where the team sets $how', ({ runs }) => {
    expect(findingsOf(runs().merged, [SOURCE_FILE], [NO_DEBUGGER])).toStrictEqual({ [SOURCE_FILE]: { 'no-debugger': ['src/a.ts:4 eslint(no-debugger)'] } })
  })
})

describe('rules the team sets in legacy/** alone: no-debugger off in an oxlint override, max-lines in an ESLint block', () => {
  const runs = setUpConsumerCliRuns(
    projectListingOxlint(
      OURS_DEBUGGER_AND_MAX_LINES,
      { eslintBlockSources: [TEAMS_ESLINT_MAX_LINES_IN_LEGACY], oxlint: TEAMS_OXLINT_DEBUGGER_OFF_IN_LEGACY },
      { [TSX_SOURCE_FILE]: DEBUGGER_SOURCE, [LEGACY_TSX_FILE]: DEBUGGER_SOURCE },
    ),
    CONSUMER_CONFIG_FILES.oxlint,
    [TYPESCRIPT_ESLINT],
  )

  // Ours alone reports both rules in src/a.tsx: a merge keeping ours outside the team's files would too.
  it("are the team's in every file: no-debugger reported by nobody, and max-lines by ESLint in legacy/** alone, as the team's block runs it", () => {
    expect(findingsOf(runs(), [TSX_SOURCE_FILE, LEGACY_TSX_FILE], [NO_DEBUGGER, MAX_LINES])).toStrictEqual({
      [TSX_SOURCE_FILE]: { 'no-debugger': [], 'max-lines': [] },
      [LEGACY_TSX_FILE]: { 'no-debugger': [], 'max-lines': ['legacy/a.tsx:3 max-lines'] },
    })
  })
})

describe('no-debugger, which the team sets nowhere', () => {
  const besideOxlint = setUpConsumerCliRuns(
    projectListingOxlint(OURS_DEBUGGER, { eslintBlockSources: [], oxlint: EMPTY_TEAM_OXLINT_CONFIG }, { [SOURCE_FILE]: DEBUGGER_SOURCE }),
    CONSUMER_CONFIG_FILES.oxlint,
    [TYPESCRIPT_ESLINT],
  )
  const withoutOxlint = setUpConsumerEslintCliRun(
    {
      'package.json': packageJsonText(buildPackageJson()),
      ...projectNamingEachConfigText(buildConsumerSettings({}, { rules: OURS_DEBUGGER }), { eslintBlockSources: [], oxlint: null }),
      [SOURCE_FILE]: DEBUGGER_SOURCE,
    },
    [TYPESCRIPT_ESLINT],
  )

  it('is reported once, by oxlint, in a project whose package.json lists oxlint', () => {
    expect(findingsOf(besideOxlint(), [SOURCE_FILE], [NO_DEBUGGER])).toStrictEqual({ [SOURCE_FILE]: { 'no-debugger': ['src/a.ts:2 eslint(no-debugger)'] } })
  })

  it('is reported once, by ESLint, in a project whose package.json lists no oxlint, its ESLint merge naming no oxlint config', () => {
    expect(findingsByFileAndRule(eslintEngineFindingsOf(withoutOxlint()), [SOURCE_FILE], [NO_DEBUGGER])).toStrictEqual({
      [SOURCE_FILE]: { 'no-debugger': ['src/a.ts:2 no-debugger'] },
    })
  })
})

// Only what the team's oxlint config writes counts (decisions.md, "Owner 2026-10-14 (questions on the
// merge rework spec", point 1): oxlint's own correctness: warn, which runs where the config leaves
// correctness out, sets no rule. A category written on sets the rules it runs: correctness, and
// nursery, which runs its nursery rules (measured, oxlint 1.87).
describe("a rule of ours oxlint runs, beside a team oxlint config that leaves its category out, or writes it on", () => {
  const leavingCategoriesOut = setUpMergedAndTeamAloneCliRuns(
    projectListingOxlint(OURS_DEBUGGER, { eslintBlockSources: [], oxlint: TEAMS_OXLINT_LEAVING_EVERY_KEY_OUT }, { [SOURCE_FILE]: DEBUGGER_SOURCE }),
    MERGED_AND_TEAM_ALONE,
    [TYPESCRIPT_ESLINT],
  )
  const writingCorrectnessOn = setUpMergedAndTeamAloneCliRuns(
    projectListingOxlint(OURS_DEBUGGER, { eslintBlockSources: [], oxlint: TEAMS_OXLINT_WRITING_CORRECTNESS_ON }, { [SOURCE_FILE]: DEBUGGER_SOURCE }),
    MERGED_AND_TEAM_ALONE,
    [TYPESCRIPT_ESLINT],
  )
  const writingNurseryOn = setUpMergedAndTeamAloneCliRuns(
    projectListingOxlint(OURS_UNREACHABLE_LOOP, { eslintBlockSources: [], oxlint: TEAMS_OXLINT_WRITING_NURSERY_ON }, { [SOURCE_FILE]: UNREACHABLE_LOOP_SOURCE }),
    MERGED_AND_TEAM_ALONE,
    [TYPESCRIPT_ESLINT],
  )

  it("stays ours where the team's config leaves its categories out: no-debugger reported once, by oxlint at our error, where the team's config alone gives oxlint's warning", () => {
    const { merged, teamAlone } = leavingCategoriesOut()

    expect({
      merged: findingsOf(merged, [SOURCE_FILE], [NO_DEBUGGER]),
      mergedSeverities: oxlintFindingsWithSeverityOf(merged, NO_DEBUGGER),
      teamAloneSeverities: oxlintFindingsWithSeverityOf(teamAlone, NO_DEBUGGER),
    }).toStrictEqual({
      merged: { [SOURCE_FILE]: { 'no-debugger': ['src/a.ts:2 eslint(no-debugger)'] } },
      mergedSeverities: ['src/a.ts:2 eslint(no-debugger) error'],
      teamAloneSeverities: ['src/a.ts:2 eslint(no-debugger) warning'],
    })
  })

  it("is the team's where the team's config writes correctness on: no-debugger reported once, at the warning the team's config alone gives", () => {
    const { merged, teamAlone } = writingCorrectnessOn()

    expect({
      merged: findingsOf(merged, [SOURCE_FILE], [NO_DEBUGGER]),
      mergedSeverities: oxlintFindingsWithSeverityOf(merged, NO_DEBUGGER),
      teamAloneSeverities: oxlintFindingsWithSeverityOf(teamAlone, NO_DEBUGGER),
    }).toStrictEqual({
      merged: { [SOURCE_FILE]: { 'no-debugger': ['src/a.ts:2 eslint(no-debugger)'] } },
      mergedSeverities: ['src/a.ts:2 eslint(no-debugger) warning'],
      teamAloneSeverities: ['src/a.ts:2 eslint(no-debugger) warning'],
    })
  })

  it("is the team's where the team's config writes nursery on: no-unreachable-loop, a nursery rule of oxlint's, reported once, at the warning the team's config alone gives", () => {
    const { merged, teamAlone } = writingNurseryOn()

    expect({
      merged: findingsOf(merged, [SOURCE_FILE], [NO_UNREACHABLE_LOOP]),
      mergedSeverities: oxlintFindingsWithSeverityOf(merged, NO_UNREACHABLE_LOOP),
      teamAloneSeverities: oxlintFindingsWithSeverityOf(teamAlone, NO_UNREACHABLE_LOOP),
    }).toStrictEqual({
      merged: { [SOURCE_FILE]: { 'no-unreachable-loop': ['src/a.ts:2 eslint(no-unreachable-loop)'] } },
      mergedSeverities: ['src/a.ts:2 eslint(no-unreachable-loop) warning'],
      teamAloneSeverities: ['src/a.ts:2 eslint(no-unreachable-loop) warning'],
    })
  })
})

// Where oxlint's own correctness: warn would run its copy of a rule ESLint runs for us, the oxlint
// merge switches that copy off, so the rule is reported once, by ESLint (decisions.md, "Owner
// 2026-10-14 (questions on the merge rework spec", point 1). Where the team writes correctness on,
// the rule is the team's, and ours runs in neither engine.
describe("no-this-alias, which ESLint runs for us, whose oxlint version is in oxlint's correctness category under a default plugin", () => {
  const leavingCategoriesOut = setUpConsumerCliRuns(
    projectListingOxlint(OURS_NO_THIS_ALIAS, { eslintBlockSources: [], oxlint: TEAMS_OXLINT_LEAVING_EVERY_KEY_OUT }, { [SOURCE_FILE]: THIS_ALIAS_SOURCE }),
    CONSUMER_CONFIG_FILES.oxlint,
    [TYPESCRIPT_ESLINT],
  )
  const writingCorrectnessOn = setUpMergedAndTeamAloneCliRuns(
    projectListingOxlint(OURS_NO_THIS_ALIAS, { eslintBlockSources: [], oxlint: TEAMS_OXLINT_WRITING_CORRECTNESS_ON }, { [SOURCE_FILE]: THIS_ALIAS_SOURCE }),
    MERGED_AND_TEAM_ALONE,
    [TYPESCRIPT_ESLINT],
  )

  it("is reported once, by ESLint, where the team's oxlint config leaves its categories out", () => {
    expect(findingsOf(leavingCategoriesOut(), [SOURCE_FILE], [NO_THIS_ALIAS])).toStrictEqual({
      [SOURCE_FILE]: { '@typescript-eslint/no-this-alias': ['src/a.ts:4 @typescript-eslint/no-this-alias'] },
    })
  })

  it("is the team's, reported once, by oxlint, as the team's configs alone report it, where the team's oxlint config writes correctness on", () => {
    const { merged, teamAlone } = writingCorrectnessOn()

    expect({ merged: findingsOf(merged, [SOURCE_FILE], [NO_THIS_ALIAS]), teamAlone: findingsOf(teamAlone, [SOURCE_FILE], [NO_THIS_ALIAS]) }).toStrictEqual({
      merged: { [SOURCE_FILE]: { '@typescript-eslint/no-this-alias': ['src/a.ts:4 typescript(no-this-alias)'] } },
      teamAlone: { [SOURCE_FILE]: { '@typescript-eslint/no-this-alias': ['src/a.ts:4 typescript(no-this-alias)'] } },
    })
  })
})

// The off of oxlint's silent copies reaches the twin of each rule our ESLint part runs: oxlint has no
// copy of typescript-eslint's no-unused-vars, but its silent correctness: warn runs the core
// no-unused-vars, under eslint, which always runs. A silent copy of a rule we run in neither engine
// stays the team's: no-unused-expressions, on line 3, as the team's configs alone report it.
describe("typescript-eslint's no-unused-vars, which ESLint runs for us, whose core twin is in oxlint's correctness category, beside a team oxlint config that leaves its categories out", () => {
  const runs = setUpMergedAndTeamAloneCliRuns(
    projectListingOxlint(OURS_TYPESCRIPT_ESLINT_UNUSED_VARS, { eslintBlockSources: [], oxlint: TEAMS_OXLINT_LEAVING_EVERY_KEY_OUT }, { [SOURCE_FILE]: UNUSED_SOURCE }),
    MERGED_AND_TEAM_ALONE,
    [TYPESCRIPT_ESLINT],
  )

  it("is reported once, by ESLint, and not by oxlint under its twin's name", () => {
    expect(findingsOf(runs().merged, [SOURCE_FILE], [NO_UNUSED_VARS])).toStrictEqual({
      [SOURCE_FILE]: { 'no-unused-vars': ['src/a.ts:2 @typescript-eslint/no-unused-vars'] },
    })
  })

  it("leaves no-unused-expressions, which we run in neither engine, reported as the team's configs alone report it: once, by oxlint", () => {
    const { merged, teamAlone } = runs()

    expect({
      merged: findingsOf(merged, [SOURCE_FILE], [NO_UNUSED_EXPRESSIONS]),
      teamAlone: findingsOf(teamAlone, [SOURCE_FILE], [NO_UNUSED_EXPRESSIONS]),
    }).toStrictEqual({
      merged: { [SOURCE_FILE]: { 'no-unused-expressions': ['src/a.ts:3 eslint(no-unused-expressions)'] } },
      teamAlone: { [SOURCE_FILE]: { 'no-unused-expressions': ['src/a.ts:3 eslint(no-unused-expressions)'] } },
    })
  })
})

// Where the team's root lists plugins, an override listing typescript switches typescript's
// categories on in its files, oxlint's silent correctness: warn included, which the merge writes back
// for the team; the off of the silent copies of the rules our ESLint part runs comes after that, so
// it holds in those files too. The silent copy of a rule we run in neither engine stays the team's:
// no-duplicate-enum-values, in legacy/** alone, as the team's configs alone report it.
describe("no-this-alias, which ESLint runs for us, beside a team oxlint config whose root lists unicorn and whose override lists typescript for legacy/**, its categories left out", () => {
  const runs = setUpMergedAndTeamAloneCliRuns(
    projectListingOxlint(
      OURS_NO_THIS_ALIAS,
      { eslintBlockSources: [], oxlint: teamsOxlintListingTypescriptForLegacyBeside(['unicorn']) },
      { [SOURCE_FILE]: THIS_ALIAS_AND_DUPLICATE_ENUM_SOURCE, [LEGACY_FILE]: THIS_ALIAS_AND_DUPLICATE_ENUM_SOURCE },
    ),
    MERGED_AND_TEAM_ALONE,
    [TYPESCRIPT_ESLINT],
  )

  it("is reported once in each file, by ESLint, in legacy/** too, where the team's listing runs oxlint's copy", () => {
    expect(findingsOf(runs().merged, [SOURCE_FILE, LEGACY_FILE], [NO_THIS_ALIAS])).toStrictEqual({
      [SOURCE_FILE]: { '@typescript-eslint/no-this-alias': ['src/a.ts:4 @typescript-eslint/no-this-alias'] },
      [LEGACY_FILE]: { '@typescript-eslint/no-this-alias': ['legacy/a.ts:4 @typescript-eslint/no-this-alias'] },
    })
  })

  it("leaves no-duplicate-enum-values, which we run in neither engine, reported as the team's configs alone report it: in legacy/** alone, by oxlint", () => {
    const { merged, teamAlone } = runs()

    expect({
      merged: findingsOf(merged, [SOURCE_FILE, LEGACY_FILE], [NO_DUPLICATE_ENUM_VALUES]),
      teamAlone: findingsOf(teamAlone, [SOURCE_FILE, LEGACY_FILE], [NO_DUPLICATE_ENUM_VALUES]),
    }).toStrictEqual({
      merged: {
        [SOURCE_FILE]: { '@typescript-eslint/no-duplicate-enum-values': [] },
        [LEGACY_FILE]: { '@typescript-eslint/no-duplicate-enum-values': ['legacy/a.ts:8 typescript(no-duplicate-enum-values)'] },
      },
      teamAlone: {
        [SOURCE_FILE]: { '@typescript-eslint/no-duplicate-enum-values': [] },
        [LEGACY_FILE]: { '@typescript-eslint/no-duplicate-enum-values': ['legacy/a.ts:8 typescript(no-duplicate-enum-values)'] },
      },
    })
  })
})

// A key under a prefix where the team registers one of our plugins names two rules of ours: one
// under the prefix we register that plugin under, and, by the literal key, the rule of the plugin we
// register under the team's prefix. antfu's config registers @eslint-react under react, where our
// eslint-plugin-react rules sit. Both are the team's (spec-merge-model.md, 1.2, call C1), and the
// oxlint merge reads that from the team's ESLint config too.
describe("eslint-plugin-react's jsx-no-comment-textnodes, which oxlint runs for us, set by a team ESLint block under react, where the team registers @eslint-react", () => {
  const runs = setUpMergedAndTeamAloneCliRuns(
    projectListingOxlint(
      OURS_COMMENT_TEXTNODES_AND_DEBUGGER,
      { eslintBlockSources: [TEAMS_ESLINT_ESLINT_REACT_UNDER_REACT], eslintImports: [ESLINT_REACT_IMPORT], oxlint: EMPTY_TEAM_OXLINT_CONFIG },
      { [TSX_SOURCE_FILE]: COMMENT_AS_JSX_TEXT_AND_DEBUGGER_SOURCE },
    ),
    MERGED_AND_TEAM_ALONE,
    [TYPESCRIPT_ESLINT, ESLINT_REACT],
  )

  it("is reported as the team's configs alone report it: once, by ESLint under the team's key, and by no oxlint rule of ours", () => {
    const { merged, teamAlone } = runs()

    expect({
      merged: findingsOf(merged, [TSX_SOURCE_FILE], [JSX_NO_COMMENT_TEXTNODES]),
      teamAlone: findingsOf(teamAlone, [TSX_SOURCE_FILE], [JSX_NO_COMMENT_TEXTNODES]),
    }).toStrictEqual({
      merged: { [TSX_SOURCE_FILE]: { 'react/jsx-no-comment-textnodes': ['src/a.tsx:1 react/jsx-no-comment-textnodes'] } },
      teamAlone: { [TSX_SOURCE_FILE]: { 'react/jsx-no-comment-textnodes': ['src/a.tsx:1 react/jsx-no-comment-textnodes'] } },
    })
  })

  it('leaves no-debugger, which the team sets nowhere, reported once, by oxlint', () => {
    expect(findingsOf(runs().merged, [TSX_SOURCE_FILE], [NO_DEBUGGER])).toStrictEqual({ [TSX_SOURCE_FILE]: { 'no-debugger': ['src/a.tsx:3 eslint(no-debugger)'] } })
  })
})

describe('no-floating-promises, a typed rule oxlint runs only type-aware, beside a team oxlint config turning its correctness category on as an error', () => {
  const tsconfigAndSource = { 'tsconfig.json': JSON.stringify(buildTsconfig({ include: ['src'] })), [SOURCE_FILE]: FLOATING_PROMISE_SOURCE }
  const leavingTypeAwareOut = setUpConsumerCliRuns(
    projectListingOxlint(OURS_FLOATING_PROMISES, { eslintBlockSources: [], oxlint: teamsOxlintCorrectnessErrors(false) }, tsconfigAndSource),
    CONSUMER_CONFIG_FILES.oxlint,
    [TYPESCRIPT_ESLINT],
  )
  const typeAware = setUpConsumerCliRuns(
    projectListingOxlint(OURS_FLOATING_PROMISES, { eslintBlockSources: [], oxlint: teamsOxlintCorrectnessErrors(true) }, tsconfigAndSource),
    CONSUMER_CONFIG_FILES.oxlint,
    [TYPESCRIPT_ESLINT],
  )

  it('stays ours, reported by ESLint, where the team leaves type-aware rules out', () => {
    expect(findingsByFileAndRule(eslintEngineFindingsOf(leavingTypeAwareOut()), [SOURCE_FILE], [FLOATING_PROMISES])).toStrictEqual({
      [SOURCE_FILE]: { '@typescript-eslint/no-floating-promises': ['src/a.ts:4 @typescript-eslint/no-floating-promises'] },
    })
  })

  // oxlint itself runs type-aware rules only with tsgolint installed, which this project is not given:
  // ESLint's report is the one read.
  it("is the team's, which ESLint no longer reports, where the team's options turn type-aware rules on", () => {
    expect(findingsByFileAndRule(eslintEngineFindingsOf(typeAware()), [SOURCE_FILE], [FLOATING_PROMISES])).toStrictEqual({
      [SOURCE_FILE]: { '@typescript-eslint/no-floating-promises': [] },
    })
  })
})

describe("a rule a team's JSON oxlint config sets through a config it extends by path, read by the ESLint merge", () => {
  const extendingAFile = setUpConsumerCliRuns(
    {
      'package.json': packageJsonText(buildPackageJsonListingOxlint()),
      ...projectNamingEachConfigText(buildConsumerSettings({}, { rules: OURS_ARRAY_TYPE_AND_NO_VAR }), { eslintBlockSources: [], oxlint: null }),
      ...teamsJsonOxlintConfigExtendingByPathFiles('present'),
      [SOURCE_FILE]: ARRAY_TYPE_SOURCE,
    },
    TEAMS_JSON_OXLINT_CONFIG,
    [TYPESCRIPT_ESLINT],
  )
  const extendingNoFile = setUpConsumerCliRuns(
    {
      'package.json': packageJsonText(buildPackageJsonListingOxlint()),
      ...projectNamingEachConfigText(buildConsumerSettings({}, { rules: OURS_ARRAY_TYPE_AND_NO_VAR }), { eslintBlockSources: [], oxlint: null }),
      ...teamsJsonOxlintConfigExtendingByPathFiles('missing'),
      [SOURCE_FILE]: ARRAY_TYPE_SOURCE,
    },
    TEAMS_JSON_OXLINT_CONFIG,
    [TYPESCRIPT_ESLINT],
  )

  it("is the team's, reported by oxlint alone: no-var; and array-type, which the team sets nowhere, once, by ESLint", () => {
    expect(findingsOf(extendingAFile(), [SOURCE_FILE], [NO_VAR, ARRAY_TYPE])).toStrictEqual({
      [SOURCE_FILE]: { 'no-var': ['src/a.ts:3 eslint(no-var)'], '@typescript-eslint/array-type': ['src/a.ts:1 @typescript-eslint/array-type'] },
    })
  })

  it('stops ESLint loading the merged config, naming the oxlint config it could not read, where the path it extends names no file', () => {
    const { eslint, projectDir } = extendingNoFile()

    expect(eslint.outcome === 'refused' ? eslint.output : 'ESLint loaded the config').toContain(
      `eslint.config.mjs: could not read your oxlint config at ${projectDir}/${TEAMS_JSON_OXLINT_CONFIG}: `,
    )
  })
})

// A documented limit (spec-merge-model.md, 1.2): each merge reads what is handed to the merge in the
// other config, so a block a team adds to eslint.config.mjs after the merge is out of the oxlint
// merge's sight.
describe("no-debugger, which the team turns off in a block its eslint.config.mjs adds after our merge, rather than handing it to the merge", () => {
  const runs = setUpConsumerCliRuns(
    {
      ...projectListingOxlint(OURS_DEBUGGER, { eslintBlockSources: [], oxlint: EMPTY_TEAM_OXLINT_CONFIG }, { [SOURCE_FILE]: DEBUGGER_SOURCE }),
      [CONSUMER_CONFIG_FILES.eslint]: eslintConfigAddingABlockAfterTheMergeText(
        CONSUMER_CONFIG_FILES.lintRules,
        CONSUMER_CONFIG_FILES.teamEslintModule,
        { oxlintConfig: CONSUMER_CONFIG_FILES.oxlint },
        BLOCK_TURNING_NO_DEBUGGER_OFF,
      ),
    },
    CONSUMER_CONFIG_FILES.oxlint,
    [TYPESCRIPT_ESLINT],
  )
  let findings: FindingsByFileAndRule = {}

  beforeAll(() => {
    findings = findingsOf(runs(), [SOURCE_FILE], [NO_DEBUGGER])
  })

  it('is linted by ESLint with no fatal message', () => {
    expect(eslintFatalMessagesOf(runs())).toStrictEqual([])
  })

  // KNOWN GAP: the documented limit above. The team's config turns no-debugger off, so the model owes
  // it the team's; but the oxlint merge reads only the config handed to the ESLint merge, and runs
  // ours.
  it.fails("is the team's, which nobody reports", () => {
    expect(findings).toStrictEqual({ [SOURCE_FILE]: { 'no-debugger': [] } })
  })
})
