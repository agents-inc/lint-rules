import type { CaseFile } from '../rule-case-runs.ts'
import type { RuleCase } from './changed-settings.ts'

type Proof = {
  readonly reported: string
  readonly corrected: string
  /** Files the shipped options report and other options of the rule leave alone. */
  readonly reportedAsShippedIn?: readonly CaseFile[]
  /** Files the shipped options leave alone and other options of the rule report. */
  readonly silentAsShippedIn?: readonly CaseFile[]
}

function reportedAndCorrected(rule: string, { reported, corrected, reportedAsShippedIn = [], silentAsShippedIn = [] }: Proof): RuleCase {
  return {
    rule,
    silentIn: [{ path: 'src/corrected.ts', source: corrected }, ...silentAsShippedIn],
    reportedIn: [{ path: 'src/reported.ts', source: reported }, ...reportedAsShippedIn],
  }
}

export const PROOF_TS_CASES: readonly RuleCase[] = [
  reportedAndCorrected('@typescript-eslint/await-thenable', {
    reported: 'export async function run() {\n  return await 1\n}\n',
    corrected: 'export async function run(load: () => Promise<number>) {\n  return await load()\n}\n',
  }),
  reportedAndCorrected('@typescript-eslint/consistent-return', {
    reported: 'export function gapConsistentReturn(flag: boolean): number | undefined {\n  if (flag) return 1\n  return\n}\n',
    corrected: 'export function gapConsistentReturn(flag: boolean): number | undefined {\n  if (flag) return 1\n  return undefined\n}\n',
  }),
  reportedAndCorrected('@typescript-eslint/naming-convention', {
    reported: 'export type lowerCaseTypeName = string\n',
    corrected: 'export type LowerCaseTypeName = string\n',
    silentAsShippedIn: [
      { path: 'src/snake-case-value.ts', source: 'export const snake_case_value = 1\n' },
      { path: 'src/underscored-type.ts', source: 'export type _Internal = string\n' },
    ],
  }),
  reportedAndCorrected('@typescript-eslint/no-array-delete', {
    reported: 'const gapArr: number[] = [1, 2, 3]\ndelete gapArr[1]\nexport { gapArr }\n',
    corrected: 'const gapArr: number[] = [1, 2, 3]\ngapArr.splice(1, 1)\nexport { gapArr }\n',
  }),
  reportedAndCorrected('@typescript-eslint/no-base-to-string', {
    reported: 'class GapThing { x = 1 }\nexport const gapStr = new GapThing().toString()\n',
    corrected: 'class GapThing { x = 1 }\nexport const gapStr = String(new GapThing().x)\n',
  }),
  reportedAndCorrected('@typescript-eslint/no-duplicate-type-constituents', {
    reported: "type GapDup = string | string\nexport const gapDupVal: GapDup = 'a'\n",
    corrected: "type GapDup = string | number\nexport const gapDupVal: GapDup = 'a'\n",
  }),
  reportedAndCorrected('@typescript-eslint/no-for-in-array', {
    reported: 'export const gapForInArr = [1, 2, 3]\nfor (const i in gapForInArr) console.log(i)\n',
    corrected: 'export const gapForInArr = [1, 2, 3]\nfor (const i of gapForInArr) console.log(i)\n',
  }),
  reportedAndCorrected('@typescript-eslint/no-generated-empty-object-type', {
    reported: 'export type A = NonNullable<unknown>\n',
    corrected: 'export type A = NonNullable<string | undefined>\n',
  }),
  reportedAndCorrected('@typescript-eslint/no-implied-eval', {
    reported: "export function run() {\n  setTimeout('globalThis.x = 1', 0)\n}\n",
    corrected: 'export function run() {\n  setTimeout(() => {\n    console.log(1)\n  }, 0)\n}\n',
  }),
  reportedAndCorrected('@typescript-eslint/no-invalid-this', {
    reported: 'export function notAConstructor() {\n  this.a = 1\n}\n',
    corrected: 'export class Point {\n  a = 0\n  move() {\n    this.a = 1\n  }\n}\n',
    silentAsShippedIn: [{ path: 'src/capitalized-function.ts', source: 'export function Point() {\n  this.a = 1\n}\n' }],
  }),
  reportedAndCorrected('@typescript-eslint/no-meaningless-void-operator', {
    reported: 'function gapVoidFn(): void {}\nexport const gapVoidRes = void gapVoidFn()\n',
    corrected: 'function gapVoidFn(): number {\n  return 1\n}\nexport const gapVoidRes = void gapVoidFn()\n',
  }),
  reportedAndCorrected('@typescript-eslint/no-misused-promises', {
    reported: 'async function ready() {\n  return true\n}\nexport function run() {\n  if (ready()) {\n    return 1\n  }\n  return 0\n}\n',
    corrected: 'async function ready() {\n  return true\n}\nexport async function run() {\n  if (await ready()) {\n    return 1\n  }\n  return 0\n}\n',
  }),
  reportedAndCorrected('@typescript-eslint/no-misused-spread', {
    reported: 'const gapSpreadSrc = [1, 2, 3]\nexport const gapSpreadObj = { ...gapSpreadSrc }\n',
    corrected: 'const gapSpreadSrc = [1, 2, 3]\nexport const gapSpreadArr = [...gapSpreadSrc]\n',
  }),
  reportedAndCorrected('@typescript-eslint/no-redundant-type-constituents', {
    reported: "type GapRedundant = string | any\nexport const gapRedundantVal: GapRedundant = 'a'\n",
    corrected: "type GapRedundant = string | number\nexport const gapRedundantVal: GapRedundant = 'a'\n",
  }),
  reportedAndCorrected('@typescript-eslint/no-unnecessary-boolean-literal-compare', {
    reported: 'export function gapBoolCmp(b: boolean): boolean {\n  return b === true\n}\n',
    corrected: 'export function gapBoolCmp(b: boolean): boolean {\n  return b\n}\n',
  }),
  reportedAndCorrected('@typescript-eslint/no-unnecessary-condition', {
    reported: "export function run(label: string) {\n  if (label !== null) {\n    return label\n  }\n  return ''\n}\n",
    corrected: "export function run(label: string | null) {\n  if (label !== null) {\n    return label\n  }\n  return ''\n}\n",
  }),
  reportedAndCorrected('@typescript-eslint/no-unnecessary-template-expression', {
    reported: "export const gapTpl = `${'literal'} end`\n",
    corrected: "export const gapTpl = 'literal end'\n",
  }),
  reportedAndCorrected('@typescript-eslint/no-unnecessary-type-arguments', {
    reported: "function gapIdent<T = string>(v: T): T { return v }\nexport const gapIdentRes = gapIdent<string>('a')\n",
    corrected: "function gapIdent<T = string>(v: T): T { return v }\nexport const gapIdentRes = gapIdent('a')\n",
  }),
  reportedAndCorrected('@typescript-eslint/no-unnecessary-type-assertion', {
    reported: 'const gapNum: number = 3\nexport const gapAssert = gapNum as number\n',
    corrected: 'declare const gapRaw: unknown\nexport const gapAssert = gapRaw as number\n',
  }),
  reportedAndCorrected('@typescript-eslint/no-unnecessary-type-conversion', {
    reported: "const gapConvStr: string = 'a'\nexport const gapConv = String(gapConvStr)\n",
    corrected: 'declare const gapCount: number\nexport const gapConv = String(gapCount)\n',
  }),
  reportedAndCorrected('@typescript-eslint/no-unnecessary-type-parameters', {
    reported: 'export function identityish<T>(value: T): void {\n  console.log(value)\n}\n',
    corrected: 'export function identity<T>(value: T): T {\n  return value\n}\n',
  }),
  reportedAndCorrected('@typescript-eslint/no-unsafe-argument', {
    reported: 'declare function take(total: number): void\nexport function run(input: any) {\n  take(input)\n}\n',
    corrected: 'declare function take(total: number): void\nexport function run(input: number) {\n  take(input)\n}\n',
  }),
  reportedAndCorrected('@typescript-eslint/no-unsafe-assignment', {
    reported: 'export function run(input: any) {\n  const total: number = input\n  return total\n}\n',
    corrected: 'export function run(input: number) {\n  const total: number = input\n  return total\n}\n',
  }),
  reportedAndCorrected('@typescript-eslint/no-unsafe-call', {
    reported: 'export function run(input: any) {\n  return input()\n}\n',
    corrected: 'export function run(input: () => number) {\n  return input()\n}\n',
  }),
  reportedAndCorrected('@typescript-eslint/no-unsafe-enum-comparison', {
    reported: 'enum Fruit { Apple, Banana }\ndeclare const picked: Fruit\nexport const isApple = picked === 0\n',
    corrected: 'enum Fruit { Apple, Banana }\ndeclare const picked: Fruit\nexport const isApple = picked === Fruit.Apple\n',
  }),
  reportedAndCorrected('@typescript-eslint/no-unsafe-member-access', {
    reported: 'export function run(input: any) {\n  return input.total\n}\n',
    corrected: 'export function run(input: { total: number }) {\n  return input.total\n}\n',
  }),
  reportedAndCorrected('@typescript-eslint/no-unsafe-return', {
    reported: 'export function run(input: any): number {\n  return input\n}\n',
    corrected: 'export function run(input: number): number {\n  return input\n}\n',
  }),
  reportedAndCorrected('@typescript-eslint/no-useless-default-assignment', {
    reported: 'export function render({ size = 1 }: { size: number }): number {\n  return size\n}\n',
    corrected: 'export function render({ size = 1 }: { size?: number }): number {\n  return size\n}\n',
  }),
  reportedAndCorrected('@typescript-eslint/only-throw-error', {
    reported: "export function run() {\n  throw 'broken'\n}\n",
    corrected: "export function run() {\n  throw new Error('broken')\n}\n",
  }),
  reportedAndCorrected('@typescript-eslint/prefer-optional-chain', {
    reported: 'export function f(a?: { b?: { c?: string } }) { return a && a.b && a.b.c }\n',
    corrected: 'export function f(a?: { b?: { c?: string } }) { return a?.b?.c }\n',
  }),
  reportedAndCorrected('@typescript-eslint/require-array-sort-compare', {
    reported: 'declare const scores: number[]\nexport const ordered = scores.sort()\n',
    corrected: 'declare const scores: number[]\nexport const ordered = scores.sort((a, b) => a - b)\n',
  }),
  reportedAndCorrected('@typescript-eslint/restrict-plus-operands', {
    reported: 'declare const config: { id: number }\ndeclare const count: number\nexport const total = config + count\n',
    corrected: 'declare const config: { id: number }\ndeclare const count: number\nexport const total = config.id + count\n',
  }),
  reportedAndCorrected('@typescript-eslint/restrict-template-expressions', {
    reported: 'declare const payload: { id: number }\nexport const label = `value: ${payload}`\n',
    corrected: 'declare const payload: { id: number }\nexport const label = `value: ${payload.id}`\n',
  }),
  reportedAndCorrected('@typescript-eslint/return-await', {
    reported: "export async function C() {\n  try { return fetch('/x') } catch { return null }\n}\n",
    corrected: "export async function C() {\n  try { return await fetch('/x') } catch { return null }\n}\n",
    reportedAsShippedIn: [{ path: 'src/awaited-outside-try.ts', source: "export async function load() {\n  return await fetch('/x')\n}\n" }],
    silentAsShippedIn: [{ path: 'src/unawaited-outside-try.ts', source: "export async function load() {\n  return fetch('/x')\n}\n" }],
  }),
  reportedAndCorrected('@typescript-eslint/switch-exhaustiveness-check', {
    reported:
      "export type Shape = { kind: 'circle'; r: number } | { kind: 'square'; s: number } | { kind: 'tri'; b: number }\nexport function area(x: Shape): number {\n  switch (x.kind) {\n    case 'circle': return x.r\n    case 'square': return x.s\n  }\n  return 0\n}\n",
    corrected:
      "export type Shape = { kind: 'circle'; r: number } | { kind: 'square'; s: number } | { kind: 'tri'; b: number }\nexport function area(x: Shape): number {\n  switch (x.kind) {\n    case 'circle': return x.r\n    case 'square': return x.s\n    case 'tri': return x.b\n  }\n}\n",
    silentAsShippedIn: [
      {
        path: 'src/default-branch.ts',
        source:
          "export type Shape = { kind: 'circle'; r: number } | { kind: 'square'; s: number } | { kind: 'tri'; b: number }\nexport function area(x: Shape): number {\n  switch (x.kind) {\n    case 'circle': return x.r\n    default: return 0\n  }\n}\n",
      },
    ],
  }),
  reportedAndCorrected('@typescript-eslint/unbound-method', {
    reported: 'class Counter { increment(): void { console.log(this) } }\ndeclare const counter: Counter\nexport const detached = counter.increment\n',
    corrected: 'class Counter { increment(): void { console.log(this) } }\ndeclare const counter: Counter\nexport const detached = () => counter.increment()\n',
  }),
  reportedAndCorrected('functional/immutable-data', {
    reported: 'export function bump(point: { x: number }): void {\n  point.x = point.x + 1\n}\n',
    corrected: 'export function bump(point: { readonly x: number }): { readonly x: number } {\n  return { x: point.x + 1 }\n}\n',
    silentAsShippedIn: [
      { path: 'src/ref-current.ts', source: 'export function store(ref: { current: number }): void {\n  ref.current = 1\n}\n' },
      { path: 'src/document-property.ts', source: "export function retitle(): void {\n  document.title = 'Saved'\n}\n" },
      { path: 'src/window-property.ts', source: "export function rename(): void {\n  window.name = 'main'\n}\n" },
      { path: 'src/style-property.ts', source: "export function paint(element: HTMLElement): void {\n  element.style.color = 'red'\n}\n" },
      { path: 'src/scroll-top.ts', source: 'export function toTop(element: HTMLElement): void {\n  element.scrollTop = 0\n}\n' },
      { path: 'src/scroll-left.ts', source: 'export function toStart(element: HTMLElement): void {\n  element.scrollLeft = 0\n}\n' },
    ],
  }),
  reportedAndCorrected('functional/no-let', {
    reported: 'export function total(a: number, b: number): number {\n  let sum = a\n  sum = sum + b\n  return sum\n}\n',
    corrected: 'export function total(a: number, b: number): number {\n  const sum = a + b\n  return sum\n}\n',
  }),
  reportedAndCorrected('functional/prefer-immutable-types', {
    reported: 'export function readX(point: { x: number }): number {\n  return point.x\n}\n',
    corrected: 'export function readX(point: { readonly x: number }): number {\n  return point.x\n}\n',
    silentAsShippedIn: [{ path: 'src/mutable-return.ts', source: 'export function makePoint(): { x: number } {\n  return { x: 1 }\n}\n' }],
  }),
  reportedAndCorrected('functional/prefer-property-signatures', {
    reported: 'export type Handler = {\n  onPress(label: string): void\n}\n',
    corrected: 'export type Handler = {\n  onPress: (label: string) => void\n}\n',
  }),
  reportedAndCorrected('no-restricted-syntax', {
    reported: 'export enum Color { Red, Green }\n',
    corrected: "export const Color = { Red: 'Red', Green: 'Green' } as const\nexport type Color = (typeof Color)[keyof typeof Color]\n",
  }),
  reportedAndCorrected('require-atomic-updates', {
    reported: 'let total = 0\nexport async function add(n: Promise<number>) {\n  total += await n\n}\n',
    corrected: 'let total = 0\nexport async function add(n: Promise<number>) {\n  const amount = await n\n  total += amount\n}\n',
  }),
]
