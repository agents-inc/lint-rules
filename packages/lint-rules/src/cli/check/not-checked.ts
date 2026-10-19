import { messageOf } from '../caught-errors.ts'
import type { NotCheckedEntry } from './report.ts'
import { GONE_WHILE_CHECK_RAN, OXLINT_RULES } from './texts.ts'

/** `file`: as printed, from the config's folder. */
type LintedFile = { readonly path: string; readonly file: string }

/** What check could not lint: a file, by its path, or every file with oxlint's rules. */
export type NotChecked = { readonly kind: 'file'; readonly path: string; readonly reason: string } | { readonly kind: 'oxlint rules'; readonly reason: string }

export function goneWhileCheckRan(path: string): NotChecked {
  return { kind: 'file', path, reason: GONE_WHILE_CHECK_RAN }
}

/** Its oxlint findings still print. ESLint's message says it failed. */
export function eslintFailedOn(path: string, error: unknown): NotChecked {
  return { kind: 'file', path, reason: messageOf(error) }
}

/** ESLint's findings still print. oxlint's message says it failed. */
export function oxlintRulesFailed(error: unknown): NotChecked {
  return { kind: 'oxlint rules', reason: messageOf(error) }
}

/** The first reason recorded for a file stands. */
export function firstNotCheckedOf(notChecked: readonly NotChecked[], path: string): NotChecked | undefined {
  return notChecked.find((entry) => entry.kind === 'file' && entry.path === path)
}

/** One entry per file, in the order given, then oxlint's rules: the first reason recorded for each stands. */
export function notCheckedEntriesOf(files: readonly LintedFile[], notChecked: readonly NotChecked[]): NotCheckedEntry[] {
  return [...files.flatMap((file) => fileEntryOf(file, notChecked)), ...oxlintRulesEntryOf(notChecked)]
}

function fileEntryOf({ path, file }: LintedFile, notChecked: readonly NotChecked[]): NotCheckedEntry[] {
  const entry = firstNotCheckedOf(notChecked, path)
  return entry === undefined ? [] : [{ subject: file, reason: entry.reason }]
}

function oxlintRulesEntryOf(notChecked: readonly NotChecked[]): NotCheckedEntry[] {
  const entry = notChecked.find(({ kind }) => kind === 'oxlint rules')
  return entry === undefined ? [] : [{ subject: OXLINT_RULES, reason: entry.reason }]
}
