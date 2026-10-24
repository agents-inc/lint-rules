import { describe, expect, it } from 'vitest'
import {
  MUTANT_COLUMN,
  MUTATOR_NAME,
  mutationReport,
  staticKilledMutant,
  staticSurvivedMutant,
  survivedMutantNotStatic,
} from './__tests__/factories/mutation-report-factories.ts'
import { loadTimeMutantsSurvived } from './load-time-mutants-survived.ts'

const FILE = 'packages/eslint-plugin-house/src/rules/no-section-banner.ts'
const OTHER_FILE = 'packages/rule-data/src/catalog.ts'
const LINE = 12
const OTHER_LINE = 20
const THIRD_LINE = 31
const TESTS_RUN = 21

function described(file: string, line: number): string {
  return `${file}:${line}:${MUTANT_COLUMN} ${MUTATOR_NAME}`
}

describe('loadTimeMutantsSurvived', () => {
  it('names a Survived mutant marked static, which is in code that runs while modules load, by its file, line, column and mutator', () => {
    const report = mutationReport({ [FILE]: [staticSurvivedMutant(LINE, TESTS_RUN)] })

    expect(loadTimeMutantsSurvived(report)).toStrictEqual([described(FILE, LINE)])
  })

  it('passes over a Survived mutant not marked static and a static one that was Killed, beside a static one that Survived', () => {
    const report = mutationReport({
      [FILE]: [survivedMutantNotStatic(OTHER_LINE, TESTS_RUN), staticKilledMutant(THIRD_LINE, TESTS_RUN), staticSurvivedMutant(LINE, TESTS_RUN)],
    })

    expect(loadTimeMutantsSurvived(report)).toStrictEqual([described(FILE, LINE)])
  })

  it('names none where no static mutant Survived', () => {
    const report = mutationReport({ [FILE]: [survivedMutantNotStatic(OTHER_LINE, TESTS_RUN), staticKilledMutant(THIRD_LINE, TESTS_RUN)] })

    expect(loadTimeMutantsSurvived(report)).toStrictEqual([])
  })

  it('names such mutants in every file of the report, in its order', () => {
    const report = mutationReport({
      [FILE]: [staticSurvivedMutant(LINE, TESTS_RUN), staticSurvivedMutant(THIRD_LINE, TESTS_RUN)],
      [OTHER_FILE]: [staticSurvivedMutant(OTHER_LINE, TESTS_RUN)],
    })

    expect(loadTimeMutantsSurvived(report)).toStrictEqual([described(FILE, LINE), described(FILE, THIRD_LINE), described(OTHER_FILE, OTHER_LINE)])
  })
})
