export const effectsInsideUpdater = `import { useState, useRef } from 'react'

export function UploadTray() {
  const [files, setFiles] = useState<File[]>([])
  const seenRef = useRef(0)

  const clear = () => {
    setFiles((prev) => {
      prev.forEach((f) => URL.revokeObjectURL((f as any).preview))
      localStorage.setItem('uploads', '0')
      seenRef.current = prev.length
      return []
    })
  }

  return <button onClick={clear}>{files.length}</button>
}`

export const copiedSearchParamsMutated = `import { useSearchParams } from 'react-router-dom'

export function FilterBar() {
  const [, setSearchParams] = useSearchParams()
  const pick = (value: string) =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('a', 'b')
      next.delete('page')
      return next
    })
  return <button onClick={() => pick('x')}>filter</button>
}
`

export const arrayAndMapCopies = `import { useState } from 'react'

type Row = { done: boolean; id: string; }

export function Rows({ incoming }: { readonly incoming: Row[] }) {
  const [rows, setRows] = useState<Row[]>([])
  const [index, setIndex] = useState(new Map<string, Row>())

  const merge = () => {
    setRows((prev) => {
      const next = [...prev]
      next.push(...incoming)
      next.sort((a, b) => a.id.localeCompare(b.id))
      return next
    })
    setIndex((prev) => {
      const next = new Map(prev)
      for (const row of incoming) next.set(row.id, row)
      return next
    })
  }

  return <button onClick={merge}>{rows.length + index.size}</button>
}
`

export const pureComputationOnPrevAndProps = `import { useState } from 'react'

export function Toggles({ ids }: { readonly ids: string[] }) {
  const [selected, setSelected] = useState<string[]>([])

  const toggle = (id: string) =>
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id)
      return prev.concat(id).slice(0, Math.max(1, ids.length))
    })

  const invert = () =>
    setSelected((prev) => ids.filter((id) => !prev.includes(id)).map((id) => id.trim()))

  return <button onClick={() => { toggle('a'); invert() }}>{selected.length}</button>
}
`

export const setterStoredInHandler = `import { useState } from 'react'

type Row = { id: string; onOpen: () => void }

export function Table() {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Row[]>([])

  const load = (ids: string[]) =>
    setRows((prev) =>
      prev.concat(ids.map((id) => ({ id, onOpen: () => setOpen(true) }))),
    )

  return <button onClick={() => load(['a'])}>{open ? rows.length : 0}</button>
}
`

export const effectsInEventHandler = `import { useRef, useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)
  const lastRef = useRef(0)

  const bump = () => {
    lastRef.current = count
    localStorage.setItem('count', String(count + 1))
    setCount((prev) => prev + 1)
    setTimeout(() => setCount((prev) => prev + 1), 100)
  }

  return <button onClick={bump}>{count}</button>
}
`

export const objectStateRebuiltBySpread = `import { useState } from 'react'

export function Form() {
  const [form, setForm] = useState({ name: '', tags: [] as string[] })

  const rename = (name: string) =>
    setForm((prev) => ({ ...prev, name: name.trim().toLowerCase() }))

  const addTag = (tag: string) =>
    setForm((prev) => {
      if (prev.tags.includes(tag)) return prev
      return { ...prev, tags: [...prev.tags, tag].sort() }
    })

  return <button onClick={() => { rename('x'); addTag('y') }}>{form.name}</button>
}
`

export const nonReactSetApis = `export function schedule(el: HTMLElement, store: Storage) {
  setTimeout(() => {
    el.setAttribute('data-ready', 'true')
    store.setItem('ready', '1')
  }, 100)
  const stop = setInterval(function tick() {
    el.classList.add('tick')
  }, 1000)
  return () => clearInterval(stop)
}
`

export const pureSetHelperAndBuilderApi = `import { useState } from 'react'
import { setModelPreference } from './prefs'

type Lazy = { setDataGetter: (get: (chunk: number) => Uint8Array) => void }

export function Prefs({ model, lazy }: { readonly lazy: Lazy; readonly model: string; }) {
  const [config, setConfig] = useState({})

  const level = (value: number) =>
    setConfig((prev) => setModelPreference(prev, model, { level: value }))

  lazy.setDataGetter((chunk) => {
    const cache: Record<number, Uint8Array> = (globalThis as any).__cache
    cache[chunk] = new Uint8Array(chunk)
    return cache[chunk]
  })

  return <button onClick={() => level(2)}>{Object.keys(config).length}</button>
}
`

export const localSetMutatedInFilter = `import { useState } from 'react'

type Row = { at: number; id: string; }

export function Feed({ incoming }: { readonly incoming: Row[] }) {
  const [rows, setRows] = useState<Row[]>([])

  const append = () =>
    setRows((prev) => {
      const seen = new Set<string>()
      return prev
        .concat(incoming.map((row) => ({ ...row, at: Date.now() })))
        .filter((row) => {
          if (seen.has(row.id)) return false
          seen.add(row.id)
          return true
        })
        .sort((a, b) => b.at - a.at)
    })

  return <button onClick={append}>{rows.length}</button>
}
`

export const pureClassSetStateUpdater = `import { Component, createRef } from 'react'

type Props = { readonly max: number; readonly step: number; }
type State = { count: number; history: number[] }

export class Stepper extends Component<Props, State> {
  state: State = { count: 0, history: [] }
  private boxRef = createRef<HTMLDivElement>()

  private bump = () => {
    this.setState((prev) => {
      const next = Math.min(prev.count + this.props.step, this.props.max)
      const history = [...prev.history, next]
      history.sort((a, b) => a - b)
      return { count: next, history: history.slice(-this.boxRef.current!.childElementCount) }
    })
  }

  render() {
    return <div onClick={this.bump} ref={this.boxRef}>{this.state.count}</div>
  }
}
`

export const pureSetHelpersAssignedAndMapped = `import { useState } from 'react'
import { setArchived, setDefaults } from './records'

type Record = { archived: boolean; id: string; }

export function Records() {
  const [config, setConfig] = useState({})
  const [records, setRecords] = useState<Record[]>([])

  const reset = () =>
    setConfig((prev) => {
      const next = setDefaults(prev)
      return next
    })

  const archiveAll = () => setRecords((prev) => prev.map((record) => setArchived(record)))

  return <button onClick={() => { reset(); archiveAll() }}>{records.length + Object.keys(config).length}</button>
}
`

export const setterCalledInsideUpdater = `import { useState } from 'react'

export function Cart({ item }: { readonly item: string }) {
  const [items, setItems] = useState<string[]>([])
  const [count, setCount] = useState(0)

  const add = () =>
    setItems((prev) => {
      setCount(prev.length + 1)
      return [...prev, item]
    })

  return <button onClick={add}>{count}{items.length}</button>
}
`

/** A state updater writing storage through `globalAlias.localStorage`, on line 9. */
export function storageWriteThrough(globalAlias: string): string {
  return `import { useState } from 'react'

export function Theme() {
  const [theme, setTheme] = useState('light')

  const toggle = () =>
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light'
      ${globalAlias}.localStorage.setItem('theme', next)
      return next
    })

  return <button onClick={toggle}>{theme}</button>
}
`
}

export const storageWriteThroughWindow = storageWriteThrough('window')

// The updater builds handlers that write storage when called, and calls none of them.
export const effectsInFunctionsTheUpdaterOnlyBuilds = `import { useState } from 'react'

type Handlers = { save?: () => void; flush?: () => void; clear?: () => void }

export function DraftHandlers({ draft }: { readonly draft: string }) {
  const [handlers, setHandlers] = useState<Handlers>({})

  const rebuild = () =>
    setHandlers((prev) => {
      const save = () => localStorage.setItem('draft', draft)
      const flush = function () {
        localStorage.removeItem('draft')
      }
      function clear() {
        sessionStorage.clear()
      }
      return { ...prev, save, flush, clear }
    })

  return <button onClick={rebuild}>{Object.keys(handlers).length}</button>
}
`

// A callback handed to a call that is not an array iteration may run later, outside the update.
export const effectInCallbackHandedToNonIteratingCall = `import { useState } from 'react'

type Registry = { onFlush: (run: () => void) => void }

export function Queue({ registry, job }: { readonly registry: Registry; readonly job: string }) {
  const [jobs, setJobs] = useState<string[]>([])

  const enqueue = () =>
    setJobs((prev) => {
      registry.onFlush(() => localStorage.setItem('last-job', job))
      return [...prev, job]
    })

  return <button onClick={enqueue}>{jobs.length}</button>
}
`

/** A state updater running `statement` on line 2, then returning the state it was given. */
export function stateUpdaterRunning(statement: string): string {
  return `setItems((prev) => {
  ${statement}
  return prev
})
`
}

// `#current` is a private field of the class, not a ref's `current`.
export const privateFieldNamedCurrentWrittenInUpdater = `class Counter {
  #current = 0

  sync(other) {
    setCount((count) => {
      other.#current = count
      return count
    })
  }
}
`

// `settle` starts with set but not set and a capital; `resetCount` holds setC without starting with it.
export const effectsPassedToFunctionsNotNamedLikeSetters = `export function sync(
  settle: (update: (value: number) => number) => void,
  resetCount: (update: (value: number) => number) => void,
) {
  settle((value) => {
    localStorage.setItem('settled', String(value))
    return value
  })
  resetCount((value) => {
    localStorage.setItem('reset', String(value))
    return 0
  })
}
`

/** A component whose state updater runs `statement` before it returns, `statement` on line 9. */
export function updaterRunning(statement: string): string {
  return `import { useState } from 'react'

const seen = []

export function Seen() {
  const [items, setItems] = useState([])
  const mark = () =>
    setItems((prev) => {
      ${statement}
      return prev
    })
  return <button onClick={mark}>{items.length}</button>
}
`
}

// The methods that run their callback inside the updater, before it returns.
export const SYNC_CALLBACK_METHODS = [
  'forEach',
  'map',
  'filter',
  'reduce',
  'reduceRight',
  'flatMap',
  'find',
  'findIndex',
  'findLast',
  'findLastIndex',
  'some',
  'every',
  'sort',
  'flat',
]

/** An updater handing `method` a callback with a storage write on line 10. */
export function effectInCallbackHandedTo(method: string): string {
  return updaterRunning(`prev.${method}((item) => {
        localStorage.setItem('seen', '1')
        return item
      })`)
}

export const MUTATING_METHODS = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse',
  'fill',
  'copyWithin',
  'set',
  'add',
  'delete',
  'clear',
]

export const GLOBAL_EFFECT_CALLS = [
  'fetch',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'queueMicrotask',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
]

// Each effect reached through a global, besides localStorage.setItem and URL.revokeObjectURL.
export const MEMBER_EFFECT_CALLS = [
  'localStorage.removeItem',
  'localStorage.clear',
  'sessionStorage.setItem',
  'sessionStorage.removeItem',
  'sessionStorage.clear',
  'indexedDB.open',
  'URL.createObjectURL',
  'navigator.sendBeacon',
  'navigator.clipboard.writeText',
  'navigator.clipboard.write',
  'history.pushState',
  'history.replaceState',
  'history.go',
  'history.back',
  'history.forward',
  'axios.post',
]

// Named like setters and handed a function, but they schedule it.
export const SCHEDULERS_NAMED_LIKE_SETTERS = ['setTimeout', 'setInterval', 'setImmediate']

/** A component handing `scheduler` a callback with a storage write, outside any updater. */
export function effectInCallbackScheduledBy(scheduler: string): string {
  return `export function Ticker() {
  ${scheduler}(() => {
    localStorage.setItem('tick', '1')
  }, 1000)
  return null
}
`
}

export const effectInClassSetStateUpdater = `import { Component } from 'react'

export class Counter extends Component {
  bump = () => {
    this.setState((prev) => {
      localStorage.setItem('count', String(prev.count))
      return { count: prev.count + 1 }
    })
  }

  render() {
    return <button onClick={this.bump}>{this.state.count}</button>
  }
}
`

export const effectInFunctionExpressionUpdater = `import { useState } from 'react'

export function Seen() {
  const [items, setItems] = useState([])
  const mark = () =>
    setItems(function next(prev) {
      localStorage.setItem('seen', '1')
      return prev
    })
  return <button onClick={mark}>{items.length}</button>
}
`

// react-router's setSearchParams(init, options) shape: an updater and one more argument.
export const effectInUpdaterBesideOptions = `export function Search({ setSearchParams }) {
  const clear = () =>
    setSearchParams((prev) => {
      localStorage.setItem('query', '')
      return prev
    }, { replace: true })
  return <button onClick={clear}>Clear</button>
}
`

// A third argument means some other set* API.
export const effectInSetterTakingThreeArguments = `export function Map({ setPosition }) {
  const center = () =>
    setPosition((prev) => {
      localStorage.setItem('centered', '1')
      return prev
    }, 0, 0)
  return <button onClick={center}>Center</button>
}
`

// A setter call reached through a ternary, a logical and a comma in statement position is still discarded.
export const settersDiscardedThroughConditionalLogicalAndSequence = updaterRunning(`prev.length > 0 ? setOther(prev.length) : null
      prev.length > 0 && setOther(prev.length)
      void 0, setOther(prev.length)`)

export const writeToAPropertyOfACopy = updaterRunning(`const next = { ...prev }
      next.count = 1`)

export const writeToAPropertyOfAValueMadeOnTheSpot = updaterRunning('getDraft().count = 1')

export const writeToAPropertyOfADeclaredFunction = updaterRunning(`function tally() {}
      tally.count = prev.length`)

// Every name bound anywhere in the updater counts as its own, a constructor parameter property's too.
export const mutationOfANameAParameterPropertyBinds = updaterRunning(`class Bag {
        constructor(public seen: string[]) {}
      }
      seen.push(prev.length)`)

// And every form of pattern binds one: a destructured property, an object's rest, an array element, a default
// value, a rest element, a caught error, and an element past a hole.
export const mutationOfANameADestructuredPropertyBinds = updaterRunning(`const { items } = { items: prev.slice() }
      items.push(prev.length)`)

export const writeToTheRestOfADestructuredObject = updaterRunning(`const { ...draft } = prev
      draft.count = prev.length`)

export const mutationOfANameAnArrayPatternBinds = updaterRunning(`const [copy] = [prev.slice()]
      copy.push(prev.length)`)

export const mutationOfANameBoundWithADefaultValue = updaterRunning(`const { copy = [] } = { copy: prev.slice() }
      copy.push(prev.length)`)

export const mutationOfACopyARestElementCollects = updaterRunning(`const [...copy] = prev
      copy.push(prev.length)`)

export const writeToTheErrorACatchClauseBinds = updaterRunning(`try {
        prev.at(0)
      } catch (error) {
        error.seen = prev.length
      }`)

export const mutationOfANameBoundPastAHole = updaterRunning(`const [, copy] = [prev, prev.slice()]
      copy.push(prev.length)`)

export const assignmentToAPlainVariable = updaterRunning('count = prev.length')

export const setterCalledWithTwoArguments = updaterRunning("setOther(prev.length, 'extra')")

export const bareCallNamedLikeAMutator = updaterRunning('push(prev.length)')

export const mutationThroughANestedPath = updaterRunning('store.items.push(prev.length)')

// One finding of each kind, in source order.
export const everyFindingInOneUpdater = `export function Tray({ ref, seen, setOther, setItems }) {
  const clear = () =>
    setItems((prev) => {
      localStorage.setItem('seen', '1')
      setOther(prev.length)
      ref.current = prev.length
      ref.current.push(prev.length)
      seen.push(prev.length)
      return prev
    })
  return clear
}
`
