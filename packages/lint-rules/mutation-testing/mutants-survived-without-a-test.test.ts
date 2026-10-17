import { describe, expect, it } from 'vitest'
import {
  killedMutant,
  MUTANT_COLUMN,
  MUTATOR_NAME,
  mutationReport,
  noCoverageMutant,
  survivedMutant,
  survivedMutantWithoutATestCount,
} from './__tests__/factories/mutation-report-factories.ts'
import { mutantsSurvivedWithoutATest, parseMutationReport } from './mutants-survived-without-a-test.ts'

const FILE = 'packages/lint-rules/src/core/editor-parts.ts'
const OTHER_FILE = 'packages/lint-rules/src/core/twin-pairs.ts'
const LINE = 12
const OTHER_LINE = 20

function described(file: string, line: number): string {
  return `${file}:${line}:${MUTANT_COLUMN} ${MUTATOR_NAME}`
}

describe('mutantsSurvivedWithoutATest', () => {
  it('names a Survived mutant that ran no test by its file, line, column and mutator', () => {
    const report = mutationReport({ [FILE]: [survivedMutant(LINE, 0)] })

    expect(mutantsSurvivedWithoutATest(report)).toStrictEqual([described(FILE, LINE)])
  })

  it('passes over a Survived mutant that ran tests, beside one that ran none', () => {
    const report = mutationReport({ [FILE]: [survivedMutant(LINE, 0), survivedMutant(OTHER_LINE, 3)] })

    expect(mutantsSurvivedWithoutATest(report)).toStrictEqual([described(FILE, LINE)])
  })

  it('passes over a mutant no test covers, which has no test count, and a Killed one', () => {
    const report = mutationReport({ [FILE]: [noCoverageMutant(OTHER_LINE), killedMutant(OTHER_LINE, 1), survivedMutant(LINE, 0)] })

    expect(mutantsSurvivedWithoutATest(report)).toStrictEqual([described(FILE, LINE)])
  })

  it('names such mutants in every file of the report', () => {
    const report = mutationReport({ [FILE]: [survivedMutant(LINE, 0)], [OTHER_FILE]: [survivedMutant(OTHER_LINE, 0)] })

    expect(mutantsSurvivedWithoutATest(report)).toStrictEqual([described(FILE, LINE), described(OTHER_FILE, OTHER_LINE)])
  })

  it('throws, naming the mutant, when the report gives a Survived mutant no test count', () => {
    const report = mutationReport({ [FILE]: [survivedMutantWithoutATestCount(LINE)] })

    expect(() => mutantsSurvivedWithoutATest(report)).toThrowError(
      new Error(`Stryker's report gives no test count for the Survived mutant ${described(FILE, LINE)}`),
    )
  })
})

describe('parseMutationReport', () => {
  it('reads the mutants from the JSON text of a report', () => {
    const report = mutationReport({ [FILE]: [survivedMutant(LINE, 0)] })

    expect(parseMutationReport(JSON.stringify(report))).toStrictEqual(report)
  })
})
