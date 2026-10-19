export const componentWithNineHooks = `import { useContext, useEffect, useId, useRef, useState } from 'react'
const Ctx = {} as never
export function Panel() {
  const [a, setA] = useState(0)
  const [b] = useState(0)
  const [c, setC] = useState(0)
  const [d] = useState(0)
  const r1 = useRef(null)
  const r2 = useRef(null)
  const id = useId()
  const ctx = useContext(Ctx)
  useEffect(function sync() {
    setC(a)
  }, [a])
  return <div onClick={() => setA(1)}>{a}{b}{c}{d}{String(r1)}{String(r2)}{id}{String(ctx)}</div>
}`

export const componentWithSevenHooks = `import { useId, useRef, useState } from 'react'
export function Panel() {
  const [a, setA] = useState(0)
  const [b] = useState(0)
  const [c] = useState(0)
  const [d] = useState(0)
  const r1 = useRef(null)
  const r2 = useRef(null)
  const id = useId()
  return <div onClick={() => setA(1)}>{a}{b}{c}{d}{String(r1)}{String(r2)}{id}</div>
}
`

// Pins the key not under test. The seven-hook fixture calls no memo hook, so an empty ignore
// list counts as the default.
export const DEFAULT_HOOK_LIMIT = 7
export const LIMIT_BELOW_SEVEN = 6

export const hookCalledFourTimesInNineHookComponent = 'useState'

// Renders no JSX itself.
export const pascalCaseProviderWithNineHooks = `import { useContext, useEffect, useId, useRef, useState } from 'react'
const Ctx = {} as never
export function SessionProvider({ children }: { readonly children: unknown }) {
  const [a] = useState(0)
  const [b] = useState(0)
  const [c] = useState(0)
  const [d] = useState(0)
  const r1 = useRef(null)
  const r2 = useRef(null)
  const id = useId()
  const ctx = useContext(Ctx)
  useEffect(function log() {
    console.log(a, b, c, d, r1, r2, id, ctx)
  }, [a, b, c, d, id, ctx])
  return children
}
`

export const camelCaseRenderHelperWithNineHooks = `import { useContext, useEffect, useId, useRef, useState } from 'react'
const Ctx = {} as never
export function renderPanel() {
  const [a] = useState(0)
  const [b] = useState(0)
  const [c] = useState(0)
  const [d] = useState(0)
  const r1 = useRef(null)
  const r2 = useRef(null)
  const id = useId()
  const ctx = useContext(Ctx)
  useEffect(function log() {
    console.log(a)
  }, [a])
  return <div>{b}{c}{d}{String(r1)}{String(r2)}{id}{String(ctx)}</div>
}
`

// Plain JavaScript: ESLint's default parser reads no types. Uncounted by default, useMemo is the
// hook that takes the component past LIMIT_OF_THE_MEMO_MODULE.
export const componentWithAMemoHookModule = `export function Panel() {
  const [count] = useState(0)
  const ref = useRef(null)
  const doubled = useMemo(() => count * 2, [count])
  return <div ref={ref}>{doubled}</div>
}
`

export const LIMIT_OF_THE_MEMO_MODULE = 2

export const ignoreListLeavingUseMemoCounted: readonly string[] = ['useCallback']
