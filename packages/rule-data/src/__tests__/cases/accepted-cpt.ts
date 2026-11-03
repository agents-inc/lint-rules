import type { RuleCase } from './changed-settings.ts'

// Measured with browserslist 4.29.3 and @mdn/browser-compat-data 6.1.5: requestIdleCallback is missing in Safari and
// iOS Safari 16.4, Array.toSorted() in Firefox 114, structuredClone in iOS Safari 12.

type BrowserViteBuildsFor = {
  readonly viteTarget: string
  readonly query: string
}

const MAJOR_BROWSERS_VITE_BUILDS_FOR: readonly BrowserViteBuildsFor[] = [
  { viteTarget: 'chrome111', query: 'chrome >= 111' },
  { viteTarget: 'edge111', query: 'edge >= 111' },
  { viteTarget: 'firefox114', query: 'firefox >= 114' },
  { viteTarget: 'safari16.4', query: 'safari >= 16.4' },
  { viteTarget: 'ios16.4', query: 'ios_saf >= 16.4' },
]

export const MAJOR_BROWSERS_AS_VITE_TARGETS = MAJOR_BROWSERS_VITE_BUILDS_FOR.map(({ query }) => query).join(', ')

export const VITE_DEFAULT_BUILD_TARGET = MAJOR_BROWSERS_VITE_BUILDS_FOR.map(({ viteTarget }) => viteTarget)

export type CaseInAProjectNamingBrowsers = RuleCase & {
  readonly projectManifest: string
}

const SCHEDULE_IDLE = { path: 'src/schedule-idle.ts', source: 'export const scheduleIdle = (task: () => void) => requestIdleCallback(task)\n' }

const SCHEDULE_SOON = { path: 'src/schedule-soon.ts', source: 'export const scheduleSoon = (task: () => void) => setTimeout(task, 0)\n' }

const LOAD_INVOICES = { path: 'src/load-invoices.ts', source: "export const loadInvoices = () => fetch('/api/invoices')\n" }

const COPY_DRAFT = { path: 'src/copy-draft.ts', source: 'export const copyDraft = <Draft>(draft: Draft) => structuredClone(draft)\n' }

export const ACCEPTED_COMPAT_CASES: readonly RuleCase[] = [
  {
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
  {
    rule: 'compat/compat',
    subject: 'an array method Firefox 114 lacks, which Vite 8 still builds for',
    silentIn: [{ path: 'src/sort-names-in-place.ts', source: 'export const sortNames = (names: readonly string[]) => [...names].sort()\n' }],
    reportedIn: [{ path: 'src/sort-names.ts', source: 'export const sortNames = (names: readonly string[]) => [...names].toSorted()\n' }],
  },
]

export const ACCEPTED_COMPAT_CASES_IN_PROJECTS_NAMING_BROWSERS: readonly CaseInAProjectNamingBrowsers[] = [
  {
    rule: 'compat/compat',
    subject: 'a project that names only Chrome, which still hears of the major browsers it leaves out',
    projectManifest: '{ "name": "kiosk-shell", "version": "0.0.0", "private": true, "browserslist": ["last 1 chrome version"] }\n',
    silentIn: [SCHEDULE_SOON],
    reportedIn: [SCHEDULE_IDLE],
  },
  {
    rule: 'compat/compat',
    subject: 'a project that names iPhones back to iOS 12, whose own browsers are checked as well',
    projectManifest: '{ "name": "field-app", "version": "0.0.0", "private": true, "browserslist": ["last 2 chrome versions", "ios_saf >= 12"] }\n',
    silentIn: [LOAD_INVOICES],
    reportedIn: [COPY_DRAFT],
  },
]
