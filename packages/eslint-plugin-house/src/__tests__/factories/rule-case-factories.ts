import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'

type CaseFields<TestCase> = Partial<Omit<TestCase, 'name' | 'code'>>

type ValidCaseFields<Options extends readonly unknown[]> = CaseFields<ValidTestCase<Options>>

type InvalidCaseFields<MessageIds extends string, Options extends readonly unknown[]> =
  Pick<InvalidTestCase<MessageIds, Options>, 'errors'> & CaseFields<Omit<InvalidTestCase<MessageIds, Options>, 'errors'>>

type CaseBuilders = {
  validCase: <Options extends readonly unknown[]>(
    name: string,
    code: string,
    fields?: ValidCaseFields<Options>,
  ) => ValidTestCase<Options>
  invalidCase: <MessageIds extends string, Options extends readonly unknown[]>(
    name: string,
    code: string,
    fields: InvalidCaseFields<MessageIds, Options>,
  ) => InvalidTestCase<MessageIds, Options>
}

/** Code the rule must stay silent on, linted as `react.tsx` unless `filename` says otherwise. */
export function buildValidCase<Options extends readonly unknown[]>(
  name: string,
  code: string,
  fields: ValidCaseFields<Options> = {},
): ValidTestCase<Options> {
  return { name, code, ...fields }
}

/**
 * Code the rule must report. Every report, and a fixable rule's `output` for each fix pass, is
 * stated: the tester fails a fix nobody declared.
 */
export function buildInvalidCase<MessageIds extends string, Options extends readonly unknown[]>(
  name: string,
  code: string,
  fields: InvalidCaseFields<MessageIds, Options>,
): InvalidTestCase<MessageIds, Options> {
  return { name, code, ...fields }
}

/** The case builders for a file whose cases all lint as one `filename`; a case's own still wins. */
export function caseBuildersFor(filename: string): CaseBuilders {
  return {
    validCase: (name, code, fields = {}) => buildValidCase(name, code, { filename, ...fields }),
    invalidCase: (name, code, fields) => buildInvalidCase(name, code, { filename, ...fields }),
  }
}
