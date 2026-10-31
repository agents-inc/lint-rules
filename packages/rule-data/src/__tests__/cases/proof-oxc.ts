import type { RuleCase } from './changed-settings.ts'

// The shipped oxc rules no ESLint stand-in proves: each reports the gate's fixture in oxlint and stays
// silent on its corrected form. ESLint has no version of them, so they run in oxlint alone.

export const PROOF_OXC_CASES: readonly RuleCase[] = [
  {
    rule: 'oxc/bad-array-method-on-arguments',
    engines: ['oxlint'],
    silentIn: [
      { path: 'src/rest-parameter.js', source: 'export function sorted(...values) {\n  return values.sort()\n}\n' },
      { path: 'src/array-from-arguments.js', source: 'export function sorted() {\n  return Array.from(arguments).sort()\n}\n' },
    ],
    reportedIn: [{ path: 'src/arguments-sorted.js', source: 'export function sorted() {\n  return arguments.sort()\n}\n' }],
  },
  {
    rule: 'oxc/bad-min-max-func',
    engines: ['oxlint'],
    silentIn: [{ path: 'src/clamp.ts', source: 'export const clamp = (x: number) => Math.min(100, Math.max(0, x))\n' }],
    reportedIn: [{ path: 'src/constant-clamp.ts', source: 'export const clamped = Math.min(0, Math.max(100, 50))\n' }],
  },
  {
    rule: 'oxc/const-comparisons',
    engines: ['oxlint'],
    silentIn: [{ path: 'src/in-range.ts', source: 'export function inRange(x: number) {\n  return x > 5 && x < 10\n}\n' }],
    reportedIn: [{ path: 'src/never-in-range.ts', source: 'export function inRange(x: number) {\n  return x < 5 && x > 10\n}\n' }],
  },
  {
    rule: 'oxc/no-accumulating-spread',
    engines: ['oxlint'],
    silentIn: [
      { path: 'src/from-entries.ts', source: 'export const byValue = Object.fromEntries([1, 2].map((x) => [x, x]))\n' },
      { path: 'src/spread-once.ts', source: 'export const merged = (base: object, extra: object) => ({ ...base, ...extra })\n' },
    ],
    reportedIn: [{ path: 'src/spread-accumulator.ts', source: 'export const byValue = [1, 2].reduce((acc, x) => ({ ...acc, [x]: x }), {})\n' }],
  },
  {
    rule: 'oxc/no-async-endpoint-handlers',
    engines: ['oxlint'],
    silentIn: [{ path: 'src/sync-handler.js', source: "export function route(app) {\n  app.get('/', (req, res) => {\n    res.end()\n  })\n}\n" }],
    reportedIn: [{ path: 'src/async-handler.js', source: "export function route(app) {\n  app.get('/', async (req, res) => {\n    res.end()\n  })\n}\n" }],
  },
  {
    rule: 'oxc/no-map-spread',
    engines: ['oxlint'],
    silentIn: [{ path: 'src/fields-named.ts', source: 'export const rows = [{ n: 1 }].map((x) => ({ n: x.n, m: 2 }))\n' }],
    reportedIn: [{ path: 'src/spread-in-map.ts', source: 'export const rows = [{ n: 1 }].map((x) => ({ ...x, m: 2 }))\n' }],
  },
  {
    rule: 'oxc/number-arg-out-of-range',
    engines: ['oxlint'],
    silentIn: [
      { path: 'src/precision-in-range.ts', source: 'export const price = (1).toFixed(2)\n' },
      { path: 'src/radix-in-range.ts', source: 'export const id = (255).toString(36)\n' },
    ],
    reportedIn: [{ path: 'src/precision-out-of-range.ts', source: 'export const price = (1).toFixed(101)\n' }],
  },
  {
    rule: 'oxc/only-used-in-recursion',
    engines: ['oxlint'],
    silentIn: [{ path: 'src/returned.ts', source: 'export function last(n: number, x: number): number {\n  return n === 0 ? x : last(n - 1, x)\n}\n' }],
    reportedIn: [{ path: 'src/passed-on-only.ts', source: 'export function last(n: number, x: number): number {\n  return n === 0 ? 0 : last(n - 1, x)\n}\n' }],
  },
  {
    rule: 'oxc/uninvoked-array-callback',
    engines: ['oxlint'],
    silentIn: [
      { path: 'src/array-from-length.ts', source: 'export const ones = Array.from({ length: 5 }, () => 1)\n' },
      { path: 'src/filled.ts', source: 'export const ones = new Array(5).fill(0).map(() => 1)\n' },
    ],
    reportedIn: [{ path: 'src/sparse-map.ts', source: 'export const ones = new Array(5).map(() => 1)\n' }],
  },
]
