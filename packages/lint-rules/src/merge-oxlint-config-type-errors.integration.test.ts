import { describe, expect, it } from 'vitest'
import { INSTALLED_TYPES_NODE, type ProcessResult, typeCheck } from './__tests__/config-file-loads.ts'
import { CONFIG_FILE } from './__tests__/factories/check-factories.ts'
import { buildFileOverridesModule, fileOverridesModuleText, type SourcePosition } from './__tests__/factories/file-overrides-module-factories.ts'
import { buildOxlintConfigModule, type OxlintConfigModule, oxlintConfigModuleText, positionInTheMergeCall } from './__tests__/factories/oxlint-config-module-factories.ts'
import { buildTsconfigListingNodeTypes } from './__tests__/factories/tsconfig-factories.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { CONSUMER_INSTALL, type TempProjects } from './__tests__/temp-projects.ts'
import { tscErrorsIn } from './__tests__/tsc-errors.ts'

// What a team's tsc, and any editor running TypeScript, says of an oxlint.config.mts handing mergeOxlintConfig the
// ESLint part, or a third argument that is not the path of the team's ESLint config or null. No check of ours refuses
// either at run time (owner, 2026-10-20), so the error is the refusal, read from the published types in dist (built
// first), as a consumer installs them. Each module merges the parts the consumer's agents-inc.lint.mts exports.

const OXLINT_CONFIG_FILE = 'oxlint.config.mts'
// TypeScript's own words, naming our two parts' types.
const SAYS_IT_TAKES_THE_OXLINT_PART = "Argument of type 'EslintPart' is not assignable to parameter of type 'OxlintPart'."
const SAYS_THE_PATH_IS_REQUIRED = 'Expected 3 arguments, but got 2.'
const SAYS_THE_PATH_IS_A_STRING = "Type 'number' is not assignable to type 'string'."
const ARGUMENT_NOT_ASSIGNABLE = 'TS2345'
const ARGUMENT_COUNT_WRONG = 'TS2554'
const TYPE_NOT_ASSIGNABLE = 'TS2322'
// tsc exits 2 where it reports errors and emits nothing.
const TSC_REPORTED_ERRORS = 2
const TSC_RUN_TIMEOUT_MS = 120_000

const ESLINT_PART_HANDED_OVER = buildOxlintConfigModule({ mergeArguments: '{}, eslint, { eslintConfig: null }' })
const PATH_LEFT_OUT = buildOxlintConfigModule({ mergeArguments: '{}, oxlint' })
const PATH_GIVEN_AS_A_NUMBER = buildOxlintConfigModule({ mergeArguments: '{}, oxlint, { eslintConfig: 42 }' })

// Beside the refusals above: the oxlint part with a path, with null, and with a path held in a string.
const CALLS_THE_TYPES_TAKE: Readonly<Record<string, OxlintConfigModule>> = {
  [OXLINT_CONFIG_FILE]: buildOxlintConfigModule({ mergeArguments: "{}, oxlint, { eslintConfig: 'eslint.config.mjs' }" }),
  'no-eslint-config.oxlint.config.mts': buildOxlintConfigModule(),
  'path-held-in-a-string.oxlint.config.mts': buildOxlintConfigModule({
    declarations: ["const ESLINT_CONFIG: string = 'eslint.config.mjs'"],
    mergeArguments: '{}, oxlint, { eslintConfig: ESLINT_CONFIG }',
  }),
}

/** An error as a test reads it: where, its code, and whether its message, chained lines included, says what it should. */
type ErrorRead = SourcePosition & { readonly file: string; readonly code: string; readonly says: boolean }

/** tsc over a project whose tsconfig takes in agents-inc.lint.mts and the oxlint config modules given, by their file names, our package and Node's types installed. */
function typeCheckedConsumer(tempProjects: TempProjects, modules: Readonly<Record<string, OxlintConfigModule>>): ProcessResult {
  const files = {
    [CONFIG_FILE]: fileOverridesModuleText(buildFileOverridesModule()),
    ...Object.fromEntries(Object.entries(modules).map(([file, module]) => [file, oxlintConfigModuleText(module)])),
  }
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

describe("tsc over oxlint.config.mts, mergeOxlintConfig's part and the path of the team's ESLint config read through the published types", () => {
  const runs = setUpRunsBeforeTheSuite(
    (tempProjects) => ({
      eslintPart: typeCheckedConsumer(tempProjects, { [OXLINT_CONFIG_FILE]: ESLINT_PART_HANDED_OVER }),
      pathLeftOut: typeCheckedConsumer(tempProjects, { [OXLINT_CONFIG_FILE]: PATH_LEFT_OUT }),
      pathAsANumber: typeCheckedConsumer(tempProjects, { [OXLINT_CONFIG_FILE]: PATH_GIVEN_AS_A_NUMBER }),
      taken: typeCheckedConsumer(tempProjects, CALLS_THE_TYPES_TAKE),
    }),
    { timeoutMs: TSC_RUN_TIMEOUT_MS, whatFailed: 'tsc could not be run on the consumer projects before the suite' },
  )

  it('reports the ESLint part at that argument, saying it is not the oxlint part', () => {
    expect(errorsSaying(runs().eslintPart, SAYS_IT_TAKES_THE_OXLINT_PART)).toStrictEqual({
      exitCode: TSC_REPORTED_ERRORS,
      errors: [{ file: OXLINT_CONFIG_FILE, ...positionInTheMergeCall(ESLINT_PART_HANDED_OVER, 'eslint'), code: ARGUMENT_NOT_ASSIGNABLE, says: true }],
    })
  })

  it("reports the path of the team's ESLint config left out at the call, in TypeScript's own words", () => {
    expect(errorsSaying(runs().pathLeftOut, SAYS_THE_PATH_IS_REQUIRED)).toStrictEqual({
      exitCode: TSC_REPORTED_ERRORS,
      errors: [{ file: OXLINT_CONFIG_FILE, ...positionInTheMergeCall(PATH_LEFT_OUT, 'mergeOxlintConfig'), code: ARGUMENT_COUNT_WRONG, says: true }],
    })
  })

  it('reports a number given as eslintConfig at its key, saying a path is a string', () => {
    expect(errorsSaying(runs().pathAsANumber, SAYS_THE_PATH_IS_A_STRING)).toStrictEqual({
      exitCode: TSC_REPORTED_ERRORS,
      errors: [{ file: OXLINT_CONFIG_FILE, ...positionInTheMergeCall(PATH_GIVEN_AS_A_NUMBER, 'eslintConfig'), code: TYPE_NOT_ASSIGNABLE, says: true }],
    })
  })

  it('reports nothing for the oxlint part with a path, with null, and with a path held in a string', () => {
    expect(runs().taken).toStrictEqual({ exitCode: 0, stdout: '', stderr: '' })
  })
})
