import type { HeldCase } from '../accepted-rules-out-of-place.ts'
import type { RuleCase } from './changed-settings.ts'

// The eslint-comments rules the owner accepted on 2026-10-24, which run only where suppressions are allowed:
// each reports the card's comment and stays silent on its corrected form, and on a shape its docs say it
// leaves alone.

/** Each shipped accepted eslint-comments rule's report case beside its silent twin. None ships yet. */
export const ACCEPTED_CMT_CASES: readonly RuleCase[] = []

const COMMENT_RULES_IN_EDITORS = 'q-lint-cmt-editor-reach'

/**
 * The cases of accepted eslint-comments rules whose build waits on a card, unrun until the owner answers it: once the
 * rule ships, its case moves to ACCEPTED_CMT_CASES.
 *
 * disable-enable-pair and require-description: the editor parts always allow suppressions, so built like
 * unicorn/no-abusive-eslint-disable each would run in every team's editor too, whatever its editor set lists, where the
 * cards said they matter only where a team sets allowSuppressions: true. At its defaults require-description also asks
 * a reason of an enable comment, which card q-lint-cmt-require-description-scope decides.
 *
 * no-duplicate-disable: where suppressions are allowed, check already reports the second disable of a rule ESLint
 * runs as an unused suppression on the same line (measured on the build before it ships); of a rule oxlint runs,
 * it reports nothing.
 */
export const ACCEPTED_CMT_HELD_CASES: ReadonlyArray<HeldCase<RuleCase>> = [
  {
    heldBy: COMMENT_RULES_IN_EDITORS,
    // A line comment holds for one line, so it needs no enable; a whole-file disable does, at the rule's defaults.
    ruleCase: {
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
  },
  {
    heldBy: COMMENT_RULES_IN_EDITORS,
    // An enable comment is a directive too, so it needs its own reason; prose naming a directive is none.
    ruleCase: {
      rule: '@eslint-community/eslint-comments/require-description',
      silentIn: [
        {
          path: 'src/described.ts',
          source: "// eslint-disable-next-line no-console -- stdout is this CLI's only output channel\nconsole.log('starting')\n",
        },
        { path: 'src/prose.ts', source: "// the gate bans eslint-disable comments\nconsole.log('starting')\n" },
      ],
      reportedIn: [
        { path: 'src/undescribed.ts', source: "// eslint-disable-next-line no-console\nconsole.log('starting')\n" },
        {
          path: 'src/undescribed-enable.ts',
          source: "/* eslint-disable no-console -- stdout is this CLI's only output channel */\nconsole.log('starting')\n/* eslint-enable no-console */\n",
        },
      ],
    },
  },
  {
    heldBy: 'q-lint-rc-duplicate-disable-measured',
    // Each rule disabled once for a line is no duplicate, whichever comments do it.
    ruleCase: {
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
          path: 'src/disabled-twice.ts',
          source: "/* eslint-disable no-console */\n// eslint-disable-next-line no-console\nconsole.log('starting')\n",
        },
      ],
    },
  },
]
