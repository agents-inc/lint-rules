/** A message as both ESLint APIs give it. */
type MessageWithRule = { readonly ruleId: string | null; readonly message: string }

// ESLint's text when a directive names a rule it has no definition of; the message carries that rule's ID.
const RULE_NOT_FOUND = /^Definition for rule '.+' was not found\.$/u

/** The rule IDs among the messages that ESLint reports it has no definition of. */
export function rulesNotFoundAmong(messages: readonly MessageWithRule[]): Array<string | null> {
  return messages.filter((message) => RULE_NOT_FOUND.test(message.message)).map((message) => message.ruleId)
}
