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

/**
 * Code the rule must stay silent on. Without a `filename` the tester lints it as `react.tsx`.
 */
export function buildValidCase<Options extends readonly unknown[]>(
  name: string,
  code: string,
  fields: ValidCaseFields<Options> = {},
): ValidTestCase<Options> {
  return { name, code, ...fields }
}

/**
 * Code the rule must report. `errors` has no default: every invalid case states each report it
 * expects, by messageId and line. A fixable rule's case also states its `output`, one entry per fix
 * pass; the tester fails a fix nobody declared.
 */
export function buildInvalidCase<MessageIds extends string, Options extends readonly unknown[]>(
  name: string,
  code: string,
  fields: InvalidCaseFields<MessageIds, Options>,
): InvalidTestCase<MessageIds, Options> {
  return { name, code, ...fields }
}

/**
 * buildValidCase and buildInvalidCase for a test file whose cases all lint as one `filename`. A
 * case's own `filename` still wins.
 */
export function caseBuildersFor(filename: string): CaseBuilders {
  return {
    validCase: (name, code, fields = {}) => buildValidCase(name, code, { filename, ...fields }),
    invalidCase: (name, code, fields) => buildInvalidCase(name, code, { filename, ...fields }),
  }
}
