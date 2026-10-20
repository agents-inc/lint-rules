import { catalog } from '@workspace/rule-data'
import type { ErrorAt } from '../engine-run.ts'
import { oxlintCodeOf } from '../oxlint-codes.ts'

export function buildEslintError(ruleId: string, line: number): ErrorAt {
  return { engine: 'eslint', rule: ruleId, line }
}

/** An error oxlint reports, under its diagnostic code: `typescript(ban-ts-comment)`. */
function buildOxlintError(code: string, line: number): ErrorAt {
  return { engine: 'oxlint', rule: code, line }
}

/** An error the engine the catalog routes the rule to reports: under its ID in ESLint, its diagnostic code in oxlint. */
export function buildErrorOnItsRoutedEngine(ruleId: string, line: number): ErrorAt {
  const route = catalog.rules.get(ruleId)
  if (route === undefined) throw new Error(`${ruleId} is not in the catalog`)
  return route.engine === 'eslint' ? buildEslintError(ruleId, line) : buildOxlintError(oxlintCodeOf(ruleId, catalog), line)
}
