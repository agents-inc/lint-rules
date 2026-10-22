export const createContextInComponent = `import { createContext } from 'react'

export function ThemeProvider({ children }) {
  const ThemeContext = createContext('light')
  return <ThemeContext.Provider value="dark">{children}</ThemeContext.Provider>
}`

export const moduleScopeContext = `import { createContext, useContext } from 'react'

const ThemeContext = createContext('light')

export function ThemeLabel() {
  const theme = useContext(ThemeContext)
  return <span>{theme}</span>
}
`

export const moduleLevelContextFactory = `import { createContext, useContext } from 'react'

function createSafeContext(defaultValue) {
  const Context = createContext(defaultValue)
  const useSafeContext = () => useContext(Context)
  return [Context.Provider, useSafeContext]
}

export const [ThemeProvider, useTheme] = createSafeContext('light')
`

export const moduleScopeContextWithMemoisedValue = `import { createContext, useMemo, useState } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light')
  const value = useMemo(() => ({ theme, setTheme }), [theme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
`

export const hookReadingImportedContext = `import { useContext } from 'react'
import { ThemeContext } from './theme-context'

export function useTheme() {
  const theme = useContext(ThemeContext)
  if (!theme) throw new Error('useTheme must be used inside ThemeProvider')
  return theme
}
`

export const contextInLazyUseMemo = `import { createContext, useMemo } from 'react'

export function ScopedProvider({ children }) {
  const Scoped = useMemo(() => createContext(null), [])
  return <Scoped.Provider value={1}>{children}</Scoped.Provider>
}
`

export const nodeVmNamespaceCreateContext = `import vm from 'node:vm'

export function useSandbox(source: string) {
  const sandbox = vm.createContext({ console })
  return vm.runInContext(source, sandbox)
}
`

export const locallyDeclaredCreateContext = `const createContext = (pathname: string, method = 'GET') => ({ pathname, method })

export function RouteBadge({ pathname }: { pathname: string }) {
  const ctx = createContext(pathname)
  return <span>{ctx.method} {ctx.pathname}</span>
}
`

export const contextInViMockFactory = `import { createContext } from 'react'
import { vi } from 'vitest'

vi.mock('./popover', () => {
  const PopoverContext = createContext({ open: false })
  return {
    Popover: ({ children, open }: { children: React.ReactNode; open: boolean }) => (
      <PopoverContext.Provider value={{ open }}>{children}</PopoverContext.Provider>
    ),
  }
})
`

export const nodeVmNamedImportCreateContext = `import { createContext, runInContext } from 'node:vm'

export function useSandbox(src: string) {
  const sandbox = createContext({ console })
  return runInContext(src, sandbox)
}
`

export const contextRetainedByUseRef = `import { createContext, useRef } from 'react'

export function ScopedPanel({ children }) {
  const Scoped = useRef(createContext(null)).current
  return <Scoped.Provider value={1}>{children}</Scoped.Provider>
}
`

export const contextRetainedByUseStateInitialValue = `import { createContext, useState } from 'react'

export function ScopedPanel({ children }) {
  const [Scoped] = useState(createContext(null))
  return <Scoped.Provider value={1}>{children}</Scoped.Provider>
}
`

export const lazyModuleLevelSingleton = `import { createContext, useContext } from 'react'

let cached: null | React.Context<unknown> = null
function getThemeContext() {
  if (!cached) cached = createContext<unknown>(null)
  return cached
}

export function useTheme() {
  return useContext(getThemeContext())
}
`

export const pascalCaseFactoryWithoutJsx = `import { createContext } from 'react'

export function CreateScopedStore(defaultValue) {
  const Ctx = createContext(defaultValue)
  const Provider = ({ children, value }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>
  return { Ctx, Provider }
}

export const { Ctx: ThemeCtx, Provider: ThemeProvider } = CreateScopedStore('light')
`

export const namespacedContextInUseMemo = `import React from 'react'

export function ScopedProvider({ children }) {
  const Scoped = React.useMemo(() => React.createContext(null), [])
  return <Scoped.Provider value={1}>{children}</Scoped.Provider>
}
`

export const classFieldAndMethod = `import { createContext } from 'react'

export class ThemeStore {
  ctx = createContext(null)
  build () {
    return createContext(null)
  }
}
`

// A custom hook runs on every render of the component calling it, and renders no JSX itself.
export const createContextInCustomHook = `import { createContext, useContext } from 'react'

export function useThemeContext() {
  const ThemeContext = createContext('light')
  return useContext(ThemeContext)
}
`

export const namespacedCreateContextInComponent = `import React from 'react'

export function ThemeProvider({ children }) {
  const ThemeContext = React.createContext('light')
  return <ThemeContext.Provider value="dark">{children}</ThemeContext.Provider>
}
`

// The member form is React's whatever the bare name `createContext` is bound to.
export const namespacedCreateContextBesideNodeVmImport = `import React from 'react'
import { createContext } from 'node:vm'

export const sandbox = createContext({ console })

export function ThemeProvider({ children }) {
  const ThemeContext = React.createContext('light')
  return <ThemeContext.Provider value="dark">{children}</ThemeContext.Provider>
}
`

// The key is a name whose value the rule cannot see.
export const computedCreateContextKeyInComponent = `import React from 'react'

export function ThemeProvider({ children }) {
  const ThemeContext = React[createContext]('light')
  return <ThemeContext.Provider value="dark">{children}</ThemeContext.Provider>
}
`

export const contextFromAPropertyNamedReact = `export function ThemeProvider({ children, scope }) {
  const ThemeContext = scope.React.createContext('light')
  return <ThemeContext.Provider value="dark">{children}</ThemeContext.Provider>
}
`
