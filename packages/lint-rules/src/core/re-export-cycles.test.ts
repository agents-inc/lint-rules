import { foundOr } from '@workspace/rule-data/collections'
import { eslintPlugins } from '@workspace/rule-data/eslint-plugins'
import { type ESLint, Linter } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'
import { A_CHAIN_THAT_ENDS, A_FILE_RE_EXPORTING_ITSELF, TWO_FILES_RE_EXPORTING_EACH_OTHER } from '../__tests__/cases/re-export-chains.ts'
import { exportOf, programOfFiles } from '../__tests__/factories/typescript-program-factories.ts'
import { checkerCuttingReExportCycles, withReExportCyclesCut } from './re-export-cycles.ts'

const TYPESCRIPT_ESLINT = '@typescript-eslint'
// typescript-eslint's own refusal of a typed rule on a file it has no type information for (8.71).
const NEEDS_TYPE_INFORMATION = 'You have used a rule which requires type information'

describe("a checker cutting re-export cycles, stepping through a re-export's alias", () => {
  it('steps to the name a re-export passes on, as the checker does', () => {
    const program = programOfFiles(A_CHAIN_THAT_ENDS)
    const checker = program.getTypeChecker()
    const passedOn = exportOf(program, '/project/passed-on.ts', 'passedOn')

    expect({ cutting: checkerCuttingReExportCycles(checker).getImmediateAliasedSymbol(passedOn), old: exportOf(program, '/project/old.ts', 'old') }).toStrictEqual({
      cutting: checker.getImmediateAliasedSymbol(passedOn),
      old: checker.getImmediateAliasedSymbol(passedOn),
    })
  })

  it('steps past no re-export of itself, where the checker steps back to the same name', () => {
    const program = programOfFiles(A_FILE_RE_EXPORTING_ITSELF)
    const checker = program.getTypeChecker()
    const looped = exportOf(program, '/project/cycle.ts', 'looped')

    expect({ cutting: checkerCuttingReExportCycles(checker).getImmediateAliasedSymbol(looped), checker: checker.getImmediateAliasedSymbol(looped) }).toStrictEqual({
      cutting: undefined,
      checker: looped,
    })
  })

  it('steps past no re-export in a loop of two files, or leading into one, where the checker steps on', () => {
    const program = programOfFiles(TWO_FILES_RE_EXPORTING_EACH_OTHER)
    const checker = program.getTypeChecker()
    const cutting = checkerCuttingReExportCycles(checker)
    const names = [exportOf(program, '/project/first.ts', 'first'), exportOf(program, '/project/second.ts', 'second'), exportOf(program, '/project/leading-in.ts', 'leadingIn')]

    expect({
      cutting: names.map((name) => cutting.getImmediateAliasedSymbol(name)),
      checkerStepsOn: names.map((name) => checker.getImmediateAliasedSymbol(name) !== undefined),
    }).toStrictEqual({ cutting: [undefined, undefined, undefined], checkerStepsOn: [true, true, true] })
  })
})

describe('withReExportCyclesCut', () => {
  const typescriptEslint = tseslint.plugin

  function rulesOf(plugin: ESLint.Plugin): NonNullable<ESLint.Plugin['rules']> {
    if (plugin.rules === undefined) throw new Error('the plugin has no rules')
    return plugin.rules
  }

  it("gives typescript-eslint's two rules that follow re-exports modules of their own and keeps the rest, beside another plugin, kept as it is", () => {
    const cut = rulesOf(withReExportCyclesCut(TYPESCRIPT_ESLINT, typescriptEslint))
    const ours = rulesOf(typescriptEslint)
    const unicorn = foundOr(eslintPlugins['unicorn'], 'rule-data registers no unicorn plugin')

    expect({
      replaced: Object.keys(ours).filter((name) => cut[name] !== ours[name]),
      otherPluginKept: withReExportCyclesCut('unicorn', unicorn) === unicorn,
    }).toStrictEqual({ replaced: ['consistent-type-exports', 'no-deprecated'], otherPluginKept: true })
  })

  it('refuses a typescript-eslint plugin without rules, or without a rule it cuts, naming what is missing', () => {
    expect([() => withReExportCyclesCut(TYPESCRIPT_ESLINT, {}), () => withReExportCyclesCut(TYPESCRIPT_ESLINT, { rules: {} })].map(messageThrownBy)).toStrictEqual([
      'the plugin under @typescript-eslint has no rules',
      '@typescript-eslint/consistent-type-exports is not in its plugin',
    ])
  })

  it('leaves a file with no type information to the rule, which says it needs some, as the rule given no cut does', () => {
    const verified = (plugin: ESLint.Plugin) => (): void => {
      new Linter().verify('export const a = 1\n', [{ files: ['**/*.ts'], languageOptions: { parser: tseslint.parser }, plugins: { [TYPESCRIPT_ESLINT]: plugin }, rules: { '@typescript-eslint/no-deprecated': 'error' } }], { filename: 'a.ts' })
    }

    expect([verified(withReExportCyclesCut(TYPESCRIPT_ESLINT, typescriptEslint)), verified(typescriptEslint)].map((verify) => messageThrownBy(verify).includes(NEEDS_TYPE_INFORMATION))).toStrictEqual([true, true])
  })
})

function messageThrownBy(call: () => unknown): string {
  try {
    call()
  } catch (error) {
    if (error instanceof Error) return error.message
    throw error
  }
  throw new Error('the call threw nothing')
}
