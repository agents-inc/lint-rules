import { describe, expect, it } from 'vitest'
import { INSTALLED_TYPES_NODE, type ProcessResult, typeCheck } from './__tests__/config-file-loads.ts'
import { CONFIG_FILE } from './__tests__/factories/check-factories.ts'
import {
  buildFileOverridesModule,
  type FileOverridesModule,
  fileOverridesModuleText,
  positionAtTopLevel,
  positionInEntry,
  type SourcePosition,
} from './__tests__/factories/file-overrides-module-factories.ts'
import { buildTsconfigListingNodeTypes } from './__tests__/factories/tsconfig-factories.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { CONSUMER_INSTALL, type TempProjects } from './__tests__/temp-projects.ts'
import { tscErrorsIn } from './__tests__/tsc-errors.ts'

// What a team's tsc, and any editor running TypeScript, says of a rule ID, a libs domain or a tsconfigRootDir no
// check of ours refuses at run time: the error is the refusal, read from the published types in dist (built first),
// as a consumer installs them. TypeScript refuses an unknown key only in an object written in place, so these hold
// rules and libs in a const beside a name the types take.

const SAYS_NO_SUCH_RULE = 'no shipped rule is called not-a/rule'
const SAYS_ALLOW_SUPPRESSIONS_SETS_IT = 'house/no-suppressions is set by allowSuppressions'
const SAYS_NO_SUCH_LIBS_DOMAIN = 'no libs domain is called database'
const SAYS_TO_WRITE_AN_ABSOLUTE_PATH = 'tsconfigRootDir is an absolute path: write import.meta.dirname'
const TYPE_NOT_ASSIGNABLE = 'TS2322'
// tsc exits 2 where it reports errors and emits nothing.
const TSC_REPORTED_ERRORS = 2
const TSC_RUN_TIMEOUT_MS = 120_000

const RULES_HELD_BESIDE_AN_UNKNOWN_ID = buildFileOverridesModule({
  declarations: ["const RULES = { 'no-debugger': 'off', 'not-a/rule': 'error' } as const"],
  topLevel: ['rules: RULES'],
})
const SUPPRESSION_RULE_HELD_FOR_AN_ENTRY = buildFileOverridesModule({
  declarations: ["const LEGACY_RULES = { 'no-debugger': 'off', 'house/no-suppressions': 'off' } as const"],
  entries: ["{ files: ['legacy/**'], rules: LEGACY_RULES }"],
})
const LIBS_HELD_BESIDE_AN_UNKNOWN_DOMAIN = buildFileOverridesModule({
  declarations: ["const LIBS = { ui: ['react'], database: ['react'] } as const"],
  agentRulesets: '{ libs: LIBS }',
})
const RELATIVE_ROOT = buildFileOverridesModule({ tsconfigRootDir: "'.'" })

// Each beside a refusal above: names the types take, held the same way, and a root written out on each platform. A
// relative root held in a string is not judged by the types; the check run as the config loads refuses it.
const NAMES_THE_TYPES_TAKE_HELD_IN_CONSTS = buildFileOverridesModule({
  declarations: [
    "const RULES = { 'no-debugger': 'off', 'max-lines': ['error', { max: 400 }] } as const",
    "const LIBS = { ui: ['react'], testing: ['vitest'] } as const",
  ],
  agentRulesets: '{ libs: LIBS }',
  entries: ["{ files: ['legacy/**'], rules: RULES, editorRulesets: { libs: LIBS } }"],
  topLevel: ['rules: RULES'],
})
const ROOTS_THE_TYPES_TAKE: Readonly<Record<string, FileOverridesModule>> = {
  'posix-root.mts': buildFileOverridesModule({ tsconfigRootDir: "'/repo/app'" }),
  'windows-drive-root.mts': buildFileOverridesModule({ tsconfigRootDir: String.raw`'C:\\work\\app'` }),
  'windows-share-root.mts': buildFileOverridesModule({ tsconfigRootDir: String.raw`'\\\\server\\share\\app'` }),
  'relative-root-held-in-a-string.mts': buildFileOverridesModule({
    declarations: ["const ROOT: string = '.'"],
    tsconfigRootDir: 'ROOT',
  }),
}

/** An error as a test reads it: where, its code, and whether its message, chained lines included, says what it should. */
type ErrorRead = SourcePosition & { readonly file: string; readonly code: string; readonly says: boolean }

/** tsc over a project whose tsconfig takes in the modules given alone, by their file names, our package and Node's types installed. */
function typeCheckedConsumer(tempProjects: TempProjects, modules: Readonly<Record<string, FileOverridesModule>>): ProcessResult {
  const files = Object.fromEntries(Object.entries(modules).map(([file, module]) => [file, fileOverridesModuleText(module)]))
  return typeCheck(
    tempProjects.create({
      files: { 'tsconfig.json': `${JSON.stringify(buildTsconfigListingNodeTypes({ include: Object.keys(files) }))}\n`, ...files },
      linkedPackages: [...CONSUMER_INSTALL, INSTALLED_TYPES_NODE],
    }),
  )
}

function errorsSaying({ exitCode, stdout }: ProcessResult, text: string): { readonly exitCode: number | null; readonly errors: readonly ErrorRead[] } {
  return { exitCode, errors: tscErrorsIn(stdout).map(({ file, line, column, code, message }) => ({ file, line, column, code, says: message.includes(text) })) }
}

describe('tsc over agents-inc.lint.mts, rule IDs, libs domains and tsconfigRootDir read through the published types', () => {
  const runs = setUpRunsBeforeTheSuite(
    (tempProjects) => ({
      unknownId: typeCheckedConsumer(tempProjects, { [CONFIG_FILE]: RULES_HELD_BESIDE_AN_UNKNOWN_ID }),
      suppressionRule: typeCheckedConsumer(tempProjects, { [CONFIG_FILE]: SUPPRESSION_RULE_HELD_FOR_AN_ENTRY }),
      unknownDomain: typeCheckedConsumer(tempProjects, { [CONFIG_FILE]: LIBS_HELD_BESIDE_AN_UNKNOWN_DOMAIN }),
      relativeRoot: typeCheckedConsumer(tempProjects, { [CONFIG_FILE]: RELATIVE_ROOT }),
      taken: typeCheckedConsumer(tempProjects, { [CONFIG_FILE]: NAMES_THE_TYPES_TAKE_HELD_IN_CONSTS, ...ROOTS_THE_TYPES_TAKE }),
    }),
    { timeoutMs: TSC_RUN_TIMEOUT_MS, whatFailed: 'tsc could not be run on the consumer projects before the suite' },
  )

  it('reports an unknown rule ID held in a const beside a known one at the rules key, saying no shipped rule has it', () => {
    expect(errorsSaying(runs().unknownId, SAYS_NO_SUCH_RULE)).toStrictEqual({
      exitCode: TSC_REPORTED_ERRORS,
      errors: [{ file: CONFIG_FILE, ...positionAtTopLevel(RULES_HELD_BESIDE_AN_UNKNOWN_ID, 'rules', 'rules'), code: TYPE_NOT_ASSIGNABLE, says: true }],
    })
  })

  it("reports a suppression rule held in a const beside a known one at an entry's rules key, saying allowSuppressions sets it", () => {
    expect(errorsSaying(runs().suppressionRule, SAYS_ALLOW_SUPPRESSIONS_SETS_IT)).toStrictEqual({
      exitCode: TSC_REPORTED_ERRORS,
      errors: [{ file: CONFIG_FILE, ...positionInEntry(SUPPRESSION_RULE_HELD_FOR_AN_ENTRY, 0, 'rules'), code: TYPE_NOT_ASSIGNABLE, says: true }],
    })
  })

  it("reports an unknown libs domain held in a const beside a known one at the set's libs key, saying no libs domain has the name", () => {
    expect(errorsSaying(runs().unknownDomain, SAYS_NO_SUCH_LIBS_DOMAIN)).toStrictEqual({
      exitCode: TSC_REPORTED_ERRORS,
      errors: [{ file: CONFIG_FILE, ...positionAtTopLevel(LIBS_HELD_BESIDE_AN_UNKNOWN_DOMAIN, 'agentRulesets', 'libs'), code: TYPE_NOT_ASSIGNABLE, says: true }],
    })
  })

  it('reports a relative tsconfigRootDir at its key, saying to write import.meta.dirname', () => {
    expect(errorsSaying(runs().relativeRoot, SAYS_TO_WRITE_AN_ABSOLUTE_PATH)).toStrictEqual({
      exitCode: TSC_REPORTED_ERRORS,
      errors: [{ file: CONFIG_FILE, ...positionAtTopLevel(RELATIVE_ROOT, 'tsconfigRootDir', 'tsconfigRootDir'), code: TYPE_NOT_ASSIGNABLE, says: true }],
    })
  })

  it('reports nothing for known names held in consts, a root written out on POSIX or Windows, and a relative root held in a string', () => {
    expect(runs().taken).toStrictEqual({ exitCode: 0, stdout: '', stderr: '' })
  })
})
