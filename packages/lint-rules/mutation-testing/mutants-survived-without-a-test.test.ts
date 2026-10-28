import { describe, expect, it } from 'vitest'
import {
  killedMutant,
  MUTANT_COLUMN,
  MUTATOR_NAME,
  mutationReport,
  noCoverageMutant,
  reportOfAFileThatIsNull,
  reportOfAFileWithoutAMutantsField,
  reportOfAMutantAtAColumnGivenAsText,
  reportOfAMutantOnALineGivenAsText,
  reportOfAMutantThatIsNull,
  reportOfAMutantWhoseLocationHasNoStart,
  reportOfAMutantWhoseMutatorIsANumber,
  reportOfAMutantWhoseStaticFlagIsText,
  reportOfAMutantWhoseStatusIsANumber,
  reportOfAMutantWhoseTestCountIsText,
  reportOfAMutantWithoutAPlace,
  reportThatIsNull,
  reportWithoutAFilesField,
  staticSurvivedMutant,
  survivedMutant,
  survivedMutantNotStatic,
  survivedMutantWithoutATestCount,
} from './__tests__/factories/mutation-report-factories.ts'
import { mutantsSurvivedWithoutATest, parseMutationReport } from './mutants-survived-without-a-test.ts'

const FILE = 'packages/lint-rules/src/core/editor-parts.ts'
const OTHER_FILE = 'packages/lint-rules/src/core/twin-pairs.ts'
const LINE = 12
const OTHER_LINE = 20
const REPORT_REFUSED = "Stryker's report is not one the round reads: it lists no file's mutants, each with its mutator, status and place"

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

    expect(() => mutantsSurvivedWithoutATest(report)).toThrow(
      new Error(`Stryker's report gives no test count for the Survived mutant ${described(FILE, LINE)}`),
    )
  })
})

describe('parseMutationReport', () => {
  it('reads the mutants from the JSON text of a report', () => {
    const report = mutationReport({ [FILE]: [survivedMutant(LINE, 0)] })

    expect(parseMutationReport(JSON.stringify(report))).toStrictEqual(report)
  })

  it('reads a report holding a mutant Stryker marks static and one it marks not', () => {
    const report = mutationReport({ [FILE]: [staticSurvivedMutant(LINE, 0), survivedMutantNotStatic(OTHER_LINE, 0)] })

    expect(parseMutationReport(JSON.stringify(report))).toStrictEqual(report)
  })

  it('refuses a report that is null', () => {
    expect(() => parseMutationReport(JSON.stringify(reportThatIsNull()))).toThrow(new Error(REPORT_REFUSED))
  })

  it('refuses a report with no files field', () => {
    expect(() => parseMutationReport(JSON.stringify(reportWithoutAFilesField()))).toThrow(new Error(REPORT_REFUSED))
  })

  it('refuses a report giving a file null in place of its mutants', () => {
    expect(() => parseMutationReport(JSON.stringify(reportOfAFileThatIsNull(FILE)))).toThrow(new Error(REPORT_REFUSED))
  })

  it('refuses a report holding a file with no mutants field', () => {
    expect(() => parseMutationReport(JSON.stringify(reportOfAFileWithoutAMutantsField(FILE)))).toThrow(new Error(REPORT_REFUSED))
  })

  it('refuses a report holding a mutant that is null', () => {
    expect(() => parseMutationReport(JSON.stringify(reportOfAMutantThatIsNull(FILE)))).toThrow(new Error(REPORT_REFUSED))
  })

  it('refuses a report holding a mutant with no place in its file', () => {
    expect(() => parseMutationReport(JSON.stringify(reportOfAMutantWithoutAPlace(FILE)))).toThrow(new Error(REPORT_REFUSED))
  })

  it('refuses a report holding a mutant whose location has no start', () => {
    expect(() => parseMutationReport(JSON.stringify(reportOfAMutantWhoseLocationHasNoStart(FILE)))).toThrow(new Error(REPORT_REFUSED))
  })

  it('refuses a report holding a mutant whose mutator is named by a number', () => {
    expect(() => parseMutationReport(JSON.stringify(reportOfAMutantWhoseMutatorIsANumber(FILE, LINE)))).toThrow(new Error(REPORT_REFUSED))
  })

  it('refuses a report holding a mutant whose status is a number', () => {
    expect(() => parseMutationReport(JSON.stringify(reportOfAMutantWhoseStatusIsANumber(FILE, LINE)))).toThrow(new Error(REPORT_REFUSED))
  })

  it('refuses a report holding a mutant on a line given as text', () => {
    expect(() => parseMutationReport(JSON.stringify(reportOfAMutantOnALineGivenAsText(FILE, LINE)))).toThrow(new Error(REPORT_REFUSED))
  })

  it('refuses a report holding a mutant at a column given as text', () => {
    expect(() => parseMutationReport(JSON.stringify(reportOfAMutantAtAColumnGivenAsText(FILE, LINE)))).toThrow(new Error(REPORT_REFUSED))
  })

  it('refuses a report holding a mutant whose test count is text', () => {
    expect(() => parseMutationReport(JSON.stringify(reportOfAMutantWhoseTestCountIsText(FILE, LINE)))).toThrow(new Error(REPORT_REFUSED))
  })

  it('refuses a report holding a mutant whose static flag is text', () => {
    expect(() => parseMutationReport(JSON.stringify(reportOfAMutantWhoseStaticFlagIsText(FILE, LINE)))).toThrow(new Error(REPORT_REFUSED))
  })
})
