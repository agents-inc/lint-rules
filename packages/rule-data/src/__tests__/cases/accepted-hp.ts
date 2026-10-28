import type { HeldCase } from '../accepted-rules-out-of-place.ts'
import type { RuleCase } from './changed-settings.ts'

// The hydration-proof rules the owner accepted on 2026-10-24: each reports code a React component or hook runs while it
// renders that gives the server one result and the browser another, and stays silent on the card's fix and on the same
// code moved into an effect or an event handler, which run in the browser alone. No rule looks for a server, so each
// reports in an app that never renders on one, which is why the owner made react-ssr opt-in (card
// q-lint-react-ssr-in-client-apps, "Make react-ssr opt-in"). Loading a stored value in an effect, the storage rule's own
// advice, is what the shipped react-you-might-not-need-an-effect/no-initialize-state reports; a store read through
// useSyncExternalStore with a server snapshot satisfies both (measured, 1.0.1). Each rule's build waits on a card, so
// each case is held (below) and no hydration-proof rule ships yet.

/** The shipped accepted hydration-proof rules' report cases beside their silent twins, in rule ID order. None ships yet. */
export const ACCEPTED_HYDRATION_PROOF_CASES: readonly RuleCase[] = []

const HYDRATION_FALSE_ALARMS_MEASURED = 'q-lint-rc-hydration-false-alarms-measured'
const HYDRATION_TIMEZONE_HOLD = 'q-lint-hp-timezone-hold'
const HYDRATION_SERVER_COMPONENTS_GAP = 'q-lint-hp-server-components-gap'

/**
 * The accepted hydration-proof rules whose build waits on a card, each case held unrun until its rule ships, in rule ID
 * order.
 *
 * no-browser-global-in-render and no-locale-without-explicit-locale each report code a competent developer would defend,
 * read on the corpus's code that renders on a server (1.0.1). no-browser-global-in-render: a portal target read behind a
 * flag an effect sets, React's own way to render the browser's content after hydrating, and a component its one Next.js
 * user loads with `ssr: false`. no-locale-without-explicit-locale: a chart library's tooltips, which render only once a
 * pointer hovers, so never on the server or while hydrating.
 *
 * The other four wait on whether they ship while the catalog cannot pass the plugin's setting that skips a file only a
 * server renders (HYDRATION_SERVER_COMPONENTS_GAP), and no-timezone-without-explicit-timezone on whether it waits with
 * the two above (HYDRATION_TIMEZONE_HOLD) as well; a held case names one card.
 */
export const ACCEPTED_HP_HELD_CASES: ReadonlyArray<HeldCase<RuleCase>> = [
  {
    heldBy: HYDRATION_FALSE_ALARMS_MEASURED,
    ruleCase: {
      rule: 'hydration-proof/no-browser-global-in-render',
      silentIn: [
        {
          path: 'src/modal-after-mount.tsx',
          source: `'use client'
import { createPortal } from 'react-dom'
import { useEffect, useState, type ReactNode } from 'react'

export function Modal({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  useEffect(() => setTarget(document.body), [])
  return target ? createPortal(children, target) : null
}
`,
        },
        {
          path: 'src/back-button.tsx',
          source: `export function BackButton() {
  return (
    <button type="button" onClick={() => window.history.back()}>
      Back
    </button>
  )
}
`,
        },
      ],
      reportedIn: [
        {
          path: 'src/modal.tsx',
          source: `import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

export function Modal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body)
}
`,
        },
        {
          path: 'src/use-viewport-width.js',
          source: `export function useViewportWidth() {
  return window.innerWidth
}
`,
        },
      ],
    },
  },
  {
    heldBy: HYDRATION_FALSE_ALARMS_MEASURED,
    ruleCase: {
      rule: 'hydration-proof/no-locale-without-explicit-locale',
      silentIn: [
        {
          path: 'src/price-in-british-english.tsx',
          source: `export function Price({ amount }: { amount: number }) {
  return <span>{amount.toLocaleString('en-GB')}</span>
}
`,
        },
        {
          path: 'src/price-announced-on-click.tsx',
          source: `export function Price({ amount }: { amount: number }) {
  return (
    <button type="button" onClick={() => alert(amount.toLocaleString())}>
      Show the price
    </button>
  )
}
`,
        },
      ],
      reportedIn: [
        {
          path: 'src/price.tsx',
          source: `export function Price({ amount }: { amount: number }) {
  return <span>{amount.toLocaleString()}</span>
}
`,
        },
        {
          path: 'src/total.jsx',
          source: `export function Total({ total }) {
  return <strong>{new Intl.NumberFormat().format(total)}</strong>
}
`,
        },
      ],
    },
  },
  {
    heldBy: HYDRATION_SERVER_COMPONENTS_GAP,
    ruleCase: {
      rule: 'hydration-proof/no-storage-in-initial-render',
      silentIn: [
        {
          path: 'src/theme-after-mount.tsx',
          source: `import { useEffect, useState } from 'react'

export function Theme() {
  const [theme, setTheme] = useState('light')
  useEffect(() => setTheme(localStorage.getItem('theme') ?? 'light'), [])
  return <span>{theme}</span>
}
`,
        },
        {
          path: 'src/theme-from-store.tsx',
          source: `import { useSyncExternalStore } from 'react'

function subscribe(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange)
  return () => window.removeEventListener('storage', onStoreChange)
}

function storedTheme() {
  return localStorage.getItem('theme') ?? 'light'
}

function serverTheme() {
  return 'light'
}

export function Theme() {
  const theme = useSyncExternalStore(subscribe, storedTheme, serverTheme)
  return <span>{theme}</span>
}
`,
        },
        {
          path: 'src/theme-saved-on-click.tsx',
          source: `export function DarkModeButton() {
  return (
    <button type="button" onClick={() => localStorage.setItem('theme', 'dark')}>
      Dark mode
    </button>
  )
}
`,
        },
      ],
      reportedIn: [
        {
          path: 'src/theme-from-storage.tsx',
          source: `import { useState } from 'react'

export function Theme() {
  const [theme] = useState(() => localStorage.getItem('theme') ?? 'light')
  return <span>{theme}</span>
}
`,
        },
        {
          path: 'src/sidebar-from-session.jsx',
          source: `export function Sidebar() {
  const isOpen = sessionStorage.getItem('sidebar') === 'open'
  return <aside hidden={!isOpen}>Menu</aside>
}
`,
        },
      ],
    },
  },
  {
    heldBy: HYDRATION_TIMEZONE_HOLD,
    ruleCase: {
      rule: 'hydration-proof/no-timezone-without-explicit-timezone',
      silentIn: [
        {
          path: 'src/posted-on-in-utc.tsx',
          source: `export function Posted({ at }: { at: string }) {
  return <span>{new Date(at).toLocaleDateString('en-GB', { timeZone: 'UTC' })}</span>
}
`,
        },
        {
          path: 'src/posted-hour-in-utc.tsx',
          source: `export function PostedHour({ at }: { at: string }) {
  return <span>{new Date(at).getUTCHours()}</span>
}
`,
        },
        // KNOWN GAP, open on card q-lint-hp-server-components-gap: a Next.js App Router file without 'use client' is a
        // Server Component, which never hydrates, yet the rule reports it (measured, 1.0.1): the plugin skips such files
        // only under its next preset's ESLint setting (serverComponents: 'next-app'), and the catalog ships no settings.
        // {
        //   path: 'app/invoices/page.tsx',
        //   source: `export default function InvoicesPage({ issuedAt }: { issuedAt: string }) {
        //   return <p>Issued {new Date(issuedAt).toLocaleDateString('en-GB')}</p>
        // }
        // `,
        // },
      ],
      reportedIn: [
        {
          path: 'src/posted-on.tsx',
          source: `export function Posted({ at }: { at: string }) {
  return <span>{new Date(at).toLocaleDateString('en-GB')}</span>
}
`,
        },
        {
          path: 'src/posted-hour.jsx',
          source: `export function PostedHour({ at }) {
  return <span>{new Date(at).getHours()}</span>
}
`,
        },
      ],
    },
  },
  {
    heldBy: HYDRATION_SERVER_COMPONENTS_GAP,
    ruleCase: {
      rule: 'hydration-proof/no-window-render-branch',
      silentIn: [
        {
          path: 'src/greeting-everywhere.tsx',
          source: `export function Greeting() {
  return <span>Hello</span>
}
`,
        },
        {
          path: 'src/title-after-mount.tsx',
          source: `import { useEffect } from 'react'

export function Greeting() {
  useEffect(() => {
    if (typeof window !== 'undefined') document.title = 'Hello'
  }, [])
  return <span>Hello</span>
}
`,
        },
      ],
      reportedIn: [
        {
          path: 'src/greeting.tsx',
          source: `export function Greeting() {
  return typeof window === 'undefined' ? <span>Loading</span> : <span>Hello</span>
}
`,
        },
        {
          path: 'src/greeting-server-flag.jsx',
          source: `const isServer = typeof window === 'undefined'

export function Greeting() {
  return isServer ? <span>Loading</span> : <span>Hello</span>
}
`,
        },
      ],
    },
  },
  {
    heldBy: HYDRATION_SERVER_COMPONENTS_GAP,
    ruleCase: {
      rule: 'hydration-proof/require-stable-server-snapshot',
      silentIn: [
        {
          path: 'src/online-on-the-server.tsx',
          source: `import { useSyncExternalStore } from 'react'

const subscribe = (callback: () => void) => {
  window.addEventListener('online', callback)
  return () => window.removeEventListener('online', callback)
}
export function Online() {
  const isOnline = useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
  return <span>{isOnline ? 'online' : 'offline'}</span>
}
`,
        },
        {
          path: 'src/width-on-the-server.tsx',
          source: `import * as React from 'react'

const subscribe = (callback: () => void) => {
  window.addEventListener('resize', callback)
  return () => window.removeEventListener('resize', callback)
}
export function Width() {
  const width = React.useSyncExternalStore(subscribe, () => window.innerWidth, () => 0)
  return <span>{width}</span>
}
`,
        },
      ],
      reportedIn: [
        {
          path: 'src/online.tsx',
          source: `import { useSyncExternalStore } from 'react'

const subscribe = (callback: () => void) => {
  window.addEventListener('online', callback)
  return () => window.removeEventListener('online', callback)
}
export function Online() {
  const isOnline = useSyncExternalStore(subscribe, () => navigator.onLine)
  return <span>{isOnline ? 'online' : 'offline'}</span>
}
`,
        },
        {
          path: 'src/width.tsx',
          source: `import * as React from 'react'

const subscribe = (callback: () => void) => {
  window.addEventListener('resize', callback)
  return () => window.removeEventListener('resize', callback)
}
export function Width() {
  const width = React.useSyncExternalStore(subscribe, () => window.innerWidth)
  return <span>{width}</span>
}
`,
        },
        {
          path: 'src/clock-on-the-server.jsx',
          source: `import { useSyncExternalStore } from 'react'

const subscribe = (callback) => {
  const timer = setInterval(callback, 1000)
  return () => clearInterval(timer)
}
export function Clock() {
  const now = useSyncExternalStore(subscribe, () => Date.now(), () => Date.now())
  return <time>{now}</time>
}
`,
        },
      ],
    },
  },
]
