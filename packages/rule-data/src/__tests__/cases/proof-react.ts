import type { RuleCase } from './changed-settings.ts'

// A rule another case list or the ESLint fallback proves is left to it. css-modules/no-undef-class has no case: it reads
// the stylesheet beside the file, and every file a case writes is linted, which ESLint does not do to a stylesheet.

type SourceFileType = 'jsx' | 'tsx'

type Proof = { readonly reported: string; readonly corrected: string; readonly fileType?: SourceFileType }

function reportedAndCorrected(rule: string, { reported, corrected, fileType = 'tsx' }: Proof): RuleCase {
  return {
    rule,
    silentIn: [{ path: `src/corrected.${fileType}`, source: corrected }],
    reportedIn: [{ path: `src/reported.${fileType}`, source: reported }],
  }
}

export const PROOF_REACT_CASES: readonly RuleCase[] = [
  reportedAndCorrected('@eslint-react/dom-no-dangerously-set-innerhtml', {
    reported: 'export const Raw = ({ html }: { html: string }) => <div dangerouslySetInnerHTML={{ __html: html }} />\n',
    corrected: 'export const Raw = ({ text }: { text: string }) => <div>{text}</div>\n',
  }),
  reportedAndCorrected('@eslint-react/dom-no-flush-sync', {
    reported: "import { flushSync } from 'react-dom'\nexport function sync(run: () => void) {\n  flushSync(run)\n}\n",
    corrected: 'export function sync(run: () => void) {\n  run()\n}\n',
  }),
  reportedAndCorrected('@eslint-react/dom-no-hydrate', {
    reported: "import ReactDOM from 'react-dom'\nexport function boot(node: Element) {\n  ReactDOM.hydrate(<div />, node)\n}\n",
    corrected: "import { hydrateRoot } from 'react-dom/client'\nexport function boot(node: Element) {\n  hydrateRoot(node, <div />)\n}\n",
  }),
  reportedAndCorrected('@eslint-react/dom-no-missing-button-type', {
    reported: 'export const Go = () => <button>go</button>\n',
    corrected: 'export const Go = () => <button type="button">go</button>\n',
  }),
  reportedAndCorrected('@eslint-react/dom-no-missing-iframe-sandbox', {
    reported: 'export const Frame = () => <iframe src="/embed" title="embed" />\n',
    corrected: 'export const Frame = () => <iframe src="/embed" title="embed" sandbox="allow-popups" />\n',
  }),
  reportedAndCorrected('@eslint-react/dom-no-render', {
    reported: "import ReactDOM from 'react-dom'\nexport function boot(node: Element) {\n  ReactDOM.render(<div />, node)\n}\n",
    corrected: "import { createRoot } from 'react-dom/client'\nexport function boot(node: Element) {\n  createRoot(node).render(<div />)\n}\n",
  }),
  reportedAndCorrected('@eslint-react/dom-no-script-url', {
    reported: 'export const Link = () => <a href="javascript:void(0)">click</a>\n',
    corrected: 'export const Link = () => <a href="/home">click</a>\n',
  }),
  reportedAndCorrected('@eslint-react/dom-no-string-style-prop', {
    reported: "export const Styled = () => <div style={'color: red' as never} />\n",
    corrected: "export const Styled = () => <div style={{ color: 'red' }} />\n",
  }),
  reportedAndCorrected('@eslint-react/dom-no-unknown-property', {
    reported: 'export const Odd = () => <div class="box" />\n',
    corrected: 'export const Odd = () => <div className="box" />\n',
  }),
  reportedAndCorrected('@eslint-react/dom-no-unsafe-iframe-sandbox', {
    reported: 'export const Frame = () => (\n  <iframe src="/embed" title="embed" sandbox="allow-scripts allow-same-origin" />\n)\n',
    corrected: 'export const Frame = () => (\n  <iframe src="/embed" title="embed" sandbox="allow-scripts" />\n)\n',
  }),
  reportedAndCorrected('@eslint-react/dom-no-unsafe-target-blank', {
    reported: 'export const Out = () => <a href="https://example.com" target="_blank">out</a>\n',
    corrected: 'export const Out = () => <a href="https://example.com" target="_blank" rel="noreferrer noopener">out</a>\n',
  }),
  reportedAndCorrected('@eslint-react/dom-no-use-form-state', {
    reported: "import { useFormState } from 'react-dom'\nexport function useForm(action: never) {\n  return useFormState(action, null)\n}\n",
    corrected: "import { useActionState } from 'react'\nexport function useForm(action: never) {\n  return useActionState(action, null)\n}\n",
  }),
  reportedAndCorrected('@eslint-react/jsx-no-key-after-spread', {
    reported: 'type Row = { id: string }\nexport const List = ({ rows }: { rows: Row[] }) => (\n  <ul>{rows.map((row) => <li {...row} key={row.id} />)}</ul>\n)\n',
    corrected: 'type Row = { id: string }\nexport const List = ({ rows }: { rows: Row[] }) => (\n  <ul>{rows.map((row) => <li key={row.id} {...row} />)}</ul>\n)\n',
  }),
  reportedAndCorrected('@eslint-react/jsx-no-leaked-dollar', {
    reported: 'export const Price = ({ amount }: { amount: number }) => <span>Total: ${amount}</span>\n',
    corrected: 'export const Price = ({ amount }: { amount: number }) => <span>Total: {amount}</span>\n',
  }),
  reportedAndCorrected('@eslint-react/jsx-no-leaked-semicolon', {
    reported: 'export const Tail = ({ name }: { name: string }) => (\n  <span>\n    {name};\n    <b>suffix</b>\n  </span>\n)\n',
    corrected: 'export const Tail = ({ name }: { name: string }) => (\n  <span>\n    {name}\n    <b>suffix</b>\n  </span>\n)\n',
  }),
  reportedAndCorrected('@eslint-react/jsx-no-useless-fragment', {
    reported: 'export const Wrap = () => <><div>only child</div></>\n',
    corrected: 'export const Wrap = () => <div>only child</div>\n',
  }),
  reportedAndCorrected('@eslint-react/naming-convention-context-name', {
    reported: "import { createContext } from 'react'\nexport const theme = createContext<string | null>(null)\n",
    corrected: "import { createContext } from 'react'\nexport const ThemeContext = createContext<string | null>(null)\n",
  }),
  reportedAndCorrected('@eslint-react/naming-convention-id-name', {
    reported: "import { useId } from 'react'\nexport function useLabel() {\n  const generated = useId()\n  return generated\n}\n",
    corrected: "import { useId } from 'react'\nexport function useLabel() {\n  const labelId = useId()\n  return labelId\n}\n",
  }),
  reportedAndCorrected('@eslint-react/naming-convention-ref-name', {
    reported: "import { useRef } from 'react'\nexport function useNode() {\n  const node = useRef<HTMLDivElement | null>(null)\n  return node\n}\n",
    corrected: "import { useRef } from 'react'\nexport function useNode() {\n  const nodeRef = useRef<HTMLDivElement | null>(null)\n  return nodeRef\n}\n",
  }),
  reportedAndCorrected('@eslint-react/rsc-function-definition', {
    reported: "export function saveRow(value: string) {\n  'use server'\n  return value\n}\n",
    corrected: "export async function saveRow(value: string) {\n  'use server'\n  return value\n}\n",
  }),
  reportedAndCorrected('@eslint-react/web-api-no-leaked-event-listener', {
    reported: "import { useEffect } from 'react'\nexport function useResize(onResize: () => void) {\n  useEffect(function listen() {\n    window.addEventListener('resize', onResize)\n  }, [onResize])\n}\n",
    corrected:
      "import { useEffect } from 'react'\nexport function useResize(onResize: () => void) {\n  useEffect(function listen() {\n    window.addEventListener('resize', onResize)\n    return () => {\n      window.removeEventListener('resize', onResize)\n    }\n  }, [onResize])\n}\n",
  }),
  reportedAndCorrected('@eslint-react/web-api-no-leaked-fetch', {
    reported: "import { useEffect } from 'react'\nexport function useRows() {\n  useEffect(function load() {\n    void fetch('/api/rows')\n  }, [])\n}\n",
    corrected:
      "import { useEffect } from 'react'\nexport function useRows() {\n  useEffect(function load() {\n    const controller = new AbortController()\n    void fetch('/api/rows', { signal: controller.signal })\n    return () => {\n      controller.abort()\n    }\n  }, [])\n}\n",
  }),
  reportedAndCorrected('@eslint-react/web-api-no-leaked-intersection-observer', {
    reported: "import { useEffect } from 'react'\nexport function useVisible(node: Element) {\n  useEffect(function observe() {\n    new IntersectionObserver(() => {}).observe(node)\n  }, [node])\n}\n",
    corrected:
      "import { useEffect } from 'react'\nexport function useVisible(node: Element) {\n  useEffect(function observe() {\n    const observer = new IntersectionObserver(() => {})\n    observer.observe(node)\n    return () => {\n      observer.disconnect()\n    }\n  }, [node])\n}\n",
  }),
  reportedAndCorrected('@eslint-react/web-api-no-leaked-interval', {
    reported: "import { useEffect } from 'react'\nexport function useTick(onTick: () => void) {\n  useEffect(function tick() {\n    setInterval(onTick, 1000)\n  }, [onTick])\n}\n",
    corrected:
      "import { useEffect } from 'react'\nexport function useTick(onTick: () => void) {\n  useEffect(function tick() {\n    const interval = setInterval(onTick, 1000)\n    return () => {\n      clearInterval(interval)\n    }\n  }, [onTick])\n}\n",
  }),
  reportedAndCorrected('@eslint-react/web-api-no-leaked-resize-observer', {
    reported: "import { useEffect } from 'react'\nexport function useSize(node: Element) {\n  useEffect(function observe() {\n    new ResizeObserver(() => {}).observe(node)\n  }, [node])\n}\n",
    corrected:
      "import { useEffect } from 'react'\nexport function useSize(node: Element) {\n  useEffect(function observe() {\n    const observer = new ResizeObserver(() => {})\n    observer.observe(node)\n    return () => {\n      observer.disconnect()\n    }\n  }, [node])\n}\n",
  }),
  reportedAndCorrected('@eslint-react/web-api-no-leaked-timeout', {
    reported: "import { useEffect } from 'react'\nexport function useDelay(onDone: () => void) {\n  useEffect(function delay() {\n    setTimeout(onDone, 500)\n  }, [onDone])\n}\n",
    corrected:
      "import { useEffect } from 'react'\nexport function useDelay(onDone: () => void) {\n  useEffect(function delay() {\n    const timeout = setTimeout(onDone, 500)\n    return () => {\n      clearTimeout(timeout)\n    }\n  }, [onDone])\n}\n",
  }),
  reportedAndCorrected('@eslint-react/x-no-children-count', {
    reported: "import { Children, type ReactNode } from 'react'\nexport const Count = ({ children }: { children: ReactNode }) => <span>{Children.count(children)}</span>\n",
    corrected: "import type { ReactNode } from 'react'\nexport const Count = ({ items }: { items: readonly ReactNode[] }) => <span>{items.length}</span>\n",
  }),
  reportedAndCorrected('@eslint-react/x-no-children-for-each', {
    reported: "import { Children, type ReactNode } from 'react'\nexport function walk(children: ReactNode) {\n  Children.forEach(children, () => {})\n}\n",
    corrected: "import type { ReactNode } from 'react'\nexport function walk(items: readonly ReactNode[]) {\n  items.forEach(() => {})\n}\n",
  }),
  reportedAndCorrected('@eslint-react/x-no-children-map', {
    reported: "import { Children, type ReactNode } from 'react'\nexport function relabel(children: ReactNode) {\n  return Children.map(children, (child) => child)\n}\n",
    corrected: "import type { ReactNode } from 'react'\nexport function relabel(items: readonly ReactNode[]) {\n  return items.map((item) => item)\n}\n",
  }),
  reportedAndCorrected('@eslint-react/x-no-children-only', {
    reported: "import { Children, type ReactNode } from 'react'\nexport function sole(children: ReactNode) {\n  return Children.only(children)\n}\n",
    corrected: "import type { ReactElement } from 'react'\nexport function sole(child: ReactElement) {\n  return child\n}\n",
  }),
  reportedAndCorrected('@eslint-react/x-no-children-to-array', {
    reported: "import { Children, type ReactNode } from 'react'\nexport function asArray(children: ReactNode) {\n  return Children.toArray(children)\n}\n",
    corrected: "import type { ReactNode } from 'react'\nexport function asArray(items: readonly ReactNode[]) {\n  return [...items]\n}\n",
  }),
  reportedAndCorrected('@eslint-react/x-no-class-component', {
    reported: "import { Component } from 'react'\nexport class Panel extends Component {\n  render() {\n    return <div>panel</div>\n  }\n}\n",
    corrected: 'export function Panel() {\n  return <div>panel</div>\n}\n',
  }),
  reportedAndCorrected('@eslint-react/x-no-clone-element', {
    reported: "import { cloneElement, type ReactElement } from 'react'\nexport function withKey(element: ReactElement) {\n  return cloneElement(element, { key: 'k' })\n}\n",
    corrected: "import type { ComponentType } from 'react'\nexport function withKey(Item: ComponentType) {\n  return <Item key=\"k\" />\n}\n",
  }),
  reportedAndCorrected('@eslint-react/x-no-context-provider', {
    reported: "import { createContext } from 'react'\nconst ThemeContext = createContext('light')\nexport const Provide = () => (\n  <ThemeContext.Provider value=\"dark\">child</ThemeContext.Provider>\n)\n",
    corrected: "import { createContext } from 'react'\nconst ThemeContext = createContext('light')\nexport const Provide = () => (\n  <ThemeContext value=\"dark\">child</ThemeContext>\n)\n",
  }),
  reportedAndCorrected('@eslint-react/x-no-create-ref', {
    reported: "import { createRef } from 'react'\nexport function Panel() {\n  const ref = createRef<HTMLDivElement>()\n  return <div ref={ref} />\n}\n",
    corrected: "import { useRef } from 'react'\nexport function Panel() {\n  const ref = useRef<HTMLDivElement>(null)\n  return <div ref={ref} />\n}\n",
  }),
  reportedAndCorrected('@eslint-react/x-no-duplicate-key', {
    reported: 'export const List = () => (\n  <ul>\n    <li key="row">one</li>\n    <li key="row">two</li>\n  </ul>\n)\n',
    corrected: 'export const List = () => (\n  <ul>\n    <li key="one">one</li>\n    <li key="two">two</li>\n  </ul>\n)\n',
  }),
  reportedAndCorrected('@eslint-react/x-no-forward-ref', {
    reported: "import { forwardRef } from 'react'\nexport const Input = forwardRef<HTMLInputElement>((props, ref) => <input {...props} ref={ref} />)\n",
    corrected: "import type { Ref } from 'react'\nexport function Input({ ref }: { ref?: Ref<HTMLInputElement> }) {\n  return <input ref={ref} />\n}\n",
  }),
  reportedAndCorrected('@eslint-react/x-no-implicit-children', {
    reported: 'type Props = { title: string; children: string }\nconst Box = (props: { title: string }) => <div>{props.title}</div>\nexport const Outer = (props: Props) => <Box {...props} />\n',
    corrected: 'type Props = { title: string; children: string }\nconst Box = (props: { title: string }) => <div>{props.title}</div>\nexport const Outer = (props: Props) => <Box title={props.title} />\n',
  }),
  reportedAndCorrected('@eslint-react/x-no-implicit-key', {
    reported: 'type Row = { title: string; key: string }\nconst Box = (props: { title: string }) => <div>{props.title}</div>\nexport const Outer = (row: Row) => <Box {...row} />\n',
    corrected: 'type Row = { title: string; key: string }\nconst Box = (props: { title: string }) => <div>{props.title}</div>\nexport const Outer = (row: Row) => <Box key={row.key} title={row.title} />\n',
  }),
  reportedAndCorrected('@eslint-react/x-no-implicit-ref', {
    reported: 'type Row = { title: string; ref: string }\nconst Box = (props: { title: string }) => <div>{props.title}</div>\nexport const Outer = (row: Row) => <Box {...row} />\n',
    corrected: 'type Row = { title: string; ref: string }\nconst Box = (props: { title: string }) => <div>{props.title}</div>\nexport const Outer = (row: Row) => <Box title={row.title} />\n',
  }),
  reportedAndCorrected('@eslint-react/x-no-leaked-conditional-rendering', {
    reported: 'export const Badge = ({ total }: { total: number }) => <div>{total && <span>{total}</span>}</div>\n',
    corrected: 'export const Badge = ({ total }: { total: number }) => <div>{total > 0 && <span>{total}</span>}</div>\n',
  }),
  reportedAndCorrected('@eslint-react/x-no-missing-component-display-name', {
    reported: "import { memo } from 'react'\nconst Cell = memo(() => <div>cell</div>)\nexport const Table = () => <Cell />\n",
    corrected: "import { memo } from 'react'\nconst Cell = memo(function Cell() {\n  return <div>cell</div>\n})\nexport const Table = () => <Cell />\n",
  }),
  reportedAndCorrected('@eslint-react/x-no-missing-context-display-name', {
    reported: "import { createContext } from 'react'\nexport const ThemeContext = createContext('light')\n",
    corrected: "import { createContext } from 'react'\nexport const ThemeContext = createContext('light')\nThemeContext.displayName = 'ThemeContext'\n",
  }),
  reportedAndCorrected('@eslint-react/x-no-missing-key', {
    reported: 'export const List = ({ rows }: { rows: string[] }) => (\n  <ul>{rows.map((row) => <li>{row}</li>)}</ul>\n)\n',
    corrected: 'export const List = ({ rows }: { rows: string[] }) => (\n  <ul>{rows.map((row) => <li key={row}>{row}</li>)}</ul>\n)\n',
  }),
  reportedAndCorrected('@eslint-react/x-no-misused-capture-owner-stack', {
    reported: "import { captureOwnerStack } from 'react'\nexport function trace() {\n  return captureOwnerStack()\n}\n",
    corrected: "import * as React from 'react'\nexport function trace() {\n  if (process.env.NODE_ENV !== 'production') {\n    return React.captureOwnerStack()\n  }\n  return null\n}\n",
  }),
  reportedAndCorrected('@eslint-react/x-no-nested-component-definitions', {
    reported: 'export function Outer() {\n  const Inner = () => <span>inner</span>\n  return <Inner />\n}\n',
    corrected: 'const Inner = () => <span>inner</span>\nexport function Outer() {\n  return <Inner />\n}\n',
  }),
  reportedAndCorrected('@eslint-react/x-no-nested-lazy-component-declarations', {
    reported: "import { lazy } from 'react'\nexport function Outer() {\n  const Late = lazy(async () => import('./panel'))\n  return <Late />\n}\n",
    corrected: "import { lazy } from 'react'\nconst Late = lazy(async () => import('./panel'))\nexport function Outer() {\n  return <Late />\n}\n",
  }),
  reportedAndCorrected('@eslint-react/x-no-set-state-in-component-did-mount', {
    reported:
      "import { Component } from 'react'\nexport class Panel extends Component<object, { ready: boolean }> {\n  componentDidMount() {\n    this.setState({ ready: true })\n  }\n  render() {\n    return <div>panel</div>\n  }\n}\n",
    corrected:
      "import { Component } from 'react'\nexport class Panel extends Component<object, { ready: boolean }> {\n  handleReady() {\n    this.setState({ ready: true })\n  }\n  render() {\n    return <div>panel</div>\n  }\n}\n",
  }),
  reportedAndCorrected('@eslint-react/x-no-set-state-in-component-did-update', {
    reported:
      "import { Component } from 'react'\nexport class Panel extends Component<object, { ready: boolean }> {\n  componentDidUpdate() {\n    this.setState({ ready: true })\n  }\n  render() {\n    return <div>panel</div>\n  }\n}\n",
    corrected:
      "import { Component } from 'react'\nexport class Panel extends Component<object, { ready: boolean }> {\n  handleReady() {\n    this.setState({ ready: true })\n  }\n  render() {\n    return <div>panel</div>\n  }\n}\n",
  }),
  reportedAndCorrected('@eslint-react/x-no-set-state-in-component-will-update', {
    reported:
      "import { Component } from 'react'\nexport class Panel extends Component<object, { ready: boolean }> {\n  componentWillUpdate() {\n    this.setState({ ready: true })\n  }\n  render() {\n    return <div>panel</div>\n  }\n}\n",
    corrected:
      "import { Component } from 'react'\nexport class Panel extends Component<object, { ready: boolean }> {\n  handleReady() {\n    this.setState({ ready: true })\n  }\n  render() {\n    return <div>panel</div>\n  }\n}\n",
  }),
  reportedAndCorrected('@eslint-react/x-no-unnecessary-use-prefix', {
    reported: 'export function useLabel(name: string) {\n  return name.trim()\n}\n',
    corrected: 'export function labelOf(name: string) {\n  return name.trim()\n}\n',
  }),
  reportedAndCorrected('@eslint-react/x-no-unused-class-component-members', {
    reported: "import { Component } from 'react'\nexport class Panel extends Component {\n  private neverCalled() {\n    return 1\n  }\n  render() {\n    return <div>panel</div>\n  }\n}\n",
    corrected: "import { Component } from 'react'\nexport class Panel extends Component {\n  private label() {\n    return 'panel'\n  }\n  render() {\n    return <div>{this.label()}</div>\n  }\n}\n",
  }),
  reportedAndCorrected('@eslint-react/x-no-unused-props', {
    reported: 'export function Row(props: { label: string; hidden: boolean }) {\n  return <div>{props.label}</div>\n}\n',
    corrected: 'export function Row(props: { label: string; hidden: boolean }) {\n  return <div hidden={props.hidden}>{props.label}</div>\n}\n',
  }),
  reportedAndCorrected('@eslint-react/x-no-use-context', {
    reported: "import { createContext, useContext } from 'react'\nconst ThemeContext = createContext('light')\nexport function useTheme() {\n  return useContext(ThemeContext)\n}\n",
    corrected: "import { createContext, use } from 'react'\nconst ThemeContext = createContext('light')\nexport function useTheme() {\n  return use(ThemeContext)\n}\n",
  }),
  reportedAndCorrected('@eslint-react/x-unsupported-syntax', {
    reported: 'export function Panel({ expression }: { expression: string }) {\n  const value = eval(expression)\n  return <div>{String(value)}</div>\n}\n',
    corrected: 'export function Panel({ expression }: { expression: string }) {\n  const value = Number(expression)\n  return <div>{String(value)}</div>\n}\n',
  }),
  reportedAndCorrected('@eslint-react/x-use-state', {
    reported: "import { useState } from 'react'\nexport function Panel() {\n  const [open, setClosed] = useState(false)\n  return <div onClick={() => setClosed(!open)}>{String(open)}</div>\n}\n",
    corrected: "import { useState } from 'react'\nexport function Panel() {\n  const [open, setOpen] = useState(false)\n  return <div onClick={() => setOpen(!open)}>{String(open)}</div>\n}\n",
  }),
  reportedAndCorrected('react-hook-form/destructuring-formstate', {
    fileType: 'jsx',
    reported: "import { useForm } from 'react-hook-form'\nexport function A() {\n  const { formState } = useForm()\n  return <div>{formState.isDirty}</div>\n}\n",
    corrected: "import { useForm } from 'react-hook-form'\nexport function A() {\n  const { formState: { isDirty } } = useForm()\n  return <div>{isDirty}</div>\n}\n",
  }),
  reportedAndCorrected('react-hook-form/no-access-control', {
    reported: "import { useForm } from 'react-hook-form'\n\nexport const AccessControl = () => {\n  const { control } = useForm()\n  const fields = control._fields\n  return <span>{String(fields)}</span>\n}\n",
    corrected: "import { useForm } from 'react-hook-form'\n\nexport const AccessControl = () => {\n  const { register } = useForm()\n  return <input {...register('name')} />\n}\n",
  }),
  reportedAndCorrected('react-hook-form/no-use-watch', {
    fileType: 'jsx',
    reported: "import { useForm } from 'react-hook-form'\nexport function A() {\n  const m = useForm()\n  m.watch('x')\n  return <div />\n}\n",
    corrected: "import { useForm, useWatch } from 'react-hook-form'\nexport function A() {\n  const m = useForm()\n  useWatch({ control: m.control, name: 'x' })\n  return <div />\n}\n",
  }),
  reportedAndCorrected('react-you-might-not-need-an-effect/no-adjust-state-on-prop-change', {
    reported:
      "import { useEffect, useState } from 'react'\nexport function Panel({ items }: { items: string[] }) {\n  const [selection, setSelection] = useState<string | null>(null)\n  useEffect(function clearSelection() {\n    setSelection(null)\n  }, [items])\n  return <div>{selection}</div>\n}\n",
    corrected:
      "import { useState } from 'react'\nexport function Panel({ items }: { items: string[] }) {\n  const [selection, setSelection] = useState<string | null>(null)\n  const [previousItems, setPreviousItems] = useState(items)\n  if (items !== previousItems) {\n    setPreviousItems(items)\n    setSelection(null)\n  }\n  return <div>{selection}</div>\n}\n",
  }),
  reportedAndCorrected('react-you-might-not-need-an-effect/no-chain-state-updates', {
    reported:
      "import { useEffect, useState } from 'react'\nexport function Game() {\n  const [round, setRound] = useState(1)\n  const [isGameOver, setIsGameOver] = useState(false)\n  useEffect(function endGame() {\n    if (round > 10) {\n      setIsGameOver(true)\n    }\n  }, [round])\n  return <button type=\"button\" onClick={() => setRound(round + 1)}>{String(isGameOver)}</button>\n}\n",
    corrected:
      "import { useState } from 'react'\nexport function Game() {\n  const [round, setRound] = useState(1)\n  const [isGameOver, setIsGameOver] = useState(false)\n  function nextRound() {\n    setRound(round + 1)\n    if (round + 1 > 10) {\n      setIsGameOver(true)\n    }\n  }\n  return <button type=\"button\" onClick={nextRound}>{String(isGameOver)}</button>\n}\n",
  }),
  reportedAndCorrected('react-you-might-not-need-an-effect/no-derived-state', {
    reported:
      "import { useEffect, useState } from 'react'\nexport function Panel({ first, last }: { first: string; last: string }) {\n  const [full, setFull] = useState('')\n  useEffect(function derive() {\n    setFull(`${first} ${last}`)\n  }, [first, last])\n  return <div>{full}</div>\n}\n",
    corrected: 'export function Panel({ first, last }: { first: string; last: string }) {\n  const full = `${first} ${last}`\n  return <div>{full}</div>\n}\n',
  }),
  reportedAndCorrected('react-you-might-not-need-an-effect/no-external-store-subscription', {
    reported:
      "import { useEffect, useState } from 'react'\nexport function useOnlineStatus() {\n  const [isOnline, setIsOnline] = useState(true)\n  useEffect(function subscribe() {\n    function updateState() {\n      setIsOnline(navigator.onLine)\n    }\n    updateState()\n    window.addEventListener('online', updateState)\n    window.addEventListener('offline', updateState)\n    return () => {\n      window.removeEventListener('online', updateState)\n      window.removeEventListener('offline', updateState)\n    }\n  }, [])\n  return isOnline\n}\n",
    corrected:
      "import { useSyncExternalStore } from 'react'\nfunction subscribe(onChange: () => void) {\n  window.addEventListener('online', onChange)\n  window.addEventListener('offline', onChange)\n  return () => {\n    window.removeEventListener('online', onChange)\n    window.removeEventListener('offline', onChange)\n  }\n}\nexport function useOnlineStatus() {\n  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true)\n}\n",
  }),
  reportedAndCorrected('react-you-might-not-need-an-effect/no-initialize-state', {
    reported: "import { useEffect, useState } from 'react'\nexport function Panel() {\n  const [mode, setMode] = useState('')\n  useEffect(function initialize() {\n    setMode('idle')\n  }, [])\n  return <div>{mode}</div>\n}\n",
    corrected: "import { useState } from 'react'\nexport function Panel() {\n  const [mode] = useState('idle')\n  return <div>{mode}</div>\n}\n",
  }),
  reportedAndCorrected('react-you-might-not-need-an-effect/no-pass-data-to-parent', {
    reported:
      "import { useEffect } from 'react'\nimport { useQuery } from '@tanstack/react-query'\nexport function Child({ onDataFetched }: { onDataFetched: (rows: unknown) => void }) {\n  const { data } = useQuery({ queryKey: ['rows'] })\n  useEffect(function report() {\n    onDataFetched(data)\n  }, [data, onDataFetched])\n  return <div>child</div>\n}\n",
    corrected: 'export function Child({ rows }: { rows: unknown }) {\n  return <div>{String(rows)}</div>\n}\n',
  }),
  reportedAndCorrected('react-you-might-not-need-an-effect/no-pass-live-state-to-parent', {
    reported:
      "import { useEffect, useState } from 'react'\nexport function Panel({ onChange }: { onChange: (v: string) => void }) {\n  const [value, setValue] = useState('')\n  useEffect(function publish() {\n    onChange(value)\n  }, [value, onChange])\n  return <input value={value} onChange={(e) => setValue(e.target.value)} />\n}\n",
    corrected:
      "import { useState } from 'react'\nexport function Panel({ onChange }: { onChange: (v: string) => void }) {\n  const [value, setValue] = useState('')\n  return (\n    <input\n      value={value}\n      onChange={(e) => {\n        setValue(e.target.value)\n        onChange(e.target.value)\n      }}\n    />\n  )\n}\n",
  }),
  reportedAndCorrected('react-you-might-not-need-an-effect/no-reset-all-state-on-prop-change', {
    reported:
      "import { useEffect, useState } from 'react'\nexport function List({ items }: { items: readonly string[] }) {\n  const [selection, setSelection] = useState<string | null>(null)\n  useEffect(function resetEverything() {\n    setSelection(null)\n  }, [items])\n  return <div>{items.length}</div>\n}\n",
    corrected:
      "import { useState } from 'react'\nfunction List({ items }: { items: readonly string[] }) {\n  const [selection] = useState<string | null>(null)\n  return <div>{selection ?? items.length}</div>\n}\nexport function Lists({ id, items }: { id: string; items: readonly string[] }) {\n  return <List key={id} items={items} />\n}\n",
  }),
  reportedAndCorrected('react/destructuring-assignment', {
    reported: 'export function C(props) {\n  return <div>{props.a}</div>\n}\n',
    corrected: 'export function C({ a }) {\n  return <div>{a}</div>\n}\n',
  }),
  reportedAndCorrected('react/no-access-state-in-setstate', {
    reported:
      "import React from 'react'\nexport class C extends React.Component {\n  f() {\n    this.setState({ a: this.state.a + 1 })\n  }\n  render() {\n    return <div />\n  }\n}\n",
    corrected:
      "import React from 'react'\nexport class C extends React.Component {\n  f() {\n    this.setState((state) => ({ a: state.a + 1 }))\n  }\n  render() {\n    return <div />\n  }\n}\n",
  }),
  reportedAndCorrected('react/no-arrow-function-lifecycle', {
    reported: "import React from 'react'\nexport class C extends React.Component {\n  componentDidMount = () => {}\n  render() {\n    return <div />\n  }\n}\n",
    corrected: "import React from 'react'\nexport class C extends React.Component {\n  componentDidMount() {}\n  render() {\n    return <div />\n  }\n}\n",
  }),
  reportedAndCorrected('react/no-invalid-html-attribute', {
    reported: 'export const x = <a rel="foobar">x</a>\n',
    corrected: 'export const x = <a rel="noreferrer">x</a>\n',
  }),
  reportedAndCorrected('react/no-unused-state', {
    reported: "import React from 'react'\nexport class C extends React.Component {\n  state = { a: 1 }\n  render() {\n    return <div />\n  }\n}\n",
    corrected: "import React from 'react'\nexport class C extends React.Component {\n  state = { a: 1 }\n  render() {\n    return <div>{this.state.a}</div>\n  }\n}\n",
  }),
  reportedAndCorrected('react/prefer-read-only-props', {
    reported: 'export function C(props: { a: string }) {\n  return <div>{props.a}</div>\n}\n',
    corrected: 'export function C(props: { readonly a: string }) {\n  return <div>{props.a}</div>\n}\n',
  }),
  reportedAndCorrected('react/static-property-placement', {
    reported: "import React from 'react'\nexport class Bar extends React.Component {\n  render() {\n    return <div />\n  }\n}\nBar.displayName = 'Bar'\n",
    corrected: "import React from 'react'\nexport class Bar extends React.Component {\n  static displayName = 'Bar'\n  render() {\n    return <div />\n  }\n}\n",
  }),
]
