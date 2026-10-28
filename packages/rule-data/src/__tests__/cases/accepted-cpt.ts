import type { HeldCase } from '../accepted-rules-out-of-place.ts'
import type { RuleCase } from './changed-settings.ts'

// compat/compat, which the owner accepted on 2026-10-24, checking by default the major browsers as Vite targets them
// (card q-lint-compat-default-target). The cases set the rule's option to browserslist's `baseline widely available`,
// the query that card named. It reports a browser API one of them lacks where the code does not test for it first, and
// stays silent on APIs they all have, fetch among them, which only Opera Mini lacks and browserslist's own default
// would report. eslint-plugin-compat 7.0.2 joins a project's own browserslist to the option: a project naming only
// Chrome still hears of Safari, the limit the owner accepted with the option, and a project naming older iPhones hears
// of them as well. Measured with browserslist 4.29.5 and @mdn/browser-compat-data 6.1.5: requestIdleCallback is missing
// in Safari 17.4, structuredClone in iOS Safari 12. The rule's build waits on cards, so each case is held (below) and
// compat/compat does not ship yet.

/** The rule's option in the cases: the browserslist query card q-lint-compat-default-target named for Vite's targets. */
export const MAJOR_BROWSERS_AS_VITE_TARGETS = 'baseline widely available'

/** A case run in a project whose package.json names its own browsers. */
export type CaseInAProjectNamingBrowsers = RuleCase & {
  /** The package.json of the case's folder, which the rule reads and no engine lints. */
  readonly projectManifest: string
}

const SCHEDULE_IDLE = { path: 'src/schedule-idle.ts', source: 'export const scheduleIdle = (task: () => void) => requestIdleCallback(task)\n' }

const SCHEDULE_SOON = { path: 'src/schedule-soon.ts', source: 'export const scheduleSoon = (task: () => void) => setTimeout(task, 0)\n' }

const LOAD_INVOICES = { path: 'src/load-invoices.ts', source: "export const loadInvoices = () => fetch('/api/invoices')\n" }

const COPY_DRAFT = { path: 'src/copy-draft.ts', source: 'export const copyDraft = <Draft>(draft: Draft) => structuredClone(draft)\n' }

/** The shipped accepted compat rule's report cases beside their silent twins, in a project that names no browsers of its own. None ships yet. */
export const ACCEPTED_COMPAT_CASES: readonly RuleCase[] = []

/** The shipped accepted compat rule in projects whose package.json names browsers: each is checked against its list and ours. None ships yet. */
export const ACCEPTED_COMPAT_CASES_IN_PROJECTS_NAMING_BROWSERS: readonly CaseInAProjectNamingBrowsers[] = []

const COMPAT_VITE_TARGET = 'q-lint-compat-vite-target'

/**
 * The accepted compat rule's cases in a project that names no browsers of its own, held unrun until the rule ships.
 *
 * Its build waits on three cards; a held case names one. COMPAT_VITE_TARGET: whether "the major browsers as Vite targets
 * them" means this option, which moves forward with the date, or Vite's own fixed list of browsers.
 * q-lint-compat-install-size: whether every install carries the plugin's browser data. q-lint-compat-stale-data-warning:
 * whether check silences browserslist's message once that data is old.
 */
export const ACCEPTED_CPT_HELD_CASES: ReadonlyArray<HeldCase<RuleCase>> = [
  {
    heldBy: COMPAT_VITE_TARGET,
    ruleCase: {
      rule: 'compat/compat',
      subject: 'a browser API a major browser lacks, in a project that names no browsers',
      silentIn: [
        SCHEDULE_SOON,
        LOAD_INVOICES,
        COPY_DRAFT,
        {
          path: 'src/schedule-idle-when-supported.ts',
          source: `export const scheduleIdle = (task: () => void) => {
  if ('requestIdleCallback' in window) requestIdleCallback(task)
  else setTimeout(task, 0)
}
`,
        },
      ],
      reportedIn: [SCHEDULE_IDLE, { path: 'src/schedule-idle-on-window.ts', source: 'export const scheduleIdle = (task: () => void) => window.requestIdleCallback(task)\n' }],
    },
  },
]

/** The accepted compat rule's cases in projects whose package.json names browsers, held unrun until the rule ships, on the cards above. */
export const ACCEPTED_CPT_HELD_CASES_IN_PROJECTS_NAMING_BROWSERS: ReadonlyArray<HeldCase<CaseInAProjectNamingBrowsers>> = [
  {
    heldBy: COMPAT_VITE_TARGET,
    ruleCase: {
      rule: 'compat/compat',
      subject: 'a project that names only Chrome, which still hears of the major browsers it leaves out',
      projectManifest: '{ "name": "kiosk-shell", "version": "0.0.0", "private": true, "browserslist": ["last 1 chrome version"] }\n',
      silentIn: [SCHEDULE_SOON],
      reportedIn: [SCHEDULE_IDLE],
    },
  },
  {
    heldBy: COMPAT_VITE_TARGET,
    ruleCase: {
      rule: 'compat/compat',
      subject: 'a project that names iPhones back to iOS 12, whose own browsers are checked as well',
      projectManifest: '{ "name": "field-app", "version": "0.0.0", "private": true, "browserslist": ["last 2 chrome versions", "ios_saf >= 12"] }\n',
      silentIn: [LOAD_INVOICES],
      reportedIn: [COPY_DRAFT],
    },
  },
]
