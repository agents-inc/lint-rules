import type { HeldCase } from '../accepted-rules-out-of-place.ts'
import type { RuleCase } from './changed-settings.ts'

// The rules the owner accepted on 2026-10-24 from plugins already installed: each reports the card's
// code and stays silent on its corrected form, and on a shape its docs say it leaves alone.

const EVERY_CALL_WRAPPED = 'function readPort(raw: string) {\n  return raw.trim()\n}\n\nexport function ports(server: string, admin: string) {\n  return [Number(readPort(server)), Number(readPort(admin))]\n}\n'

/** Each shipped accepted rule's report case beside its silent twin. */
export const ACCEPTED_A_CASES: readonly RuleCase[] = [
  // Shipped outside test files, where a test wraps each call of a data factory in its subject's constructor.
  {
    rule: 'unicorn/no-repeated-call-wrappers',
    silentIn: [
      {
        path: 'src/one-call-unwrapped.ts',
        source: 'function readPort(raw: string) {\n  return raw.trim()\n}\n\nexport function ports(server: string, admin: string) {\n  return [Number(readPort(server)), readPort(admin)]\n}\n',
      },
      {
        path: 'src/exported.ts',
        source: 'export function readPort(raw: string) {\n  return raw.trim()\n}\n\nexport function ports(server: string, admin: string) {\n  return [Number(readPort(server)), Number(readPort(admin))]\n}\n',
      },
      { path: 'src/every-call-wrapped.test.ts', source: EVERY_CALL_WRAPPED },
    ],
    reportedIn: [{ path: 'src/every-call-wrapped.ts', source: EVERY_CALL_WRAPPED }],
  },
  {
    rule: 'unicorn/prefer-logical-operator-over-ternary',
    silentIn: [
      {
        path: 'src/other-branch.ts',
        source: 'export function displayName(name: string, other: string, fallback: string) {\n  return name ? other : fallback\n}\n',
      },
    ],
    reportedIn: [
      {
        path: 'src/condition-repeated.ts',
        source: 'export function displayName(name: string, fallback: string) {\n  return name ? name : fallback\n}\n',
      },
      {
        path: 'src/condition-repeated.js',
        source: 'export function displayName(name, fallback) {\n  return name ? name : fallback\n}\n',
      },
    ],
  },
  // A non-capturing group captures nothing to name.
  {
    rule: 'prefer-named-capture-group',
    silentIn: [
      {
        path: 'src/named-group.ts',
        source: "export function yearOf(date: string) {\n  const match = /(?<year>\\d{4})/u.exec(date)\n  return match?.groups?.year ?? 'unknown'\n}\n",
      },
      {
        path: 'src/non-capturing-group.ts',
        source: 'export const flower = /(?:cauli|sun)flower/u\n',
      },
    ],
    reportedIn: [
      {
        path: 'src/unnamed-group.ts',
        source: "export function yearOf(date: string) {\n  const match = /(\\d{4})/u.exec(date)\n  return match ? match[1] : 'unknown'\n}\n",
      },
      {
        path: 'src/unnamed-group.js',
        source: "export function yearOf(date) {\n  const match = /(\\d{4})/u.exec(date)\n  return match ? match[1] : 'unknown'\n}\n",
      },
    ],
  },
  {
    rule: 'sonarjs/prefer-native-axios-alternative',
    silentIn: [
      {
        path: 'src/abort-controller.ts',
        source: "import axios from 'axios'\n\nconst controller = new AbortController()\n\nexport const users = axios.get('/users', { signal: controller.signal })\n",
      },
    ],
    reportedIn: [
      {
        path: 'src/cancel-token.ts',
        source: "import axios from 'axios'\n\nconst source = axios.CancelToken.source()\n\nexport const users = axios.get('/users', { cancelToken: source.token })\n",
      },
    ],
  },
]

/**
 * The cases of accepted rules that tripped the spec's false-alarm stop, unrun until the owner answers the
 * card each waits on: once the rule ships, its case moves to ACCEPTED_A_CASES.
 */
export const ACCEPTED_A_HELD_CASES: ReadonlyArray<HeldCase<RuleCase>> = []
