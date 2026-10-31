import type { HeldCase } from '../accepted-rules-out-of-place.ts'
import type { RuleCase } from './changed-settings.ts'

// The eslint-comments rules the owner accepted on 2026-10-24, which run only where suppressions are allowed:
// each reports the card's comment and stays silent on its corrected form, and on a shape its docs say it
// leaves alone.

/** Each shipped accepted eslint-comments rule's report case beside its silent twin. */
export const ACCEPTED_CMT_CASES: readonly RuleCase[] = [
  // A line comment holds for one line, so it needs no enable; a whole-file disable does, at the rule's defaults.
  {
    rule: '@eslint-community/eslint-comments/disable-enable-pair',
    silentIn: [
      {
        path: 'src/block-re-enabled.ts',
        source: "/* eslint-disable no-console */\nconsole.log('starting')\n/* eslint-enable no-console */\n",
      },
      { path: 'src/next-line.ts', source: "// eslint-disable-next-line no-console\nconsole.log('starting')\n" },
    ],
    reportedIn: [
      { path: 'src/block-never-re-enabled.ts', source: "/* eslint-disable no-console */\nconsole.log('starting')\n" },
      { path: 'src/blanket-never-re-enabled.ts', source: "/* eslint-disable */\nconsole.log('starting')\n" },
    ],
  },
  // A second disable of a rule is reported whichever engine runs the rule: no-debugger runs in oxlint, eqeqeq in
  // ESLint. Each rule disabled once for a line is no duplicate, whichever comments do it.
  {
    rule: '@eslint-community/eslint-comments/no-duplicate-disable',
    silentIn: [
      { path: 'src/disabled-once.ts', source: "/* eslint-disable no-console */\nconsole.log('starting')\n" },
      {
        path: 'src/two-rules-once-each.ts',
        source: "/* eslint-disable no-console */\n// eslint-disable-next-line no-alert\nconsole.log(alert('starting'))\n",
      },
    ],
    reportedIn: [
      {
        path: 'src/oxlint-run-rule-disabled-twice.ts',
        source: '/* eslint-disable no-debugger */\n// eslint-disable-next-line no-debugger\ndebugger\n',
      },
      {
        path: 'src/eslint-run-rule-disabled-twice.ts',
        source: "/* eslint-disable eqeqeq */\n// eslint-disable-next-line eqeqeq\nconsole.log('starting' == null)\n",
      },
    ],
  },
  // A comment that switches a check off needs a reason after `--`, in oxlint's spelling as in ESLint's, and so does an
  // inline rule-setting comment, whether it switches a check off or only changes an option; an enable, global or
  // exported comment needs none, and prose naming a directive is no directive. An eslint-env comment is left out:
  // ESLint 10 reports it with no rule ID.
  {
    rule: '@eslint-community/eslint-comments/require-description',
    silentIn: [
      {
        path: 'src/described.ts',
        source: "// eslint-disable-next-line no-console -- stdout is this CLI's only output channel\nconsole.log('starting')\n",
      },
      { path: 'src/prose.ts', source: "// the gate bans eslint-disable comments\nconsole.log('starting')\n" },
      {
        path: 'src/undescribed-enable.ts',
        source: "/* eslint-disable no-console -- stdout is this CLI's only output channel */\nconsole.log('starting')\n/* eslint-enable no-console */\n",
      },
      {
        path: 'src/oxlint-described.ts',
        source: "// oxlint-disable-next-line no-console -- stdout is this CLI's only output channel\nconsole.log('starting')\n",
      },
      {
        path: 'src/oxlint-described-same-line.ts',
        source: "console.log('starting') // oxlint-disable-line no-console -- stdout is this CLI's only output channel\n",
      },
      { path: 'src/oxlint-prose.ts', source: "// the gate bans oxlint-disable comments\nconsole.log('starting')\n" },
      {
        path: 'src/described-line-comment.ts',
        source: "// eslint-disable no-console -- stdout is this CLI's only output channel\nconsole.log('starting')\n",
      },
      {
        path: 'src/oxlint-undescribed-enable.ts',
        source: "/* oxlint-disable no-console -- stdout is this CLI's only output channel */\nconsole.log('starting')\n/* oxlint-enable no-console */\n",
      },
      { path: 'src/undescribed-global.ts', source: '/* global starting */\nconsole.log(starting)\n' },
      { path: 'src/undescribed-globals.ts', source: '/* globals starting */\nconsole.log(starting)\n' },
      { path: 'src/undescribed-exported.ts', source: '/* exported starting */\nconst starting = 1\nconsole.log(starting)\n' },
      {
        path: 'src/described-inline-switch-off.ts',
        source: "/* eslint no-console: \"off\" -- stdout is this CLI's only output channel */\nconsole.log('starting')\n",
      },
      {
        path: 'src/described-inline-option-change.ts',
        source: "/* eslint eqeqeq: [\"error\", \"smart\"] -- comparing with null covers undefined here */\nconsole.log('starting' === null)\n",
      },
    ],
    reportedIn: [
      { path: 'src/undescribed.ts', source: "// eslint-disable-next-line no-console\nconsole.log('starting')\n" },
      { path: 'src/undescribed-block.ts', source: "/* eslint-disable no-console */\nconsole.log('starting')\n" },
      { path: 'src/undescribed-same-line.ts', source: "console.log('starting') // eslint-disable-line no-console\n" },
      { path: 'src/oxlint-undescribed.ts', source: "// oxlint-disable-next-line no-console\nconsole.log('starting')\n" },
      { path: 'src/oxlint-undescribed-block.ts', source: "/* oxlint-disable no-console */\nconsole.log('starting')\n" },
      { path: 'src/oxlint-undescribed-same-line.ts', source: "console.log('starting') // oxlint-disable-line no-console\n" },
      { path: 'src/oxlint-undescribed-blanket.ts', source: "/* oxlint-disable */\nconsole.log('starting')\n" },
      // oxlint reads a whole-file disable from a line comment too, in either engine's spelling.
      { path: 'src/oxlint-undescribed-line-comment.ts', source: "// oxlint-disable no-console\nconsole.log('starting')\n" },
      { path: 'src/undescribed-line-comment.ts', source: "// eslint-disable no-console\nconsole.log('starting')\n" },
      { path: 'src/undescribed-inline-switch-off.ts', source: "/* eslint no-console: \"off\" */\nconsole.log('starting')\n" },
      { path: 'src/undescribed-inline-option-change.ts', source: "/* eslint eqeqeq: [\"error\", \"smart\"] */\nconsole.log('starting' === null)\n" },
    ],
  },
]

/**
 * The cases of accepted eslint-comments rules whose build waits on a card, unrun until the owner answers it: once the
 * rule ships, its case moves to ACCEPTED_CMT_CASES.
 */
export const ACCEPTED_CMT_HELD_CASES: ReadonlyArray<HeldCase<RuleCase>> = []
