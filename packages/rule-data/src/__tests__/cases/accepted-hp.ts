import type { HeldCase } from '../accepted-rules-out-of-place.ts'
import type { RuleCase } from './changed-settings.ts'

// Loading a stored value in an effect, the storage rule's own advice, is what the shipped
// react-you-might-not-need-an-effect/no-initialize-state reports; a store read through useSyncExternalStore with a
// server snapshot satisfies both (measured, 1.0.1).

export const ACCEPTED_HYDRATION_PROOF_CASES: readonly RuleCase[] = [
  {
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
  {
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
  {
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
  {
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
]

export const ACCEPTED_HP_HELD_CASES: ReadonlyArray<HeldCase<RuleCase>> = []
