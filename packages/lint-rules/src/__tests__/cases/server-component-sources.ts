import type { Linter } from 'eslint'
import type { ProjectFiles } from '../temp-projects.ts'

// eslint-plugin-hydration-proof 1.0.1 skips a file under its setting serverComponents: 'next-app' where the file has
// no 'use client' and any folder in its path, from ESLint's cwd, is named app: how the Next.js App Router marks a
// page the server renders alone. Remix keeps its routes in app/ too, and they hydrate. Each source below draws one
// report, on the line its comment names, wherever the setting is off (measured).

export const TIME_ZONE_RULE = 'hydration-proof/no-timezone-without-explicit-timezone'

/** Without 'use client' under app/: a Server Component. */
export const SERVER_PAGE = 'app/invoices/page.tsx'
export const SERVER_PAGE_BRANCHING_ON_WINDOW = 'app/greeting/page.tsx'
export const SERVER_PAGE_UNDER_SRC = 'src/app/reports/page.tsx'
export const CLIENT_COMPONENT = 'app/invoices/issued-on.tsx'
export const PAGES_ROUTER_PAGE = 'pages/invoices.tsx'
/** No 'use client' of its own, under app/, and imported by a file with one, so it hydrates. */
export const COMPONENT_A_CLIENT_COMPONENT_IMPORTS = 'app/dashboard/chart-label.tsx'
/** In a folder named app that is no App Router folder. */
export const COMPONENT_IN_ANOTHER_APP_FOLDER = 'src/components/app/posted.tsx'
export const REMIX_ROUTE = 'app/routes/_index.tsx'

/** A monorepo's app folders, each with a package.json of its own. */
export const NEXT_APP_FOLDER = 'apps/web'
export const REMIX_APP_FOLDER = 'apps/site'
export const ANOTHER_NEXT_APP_FOLDER = 'apps/admin'

// Line 2.
const PAGE_SHOWING_A_DATE = `export default function InvoicesPage({ issuedAt }: { issuedAt: string }) {
  return <p>Issued {new Date(issuedAt).toLocaleDateString('en-GB')}</p>
}
`

// Line 2, by no-window-render-branch.
const PAGE_BRANCHING_ON_WINDOW = `export default function GreetingPage() {
  return typeof window === 'undefined' ? <span>Loading</span> : <span>Hello</span>
}
`

// Line 4.
const DATE_IN_A_CLIENT_COMPONENT = `'use client'

export function IssuedOn({ issuedAt }: { issuedAt: string }) {
  return <p>Issued {new Date(issuedAt).toLocaleDateString('en-GB')}</p>
}
`

// Reports nothing either way: it renders the component below.
const CLIENT_COMPONENT_IMPORTING_ANOTHER = `'use client'
import { ChartLabel } from './chart-label'

export function Chart({ at }: { at: string }) {
  return <ChartLabel at={at} />
}
`

// Line 2.
const COMPONENT_SHOWING_AN_HOUR = `export function ChartLabel({ at }: { at: string }) {
  return <span>{new Date(at).getHours()}</span>
}
`

// Line 2.
const DATE_IN_A_ROUTE = `export default function Index({ at }: { at: string }) {
  return <p>{new Date(at).toLocaleDateString('en-GB')}</p>
}
`

export const SOURCES_OF_A_NEXT_APP: ProjectFiles = {
  [SERVER_PAGE]: PAGE_SHOWING_A_DATE,
  [SERVER_PAGE_BRANCHING_ON_WINDOW]: PAGE_BRANCHING_ON_WINDOW,
  [SERVER_PAGE_UNDER_SRC]: PAGE_SHOWING_A_DATE,
  [CLIENT_COMPONENT]: DATE_IN_A_CLIENT_COMPONENT,
  [PAGES_ROUTER_PAGE]: PAGE_SHOWING_A_DATE,
  'app/dashboard/chart.tsx': CLIENT_COMPONENT_IMPORTING_ANOTHER,
  [COMPONENT_A_CLIENT_COMPONENT_IMPORTS]: COMPONENT_SHOWING_AN_HOUR,
  [COMPONENT_IN_ANOTHER_APP_FOLDER]: PAGE_SHOWING_A_DATE,
}

export const SOURCES_OF_A_REMIX_APP: ProjectFiles = { [REMIX_ROUTE]: DATE_IN_A_ROUTE }

export const SERVER_PAGE_SOURCE = PAGE_SHOWING_A_DATE

export const REMIX_ROUTE_SOURCE = DATE_IN_A_ROUTE

/** A team block after ours giving the plugin's setting its other value: the team's own setting stands. */
export const TEAM_SETTING_SERVER_COMPONENTS_OFF: Linter.Config = { name: 'team/server-components-off', settings: { 'hydration-proof': { serverComponents: 'none' } } }
