import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { oxlintCliOutputIn } from '@workspace/rule-data/test-support/oxlint-cli'
import { ESLint, type Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import { agentConfigsOf } from './__tests__/agent-configs.ts'
import {
  A_FILE_ANY_CONFIG_LINTS,
  A_FORM_WATCHING_A_FIELD,
  EDITOR_RULESETS_RUNNING_WITHHELD_RULES,
  FILES_A_RULE_THE_TEAM_SETS_REPORTS,
  FILES_BESIDE_A_RE_EXPORT_CYCLE,
  FILES_OUR_WITHHELD_RULE_REPORTS,
  JSDOC_REQUIRE_PARAM,
  NEW_BOOLEAN_FILE,
  NEW_BOOLEAN_FILE_FIXED_BY_THE_TEAM_ALONE,
  NEW_WRAPPERS_NAMES,
  OUR_SINGLE_CALL_FILE,
  PREFIXES_OF_THE_RULES_THE_TEAM_SETS,
  type ReportedFile,
  REPORTS_BESIDE_A_RE_EXPORT_CYCLE,
  RULES_NO_PLUGIN_DEFINES,
  RULES_THE_TEAM_SETS,
  RULES_THE_TEAM_SETS_UNDER_OUR_REPAIRED_COPIES,
  SUPPRESSION_OF_A_JSDOC_RULE,
  TEAMS_OXLINT_CONFIG_SETTING_NEW_WRAPPERS,
  TS_IGNORE_FILE,
} from './__tests__/cases/team-set-rules-as-shipped.ts'
import { writeOxlintConfigFile } from './__tests__/engine-clis.ts'
import { setUpEngineRun } from './__tests__/engine-run.ts'
import { packageTsconfigText, TAKING_IN_SRC } from './__tests__/factories/check-factories.ts'
import { buildEditorBuild } from './__tests__/factories/engine-build-factories.ts'
import { buildConsumerLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildPackageJsonListingOthers, buildPackageJsonListingOxlint, packageJsonText } from './__tests__/factories/package-json-factories.ts'
import { buildTeamBlockSettingRules, buildTeamConfigAlone } from './__tests__/factories/team-set-rule-factories.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { projectPathOf } from './__tests__/project-paths.ts'
import { rulesNotFoundAmong } from './__tests__/rules-not-found.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { type ProjectFiles, textsOf } from './__tests__/temp-projects.ts'
import { mergeEslintConfig } from './eslint.ts'
import { defineLintRules } from './index.ts'

// A rule the team's own ESLint or oxlint config sets is the team's: merged with ours, it reports, fixes,
// suggests and words its message as the team's config alone does. Each case sits beside a rule of ours
// the same handling still reaches. Our crash repairs reach it too, where its plugin as shipped stops ESLint.

allowEveryTestForParallelLoad()

/** One report as an editor offers it: a fix applies on save, a suggestion is listed in the quick-fix menu. */
type Offered = { readonly line: number; readonly message: string; readonly fix: string | null; readonly suggestions: readonly string[] }

/** ESLint's messages over the files linted, by path, or the error it refused the config with. */
type Linted = { readonly refused: false; readonly messages: Readonly<Record<string, readonly Linter.LintMessage[]>> } | { readonly refused: true; readonly why: string }

type MergedAndAlone = { readonly merged: Linted; readonly teamAlone: Linted }

/** A project our editor rulesets run prefer-single-call and prefer-in-document in, and how the team's config registers the plugins of the rules it sets. */
type TeamSettingRules = { readonly project: string; readonly packageJson: string; readonly registration: string; readonly registersItsPluginsItself: boolean }

const FIXTURES_DIR = fileURLToPath(new URL('../test-fixtures/editor-withheld-fixes', import.meta.url))
const LISTING_OXLINT = packageJsonText(buildPackageJsonListingOxlint())
const LISTING_NO_OXLINT = packageJsonText(buildPackageJsonListingOthers())
const NO_TEAM_OXLINT_CONFIG = { oxlintConfig: null }
const TEAM_SETTING_RULES: readonly TeamSettingRules[] = [
  { project: 'listing no oxlint', packageJson: LISTING_NO_OXLINT, registration: 'relying on the plugins our merge registers', registersItsPluginsItself: false },
  { project: 'listing no oxlint', packageJson: LISTING_NO_OXLINT, registration: 'registering each plugin itself', registersItsPluginsItself: true },
  { project: 'listing oxlint', packageJson: LISTING_OXLINT, registration: 'relying on the plugins our merge registers', registersItsPluginsItself: false },
  { project: 'listing oxlint', packageJson: LISTING_OXLINT, registration: 'registering each plugin itself', registersItsPluginsItself: true },
]
const IN_DOCUMENT = 'jest-dom/prefer-in-document'
const TS_COMMENT_BAN = '@typescript-eslint/ban-ts-comment'
const THE_OTHER_COMMENT = '@ts-expect-error'
const FIX_THE_TYPE_ERROR = /\bfix\b.+\btype error\b/iu
const NO_GET_SCOPE = /context\.getScope is not a function/u
// A name no engine finds by itself, so only the run naming it reads it.
const TEAM_ALONE_OXLINT_CONFIG = 'team-alone.oxlintrc.json'
const FIX_RUN_OXLINT_CONFIG = 'fix-on-save.oxlintrc.json'

function filesOf(reported: ReadonlyArray<Pick<ReportedFile, 'file' | 'source'>>): ProjectFiles {
  return Object.fromEntries(reported.map(({ file, source }) => [file, source]))
}

/** Over the files given, from the project folder, with no config file of the project's own. */
async function lintedWith(projectDir: string, config: readonly Linter.Config[], files: readonly string[]): Promise<Linted> {
  try {
    const eslint = new ESLint({ cwd: projectDir, overrideConfigFile: true, overrideConfig: [...config] })
    const results = await eslint.lintFiles(files.map((file) => join(projectDir, file)))
    return { refused: false, messages: Object.fromEntries(results.map(({ filePath, messages }) => [projectPathOf(filePath, projectDir), messages])) }
  } catch (error) {
    return { refused: true, why: String(error) }
  }
}

function messagesOn(linted: Linted, file: string): readonly Linter.LintMessage[] {
  if (linted.refused) throw new Error(`ESLint refused the config: ${linted.why}`)
  const messages = linted.messages[file]
  if (messages === undefined) throw new Error(`ESLint did not lint ${file}`)
  return messages
}

function offersOf(linted: Linted, { file, rule }: Pick<ReportedFile, 'file' | 'rule'>): Offered[] {
  return messagesOn(linted, file)
    .filter(({ ruleId }) => ruleId === rule)
    .map(({ line, message, fix, suggestions }) => ({
      line,
      message,
      fix: fix === undefined ? null : fix.text,
      suggestions: suggestions === undefined ? [] : suggestions.map(({ desc, fix: rewrite }) => `${desc}: ${rewrite.text}`),
    }))
}

/** Each report of the rules given, as `file:line rule`, in path order, and each fatal message. */
function reportsOf(linted: Linted, rules: Readonly<Linter.RulesRecord>): { readonly reports: string[]; readonly fatal: string[] } {
  if (linted.refused) throw new Error(`ESLint refused the config: ${linted.why}`)
  const messagesByFile = Object.entries(linted.messages).toSorted(([first], [second]) => (first < second ? -1 : 1))
  return {
    reports: messagesByFile.flatMap(([file, messages]) =>
      messages.filter(({ ruleId }) => ruleId !== null && Object.hasOwn(rules, ruleId)).map(({ line, ruleId }) => `${file}:${line} ${String(ruleId)}`),
    ),
    fatal: messagesByFile.flatMap(([file, messages]) => messages.filter(({ fatal }) => fatal === true).map(({ message }) => `${file}: ${message}`)),
  }
}

function offersARewrite({ fix, suggestions }: Offered): boolean {
  return fix !== null || suggestions.length > 0
}

/** The editor set's ESLint part, merged into the team's config beside no oxlint config of the team's. */
// eslint-disable-next-line functional/prefer-immutable-types -- TS2345 as Readonly: mergeEslintConfig takes the team's config as a mutable InfiniteArray<ConfigWithExtends>
function mergedInto(teamConfig: Linter.Config[], projectDir: string): Linter.Config[] {
  return mergeEslintConfig(teamConfig, defineLintRules(buildConsumerLintRules(projectDir, EDITOR_RULESETS_RUNNING_WITHHELD_RULES)).editorRulesets.eslint, NO_TEAM_OXLINT_CONFIG)
}

describe.each(TEAM_SETTING_RULES)("rules the team's own ESLint config sets, $registration, in a project $project, beside our editor rulesets running them", (setting) => {
  const files = filesOf([...FILES_A_RULE_THE_TEAM_SETS_REPORTS, ...FILES_OUR_WITHHELD_RULE_REPORTS])
  const runs = setUpRunsBeforeTheSuite(async (tempProjects) => {
    const projectDir = tempProjects.create({ files: { ...files, 'package.json': setting.packageJson } })
    const teamBlock = buildTeamBlockSettingRules(RULES_THE_TEAM_SETS, setting.registersItsPluginsItself ? PREFIXES_OF_THE_RULES_THE_TEAM_SETS : [])
    const shippedInDocument = buildTeamBlockSettingRules({ [IN_DOCUMENT]: 'error' }, [])
    return {
      merged: await lintedWith(projectDir, mergedInto([teamBlock], projectDir), Object.keys(files)),
      teamAlone: await lintedWith(projectDir, buildTeamConfigAlone([teamBlock], PREFIXES_OF_THE_RULES_THE_TEAM_SETS), Object.keys(files)),
      inDocumentAsShipped: await lintedWith(projectDir, buildTeamConfigAlone([shippedInDocument], ['jest-dom']), Object.keys(files)),
    }
  })

  it.each(FILES_A_RULE_THE_TEAM_SETS_REPORTS)("reports $rule on line $line of $file as the team's config alone does: its message, fix and suggestions", (reported) => {
    const { merged, teamAlone } = runs()

    expect({ merged: offersOf(merged, reported), linesReportedAlone: offersOf(teamAlone, reported).map(({ line }) => line) }).toStrictEqual({
      merged: offersOf(teamAlone, reported),
      linesReportedAlone: [reported.line],
    })
  })

  it.each(FILES_OUR_WITHHELD_RULE_REPORTS)('reports $rule on line $line of $file, which the team sets nowhere, offering no rewrite where its plugin offers one', (reported) => {
    const { merged, inDocumentAsShipped } = runs()

    expect({
      merged: offersOf(merged, reported).map(({ line, fix, suggestions }) => ({ line, fix, suggestions })),
      offeredAsShipped: offersOf(inDocumentAsShipped, reported).map(offersARewrite),
    }).toStrictEqual({ merged: [{ line: reported.line, fix: null, suggestions: [] }], offeredAsShipped: [true] })
  })
})

describe('the agent build, as check runs it, on a @ts-ignore outside test files, suppressions banned as shipped', () => {
  const runs = setUpRunsBeforeTheSuite(async (tempProjects) => {
    const projectDir = tempProjects.create({ files: { [TS_IGNORE_FILE.file]: TS_IGNORE_FILE.source, 'package.json': LISTING_NO_OXLINT } })
    return { agent: await lintedWith(projectDir, agentConfigsOf(defineLintRules(buildConsumerLintRules(projectDir, {}))).eslint, [TS_IGNORE_FILE.file]) }
  })

  it('tells the reader of our ban-ts-comment to fix the type error, and not to use the @ts-expect-error it bans there too', () => {
    const messages = offersOf(runs().agent, { file: TS_IGNORE_FILE.file, rule: TS_COMMENT_BAN }).map(({ message }) => ({
      saysToFixTheTypeError: FIX_THE_TYPE_ERROR.test(message),
      namesTheOtherComment: message.includes(THE_OTHER_COMMENT),
    }))

    expect(messages).toStrictEqual([{ saysToFixTheTypeError: true, namesTheOtherComment: false }])
  })
})

describe.each(RULES_NO_PLUGIN_DEFINES)("$rule turned on by the team's own ESLint config, $names, in a project listing oxlint", (named) => {
  const runs = setUpRunsBeforeTheSuite(async (tempProjects): Promise<MergedAndAlone> => {
    const projectDir = tempProjects.create({ files: { [A_FILE_ANY_CONFIG_LINTS.file]: A_FILE_ANY_CONFIG_LINTS.source, 'package.json': LISTING_OXLINT } })
    const teamBlock = buildTeamBlockSettingRules({ [named.rule]: 'error' }, named.registersItsPluginItself ? named.prefixesRegisteredAlone : [])
    return {
      merged: await lintedWith(projectDir, mergedInto([teamBlock], projectDir), [A_FILE_ANY_CONFIG_LINTS.file]),
      teamAlone: await lintedWith(projectDir, buildTeamConfigAlone([teamBlock], named.prefixesRegisteredAlone), [A_FILE_ANY_CONFIG_LINTS.file]),
    }
  })

  it("is refused by ESLint as the team's config alone is refused", () => {
    const { merged, teamAlone } = runs()

    expect({ merged, refusedAlone: teamAlone.refused }).toStrictEqual({ merged: teamAlone, refusedAlone: true })
  })
})

describe("jsdoc's require-param, which oxlint runs for us, beside a team's own ESLint config in a project listing oxlint that does not turn it on", () => {
  const files = filesOf([A_FILE_ANY_CONFIG_LINTS, SUPPRESSION_OF_A_JSDOC_RULE])
  const runs = setUpRunsBeforeTheSuite(async (tempProjects) => {
    const projectDir = tempProjects.create({ files: { ...files, 'package.json': LISTING_OXLINT } })
    const turningItOff = buildTeamBlockSettingRules({ [JSDOC_REQUIRE_PARAM]: 'off' }, [])
    return {
      turnedOff: await lintedWith(projectDir, mergedInto([turningItOff], projectDir), Object.keys(files)),
      turnedOffAlone: await lintedWith(projectDir, buildTeamConfigAlone([turningItOff], []), Object.keys(files)),
      setNowhere: await lintedWith(projectDir, mergedInto([], projectDir), Object.keys(files)),
    }
  })

  it("loads where the team turns it off, as the team's config alone loads, and reports nothing under it", () => {
    const { turnedOff, turnedOffAlone } = runs()

    expect({
      merged: messagesOn(turnedOff, A_FILE_ANY_CONFIG_LINTS.file).filter(({ ruleId }) => ruleId === JSDOC_REQUIRE_PARAM),
      refusedAlone: turnedOffAlone.refused,
    }).toStrictEqual({ merged: [], refusedAlone: false })
  })

  it('lets a suppression of it load, through our do-nothing rule, where the team sets it nowhere', () => {
    expect(rulesNotFoundAmong(messagesOn(runs().setNowhere, SUPPRESSION_OF_A_JSDOC_RULE.file))).toStrictEqual([])
  })
})

describe("no-new-wrappers, whose fix check withholds, set by the team's own oxlint config, in a project listing oxlint, beside our editor rulesets running it", () => {
  const editor = setUpEngineRun(
    FIXTURES_DIR,
    (projectDir) => defineLintRules(buildConsumerLintRules(projectDir, EDITOR_RULESETS_RUNNING_WITHHELD_RULES)),
    { ...filesOf([NEW_BOOLEAN_FILE, NEW_BOOLEAN_FILE_FIXED_BY_THE_TEAM_ALONE, OUR_SINGLE_CALL_FILE]), 'package.json': LISTING_OXLINT },
    buildEditorBuild({ teamOxlintConfig: TEAMS_OXLINT_CONFIG_SETTING_NEW_WRAPPERS }),
  )
  const saved = setUpRunsBeforeTheSuite(async () => {
    const projectDir = editor.projectDir()
    const mergedFiles = [NEW_BOOLEAN_FILE.file, OUR_SINGLE_CALL_FILE.file]
    writeOxlintConfigFile(projectDir, FIX_RUN_OXLINT_CONFIG, editor.emittedOxlintConfig())
    oxlintCliOutputIn(projectDir, ['-c', FIX_RUN_OXLINT_CONFIG, '--fix', ...mergedFiles])
    const eslint = new ESLint({ cwd: projectDir, overrideConfigFile: true, overrideConfig: [...editor.emittedEslintConfig()], fix: true })
    await ESLint.outputFixes(await eslint.lintFiles(mergedFiles.map((file) => join(projectDir, file))))
    writeOxlintConfigFile(projectDir, TEAM_ALONE_OXLINT_CONFIG, TEAMS_OXLINT_CONFIG_SETTING_NEW_WRAPPERS)
    oxlintCliOutputIn(projectDir, ['-c', TEAM_ALONE_OXLINT_CONFIG, '--fix', NEW_BOOLEAN_FILE_FIXED_BY_THE_TEAM_ALONE.file])
    return { merged: textsOf(projectDir, mergedFiles), teamAlone: textsOf(projectDir, [NEW_BOOLEAN_FILE_FIXED_BY_THE_TEAM_ALONE.file]) }
  })

  it("is reported once, by oxlint at the team's setting, and by no rule of ours in ESLint", () => {
    expect(editor.errorsOn(NEW_BOOLEAN_FILE.file).filter(({ rule }) => rule !== null && NEW_WRAPPERS_NAMES.includes(rule))).toStrictEqual([
      { engine: 'oxlint', rule: 'eslint(no-new-wrappers)', line: NEW_BOOLEAN_FILE.line },
    ])
  })

  it("is fixed on save by both engines as the team's oxlint config alone fixes it, while prefer-single-call, ours, keeps its line", () => {
    const { merged, teamAlone } = saved()
    const fixedAlone = teamAlone[NEW_BOOLEAN_FILE_FIXED_BY_THE_TEAM_ALONE.file]

    expect({ merged, aloneChangedIt: fixedAlone !== NEW_BOOLEAN_FILE.source }).toStrictEqual({
      merged: { [NEW_BOOLEAN_FILE.file]: fixedAlone, [OUR_SINGLE_CALL_FILE.file]: OUR_SINGLE_CALL_FILE.source },
      aloneChangedIt: true,
    })
  })
})

describe("typescript-eslint's no-deprecated and consistent-type-exports, set by the team's own ESLint config relying on the plugins our merge registers, beside a file re-exporting a name from itself", () => {
  const merged = setUpRunsBeforeTheSuite(async (tempProjects) => {
    const projectDir = tempProjects.create({
      files: { ...FILES_BESIDE_A_RE_EXPORT_CYCLE, 'package.json': LISTING_NO_OXLINT, 'tsconfig.json': packageTsconfigText(TAKING_IN_SRC) },
    })
    const teamBlock = buildTeamBlockSettingRules(RULES_THE_TEAM_SETS_UNDER_OUR_REPAIRED_COPIES, [])
    return lintedWith(projectDir, mergedInto([teamBlock], projectDir), Object.keys(FILES_BESIDE_A_RE_EXPORT_CYCLE))
  })

  it('ends, reporting the deprecated name where it is passed on and where it is read, and the type passed on as a value, with no fatal message', () => {
    expect(reportsOf(merged(), RULES_THE_TEAM_SETS_UNDER_OUR_REPAIRED_COPIES)).toStrictEqual({ reports: REPORTS_BESIDE_A_RE_EXPORT_CYCLE, fatal: [] })
  })
})

describe("react-hook-form's no-use-watch, set by the team's own ESLint config registering eslint-plugin-react-hook-form itself", () => {
  const runs = setUpRunsBeforeTheSuite(async (tempProjects) => {
    const { file, source, rule } = A_FORM_WATCHING_A_FIELD
    const projectDir = tempProjects.create({ files: { [file]: source, 'package.json': LISTING_NO_OXLINT } })
    const teamBlock = buildTeamBlockSettingRules({ [rule]: 'error' }, ['react-hook-form'])
    return {
      merged: await lintedWith(projectDir, mergedInto([teamBlock], projectDir), [file]),
      teamAlone: await lintedWith(projectDir, buildTeamConfigAlone([teamBlock], ['react-hook-form']), [file]),
    }
  })

  it("is reported on its line through the compat layer our merge gives the plugin, where the team's config alone stops ESLint", () => {
    const { merged, teamAlone } = runs()

    expect({
      merged: offersOf(merged, A_FORM_WATCHING_A_FIELD).map(({ line }) => line),
      teamAloneStopsWithoutGetScope: teamAlone.refused && NO_GET_SCOPE.test(teamAlone.why),
    }).toStrictEqual({ merged: [A_FORM_WATCHING_A_FIELD.line], teamAloneStopsWithoutGetScope: true })
  })
})
