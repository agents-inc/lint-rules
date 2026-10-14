import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'
import { agentConfigsOf } from './__tests__/agent-configs.ts'
import { unionSorts, unionsLeftAsWritten, unionsToConverge } from './__tests__/cases/union-types.ts'
import { buildConsumerLintRules } from './__tests__/factories/lint-rules-factories.ts'
import { buildUnionDeclaration } from './__tests__/factories/union-declaration-factories.ts'
import { defineLintRules, type LintRules } from './index.ts'

// lintText reads nothing from disk: the path only selects the config blocks for a .ts file.
const PROJECT_DIR = tmpdir()
const UNION_FILE = join(PROJECT_DIR, 'union.ts')

type FixRun = {
  readonly output: string
  /** Whether any fix was applied, even one a later pass undid. */
  readonly fixed: boolean
  /** The rules still reporting once the fix loop stopped. */
  readonly remaining: readonly (string | null)[]
  readonly fatal: readonly string[]
}

/** ESLint fixing with the agent build's config for the lint rules. */
function fixingEslintFor(lintRules: LintRules): ESLint {
  const overrideConfig = agentConfigsOf(defineLintRules(lintRules)).eslint
  return new ESLint({ cwd: PROJECT_DIR, overrideConfigFile: true, overrideConfig, fix: true })
}

/** One `eslint --fix`: ESLint's fix loop, which re-lints until nothing changes or it gives up. */
async function runFix(eslint: ESLint, code: string): Promise<FixRun> {
  const [result] = await eslint.lintText(code, { filePath: UNION_FILE })
  if (result === undefined) throw new Error('ESLint returned no result for the union')
  const { output, messages } = result
  return {
    // ESLint leaves `output` out exactly when it applied no fix.
    output: output === undefined ? code : output,
    fixed: output !== undefined,
    remaining: messages.filter((message) => message.fatal !== true).map((message) => message.ruleId),
    fatal: messages.filter((message) => message.fatal === true).map((message) => message.message),
  }
}

// Two rules undoing each other's fix make ESLint stop after ten passes, mid-cycle. The text can
// then match the input again, so "applied no fix" is the measure, not "text unchanged".
describe('the ordering ruleset, fixing unions', () => {
  const eslint = fixingEslintFor(buildConsumerLintRules(PROJECT_DIR, { agentRulesets: { quality: ['ordering'] } }))

  it.each(unionsToConverge)('converges on %j: a second eslint --fix applies no fix and leaves no finding', async (union) => {
    const first = await runFix(eslint, buildUnionDeclaration(union))
    const second = await runFix(eslint, first.output)

    expect({
      fatal: [...first.fatal, ...second.fatal],
      secondRun: { fixed: second.fixed, remaining: second.remaining },
    }).toStrictEqual({ fatal: [], secondRun: { fixed: false, remaining: [] } })
  })
})

describe('perfectionist/sort-union-types with its shipped options', () => {
  // A bare severity keeps the shipped options in force.
  const eslint = fixingEslintFor(buildConsumerLintRules(PROJECT_DIR, {}, { rules: { 'perfectionist/sort-union-types': 'error' } }))

  it.each(unionsLeftAsWritten)('leaves %j as written: object types, then null and undefined, last', async (union) => {
    const code = buildUnionDeclaration(union)

    expect(await runFix(eslint, code)).toStrictEqual({ output: code, fixed: false, remaining: [], fatal: [] })
  })

  it.each(unionSorts)('orders $order', async ({ union, sorted }) => {
    expect(await runFix(eslint, buildUnionDeclaration(union))).toStrictEqual({
      output: buildUnionDeclaration(sorted),
      fixed: true,
      remaining: [],
      fatal: [],
    })
  })
})
