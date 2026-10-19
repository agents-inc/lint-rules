import { describe, expect, it } from 'vitest'
import { buildNotCheckedEntry } from '../../__tests__/factories/check-factories.ts'
import { eslintFailedOn, goneWhileCheckRan, notCheckedEntriesOf, oxlintRulesFailed } from './not-checked.ts'

const FIRST = { path: '/repo/packages/web/src/a.ts', file: 'src/a.ts' }
const SECOND = { path: '/repo/packages/api/src/b.ts', file: '../api/src/b.ts' }
const ESLINT_CRASHED = new Error('ESLint failed: a rule crashed')
const OXLINT_CRASHED = new Error('oxlint failed: it crashed')
const OXLINT_REFUSED = new Error('oxlint failed: it refused the config')

describe('what check lists as not checked', () => {
  it("gives each file once, by the name printed, in the order of the files, then oxlint's rules, whatever order they were recorded in", () => {
    const recorded = [oxlintRulesFailed(OXLINT_CRASHED), eslintFailedOn(SECOND.path, ESLINT_CRASHED), goneWhileCheckRan(FIRST.path)]

    expect(notCheckedEntriesOf([FIRST, SECOND], recorded)).toStrictEqual([
      buildNotCheckedEntry({ subject: FIRST.file, reason: 'it was deleted or replaced while check ran' }),
      buildNotCheckedEntry({ subject: SECOND.file, reason: 'ESLint failed: a rule crashed' }),
      buildNotCheckedEntry({ subject: "oxlint's rules", reason: 'oxlint failed: it crashed' }),
    ])
  })

  it('keeps the first reason recorded for a file and for oxlint, beside a file nothing was recorded for, which it leaves out', () => {
    const recorded = [eslintFailedOn(FIRST.path, ESLINT_CRASHED), goneWhileCheckRan(FIRST.path), oxlintRulesFailed(OXLINT_REFUSED), oxlintRulesFailed(OXLINT_CRASHED)]

    expect(notCheckedEntriesOf([FIRST, SECOND], recorded)).toStrictEqual([
      buildNotCheckedEntry({ subject: FIRST.file, reason: 'ESLint failed: a rule crashed' }),
      buildNotCheckedEntry({ subject: "oxlint's rules", reason: 'oxlint failed: it refused the config' }),
    ])
  })
})
