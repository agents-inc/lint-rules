import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'

type CaseFields<TestCase> = Partial<Omit<TestCase, 'name' | 'code'>>

/**
 * Code the rule must stay silent on. Without a `filename` the tester lints it as `react.tsx`.
 */
export function buildValidCase<Options extends readonly unknown[]>(
  name: string,
  code: string,
  fields: CaseFields<ValidTestCase<Options>> = {},
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
  fields: Pick<InvalidTestCase<MessageIds, Options>, 'errors'> &
    CaseFields<Omit<InvalidTestCase<MessageIds, Options>, 'errors'>>,
): InvalidTestCase<MessageIds, Options> {
  return { name, code, ...fields }
}
