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

// An option case that gives both keys pins the one not under test: the default limit, or an empty
// ignore list, which counts the same as the default for the seven-hook component: it calls neither
// useCallback nor useMemo.
export const DEFAULT_HOOK_LIMIT = 7
export const LIMIT_BELOW_SEVEN = 6

export const hookCalledFourTimesInNineHookComponent = 'useState'
