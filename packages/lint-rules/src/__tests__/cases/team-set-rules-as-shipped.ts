import type { Linter } from 'eslint'
import type { OxlintConfig } from 'oxlint'
import { moduleText } from '../factories/check-factories.ts'
import { A_DEPRECATED_CONSTANT_PASSED_ON, A_TYPE_PASSED_ON_AS_A_VALUE, RE_EXPORTING_ITSELF } from './check-sources.ts'
import { FILES_A_WITHHELD_FIX_WOULD_CHANGE, FILES_A_WITHHELD_RULE_SUGGESTS_A_REWRITE_IN } from './editor-withheld-fix-sources.ts'
import { CLASS_LIST } from './routed-to-eslint-check-sources.ts'
import { tsIgnore } from './suppression-comments.ts'

export type ReportedFile = { readonly file: string; readonly source: string; readonly line: number; readonly rule: string }

type RuleNoPluginDefines = { readonly names: string; readonly rule: string; readonly registersItsPluginItself: boolean; readonly prefixesRegisteredAlone: readonly string[] }

const SINGLE_CALL = 'unicorn/prefer-single-call'
const TS_COMMENT_BAN = '@typescript-eslint/ban-ts-comment'
const IN_DOCUMENT = 'jest-dom/prefer-in-document'
const NEW_WRAPPERS = 'no-new-wrappers'
export const JSDOC_REQUIRE_PARAM = 'jsdoc/require-param'
// unicorn's former name of no-for-each, which oxlint still spells and the unicorn we install lacks.
const UNICORN_ARRAY_FOR_EACH = 'unicorn/no-array-for-each'

/** Our editor rulesets: the quality rulesets running prefer-single-call, and jest-dom running prefer-in-document, both with their fixes withheld. */
export const EDITOR_RULESETS_RUNNING_WITHHELD_RULES = {
  editorRulesets: { quality: ['correctness', 'tests', 'modern-js', 'redundancy'], libs: { testing: ['jest-dom'] } },
} as const

/** As the team's own ESLint config sets them: prefer-single-call, whose fix check withholds, and ban-ts-comment banning @ts-expect-error too, whose message our copy rewrites. */
export const RULES_THE_TEAM_SETS: Readonly<Linter.RulesRecord> = {
  [SINGLE_CALL]: 'error',
  [TS_COMMENT_BAN]: ['error', { 'ts-expect-error': true }],
}

/** The prefixes of RULES_THE_TEAM_SETS, whose plugins the team's config alone registers as they ship. */
export const PREFIXES_OF_THE_RULES_THE_TEAM_SETS: readonly string[] = ['unicorn', '@typescript-eslint']

export const TS_IGNORE_FILE: ReportedFile = { file: 'src/ts-ignore.ts', source: tsIgnore, line: 1, rule: TS_COMMENT_BAN }

/** Each file a rule the team sets reports: prefer-single-call with a fix, and with a suggestion; ban-ts-comment with a suggestion. */
export const FILES_A_RULE_THE_TEAM_SETS_REPORTS: readonly ReportedFile[] = [
  { file: CLASS_LIST.file, source: CLASS_LIST.source, line: 3, rule: SINGLE_CALL },
  ...FILES_A_WITHHELD_RULE_SUGGESTS_A_REWRITE_IN.filter(({ rule }) => rule === SINGLE_CALL),
  TS_IGNORE_FILE,
]

/** Each file prefer-in-document reports, which the team sets nowhere, with a fix or a suggestion as its plugin ships it. */
export const FILES_OUR_WITHHELD_RULE_REPORTS: readonly ReportedFile[] = [
  ...FILES_A_WITHHELD_FIX_WOULD_CHANGE.filter(({ rule }) => rule === IN_DOCUMENT),
  ...FILES_A_WITHHELD_RULE_SUGGESTS_A_REWRITE_IN.filter(({ rule }) => rule === IN_DOCUMENT),
]

/** Each refused by ESLint in the team's config alone; beside oxlint, our merge registers a do-nothing rule under each name. */
export const RULES_NO_PLUGIN_DEFINES: readonly RuleNoPluginDefines[] = [
  { names: 'a jsdoc rule, whose plugin nobody registers', rule: JSDOC_REQUIRE_PARAM, registersItsPluginItself: false, prefixesRegisteredAlone: [] },
  {
    names: "a name unicorn's plugin lacks, the team relying on our unicorn",
    rule: UNICORN_ARRAY_FOR_EACH,
    registersItsPluginItself: false,
    prefixesRegisteredAlone: ['unicorn'],
  },
  {
    names: "a name unicorn's plugin lacks, the team registering unicorn itself",
    rule: UNICORN_ARRAY_FOR_EACH,
    registersItsPluginItself: true,
    prefixesRegisteredAlone: ['unicorn'],
  },
]

export const A_FILE_ANY_CONFIG_LINTS = { file: 'src/add.ts', source: moduleText('export function add(first: number, second: number) {', '  return first + second', '}') }

/** A suppression of a rule only oxlint runs for us, which loads in ESLint through our do-nothing rule. */
export const SUPPRESSION_OF_A_JSDOC_RULE = {
  file: 'src/add-described.ts',
  source: moduleText(`// eslint-disable-next-line ${JSDOC_REQUIRE_PARAM}`, '/** Adds. */', 'export function add(first: number) {', '  return first', '}'),
}

/** no-new-wrappers, whose fix check withholds and which ESLint takes over from oxlint for us, as the team's own oxlint config sets it. */
export const TEAMS_OXLINT_CONFIG_SETTING_NEW_WRAPPERS: OxlintConfig = { rules: { [NEW_WRAPPERS]: 'error' } }

export const NEW_WRAPPERS_NAMES: readonly string[] = [NEW_WRAPPERS, `eslint(${NEW_WRAPPERS})`]

/** no-new-wrappers reports line 2; its fix drops the `new`. */
export const NEW_BOOLEAN_FILE: ReportedFile = {
  file: 'src/feature-label.ts',
  source: moduleText('export function featureLabel(raw: string) {', "  const enabled = new Boolean(raw === 'yes')", "  return enabled ? 'on' : 'off'", '}'),
  line: 2,
  rule: NEW_WRAPPERS,
}

export const NEW_BOOLEAN_FILE_FIXED_BY_THE_TEAM_ALONE = { file: 'src/feature-label-alone.ts', source: NEW_BOOLEAN_FILE.source }

/** prefer-single-call, ours beside the team's oxlint config, its fix withheld. */
export const OUR_SINGLE_CALL_FILE = { file: CLASS_LIST.file, source: CLASS_LIST.source }

/** typescript-eslint's rules whose copies in the plugin our merge registers end on a re-export cycle, where the plugin as shipped never ends or overflows its stack (8.71). */
export const RULES_THE_TEAM_SETS_UNDER_OUR_REPAIRED_COPIES: Readonly<Linter.RulesRecord> = {
  '@typescript-eslint/consistent-type-exports': 'error',
  '@typescript-eslint/no-deprecated': 'error',
}

/** A file re-exporting a name from itself, beside a deprecated name passed on and a type passed on as a value. */
export const FILES_BESIDE_A_RE_EXPORT_CYCLE: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries({ [RE_EXPORTING_ITSELF.file]: RE_EXPORTING_ITSELF.lines, ...A_DEPRECATED_CONSTANT_PASSED_ON, ...A_TYPE_PASSED_ON_AS_A_VALUE }).map(([file, lines]) => [
    file,
    moduleText(...lines),
  ]),
)

/** What those rules report there, as `file:line rule`, in path order: nothing in the file re-exporting from itself. */
export const REPORTS_BESIDE_A_RE_EXPORT_CYCLE: readonly string[] = [
  'src/passed-on.ts:1 @typescript-eslint/no-deprecated',
  'src/read.ts:3 @typescript-eslint/no-deprecated',
  'src/shape-passed-on.ts:1 @typescript-eslint/consistent-type-exports',
]

/** react-hook-form's no-use-watch reports line 5; eslint-plugin-react-hook-form 0.3.1 calls context.getScope, which ESLint 10 removed. */
export const A_FORM_WATCHING_A_FIELD: ReportedFile = {
  file: 'src/form.ts',
  source: moduleText("import { useForm } from 'react-hook-form'", '', 'export function Form() {', '  const form = useForm()', "  return form.watch('name')", '}'),
  line: 5,
  rule: 'react-hook-form/no-use-watch',
}
