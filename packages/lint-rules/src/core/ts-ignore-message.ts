import { foundOr } from '@workspace/rule-data/collections'
import type { ESLint, Rule } from 'eslint'
import { isRecord } from './is-record.ts'
import { contextReporting, pluginWithRulesReplaced, ruleGivenContext } from './typed-rule-contexts.ts'

const TYPESCRIPT_ESLINT = '@typescript-eslint'
const TS_COMMENT_BAN = 'ban-ts-comment'
const TS_COMMENT_BAN_ID = `${TYPESCRIPT_ESLINT}/${TS_COMMENT_BAN}`
// Its message for a @ts-ignore says to use @ts-expect-error instead (typescript-eslint 8.71), which the same rule
// refuses where its option bans @ts-expect-error too.
const USE_TS_EXPECT_ERROR_INSTEAD = 'tsIgnoreInsteadOfExpectError'
const FIX_THE_TYPE_ERROR = 'tsIgnoreWhereTsExpectErrorIsBannedToo'
const FIX_THE_TYPE_ERROR_MESSAGE = 'Do not use "@ts-ignore": remove it and fix the type error it hides.'
const TS_EXPECT_ERROR_OPTION = 'ts-expect-error'

/** Where our blocks run ban-ts-comment banning @ts-expect-error too, a @ts-ignore is told to fix the type error, with no suggestion to swap in the @ts-expect-error banned there. A team's own setting of it keeps typescript-eslint's message and suggestion. */
export function withOurTsIgnoreMessage(plugins: ReadonlyMap<string, ESLint.Plugin>, ruleIdsRun: readonly string[]): ReadonlyMap<string, ESLint.Plugin> {
  if (!ruleIdsRun.includes(TS_COMMENT_BAN_ID)) return plugins
  const plugin = foundOr(plugins.get(TYPESCRIPT_ESLINT), `no plugin under ${TYPESCRIPT_ESLINT}, which runs ${TS_COMMENT_BAN_ID}`)
  return new Map([...plugins, [TYPESCRIPT_ESLINT, pluginWithRulesReplaced(TYPESCRIPT_ESLINT, plugin, [TS_COMMENT_BAN], tellingToFixTheTypeError)]])
}

function tellingToFixTheTypeError(rule: Readonly<Rule.RuleModule>): Rule.RuleModule {
  const meta = foundOr(rule.meta, `${TS_COMMENT_BAN_ID} has no meta`)
  const messages = foundOr(meta.messages, `${TS_COMMENT_BAN_ID} has no messages`)
  return {
    ...ruleGivenContext(rule, contextTellingToFixTheTypeError),
    meta: { ...meta, messages: { ...messages, [FIX_THE_TYPE_ERROR]: FIX_THE_TYPE_ERROR_MESSAGE } },
  }
}

/** Parse boundary: ESLint types a rule's options as `any[]`. */
function bansTsExpectError({ options }: Readonly<Rule.RuleContext>): boolean {
  const optionsGiven: unknown = options.at(0)
  return isRecord(optionsGiven) && optionsGiven[TS_EXPECT_ERROR_OPTION] === true
}

function contextTellingToFixTheTypeError(context: Readonly<Rule.RuleContext>): Rule.RuleContext {
  if (!bansTsExpectError(context)) return context
  return contextReporting(context, toldToFixTheTypeError)
}

function toldToFixTheTypeError(descriptor: Readonly<Rule.ReportDescriptor>): Rule.ReportDescriptor {
  if (!isTheAdviceToUseTsExpectError(descriptor)) return descriptor
  return { ...descriptor, messageId: FIX_THE_TYPE_ERROR, suggest: null }
}

function isTheAdviceToUseTsExpectError(descriptor: Readonly<Rule.ReportDescriptor>): boolean {
  return 'messageId' in descriptor && descriptor.messageId === USE_TS_EXPECT_ERROR_INSTEAD
}
