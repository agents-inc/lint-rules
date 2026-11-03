import type { HeldCase } from '../accepted-rules-out-of-place.ts'
import type { CaseFile } from '../rule-case-runs.ts'
import type { RuleCase } from './changed-settings.ts'

// A `.js` copy of the code that uses `using`, `Temporal` or an iterator helper proves the shipped parser reads it
// outside TypeScript too.

const FIELD_WITH_BOTH_ACCESSORS = `class Field {
  #value = ''
  get value() { return this.#value }
  set value(next: string) { this.#value = next }
}
`

const SETTER_ONLY_OVERRIDE: CaseFile = {
  path: 'src/trimmed-field.ts',
  source: `${FIELD_WITH_BOTH_ACCESSORS}
export class TrimmedField extends Field {
  set value(next: string) { super.value = next.trim() }
}
`,
}

const SETTER_ONLY_OVERRIDE_IN_A_TEST_FILE: CaseFile = { path: 'src/trimmed-field.test.ts', source: SETTER_ONLY_OVERRIDE.source }

// Each digest a string of its own, as an integrity attribute holds it: no-secrets leaves such a string alone.
const APP_SCRIPT_DIGEST = 'sha256-LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ='
const APP_STYLES_DIGEST = 'sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC'

const BOTH_ACCESSORS_OVERRIDDEN: CaseFile = {
  path: 'src/trimmed-field-both.ts',
  source: `${FIELD_WITH_BOTH_ACCESSORS}
export class TrimmedField extends Field {
  get value() { return super.value }
  set value(next: string) { super.value = next.trim() }
}
`,
}

type ProposedEntry = {
  readonly ruleset: string
  readonly engine: 'eslint'
  readonly options: readonly object[]
  readonly typed: boolean
}

export const ACCEPTED_1011_UG_ENTRIES: Readonly<Record<string, ProposedEntry>> = {
  'unicorn/no-async-iterator-callback': { ruleset: 'correctness', engine: 'eslint', options: [], typed: false },
  'unicorn/no-conflicting-constraints': { ruleset: 'correctness', engine: 'eslint', options: [], typed: false },
  'unicorn/no-incomplete-accessor-override': { ruleset: 'correctness', engine: 'eslint', options: [], typed: false },
  'unicorn/no-ineffective-csp-directives': { ruleset: 'security', engine: 'eslint', options: [], typed: false },
  'unicorn/no-invalid-boolean-attribute-value': { ruleset: 'browser', engine: 'eslint', options: [], typed: false },
  'unicorn/no-invalid-dom-token': { ruleset: 'browser', engine: 'eslint', options: [], typed: false },
  'unicorn/no-invalid-integrity': { ruleset: 'security', engine: 'eslint', options: [], typed: false },
  'unicorn/no-invalid-intl-options': { ruleset: 'correctness', engine: 'eslint', options: [], typed: false },
  'unicorn/no-invalid-property-descriptor': { ruleset: 'correctness', engine: 'eslint', options: [], typed: false },
  'unicorn/no-invalid-response-options': { ruleset: 'correctness', engine: 'eslint', options: [], typed: false },
  'unicorn/no-invalid-style-set-property': { ruleset: 'browser', engine: 'eslint', options: [], typed: false },
  'unicorn/no-invalid-temporal-arithmetic': { ruleset: 'correctness', engine: 'eslint', options: [], typed: false },
  'unicorn/no-invalid-url-protocol-comparison': { ruleset: 'correctness', engine: 'eslint', options: [], typed: false },
  'unicorn/no-prevent-default-in-passive-listener': { ruleset: 'browser', engine: 'eslint', options: [], typed: false },
  'unicorn/no-unsafe-json-serialization': { ruleset: 'correctness', engine: 'eslint', options: [], typed: false },
  'unicorn/no-unused-iterator-helper': { ruleset: 'correctness', engine: 'eslint', options: [], typed: false },
  'unicorn/no-url-in-search-params': { ruleset: 'correctness', engine: 'eslint', options: [], typed: false },
  'unicorn/no-using-resource-escape': { ruleset: 'correctness', engine: 'eslint', options: [], typed: false },
  'unicorn/require-text-decoder-streaming': { ruleset: 'correctness', engine: 'eslint', options: [], typed: false },
}

export const ACCEPTED_1011_UG_CASES: readonly RuleCase[] = [
  {
    rule: 'unicorn/no-conflicting-constraints',
    silentIn: [
      { path: 'src/quantity-bounded.tsx', source: 'export const Quantity = () => <input type="number" min={1} max={10} />\n' },
      { path: 'src/display-name.tsx', source: 'export const DisplayName = () => <input type="text" minLength={2} maxLength={40} />\n' },
    ],
    reportedIn: [{ path: 'src/quantity.tsx', source: 'export const Quantity = () => <input type="number" min={10} max={5} />\n' }],
  },
  {
    rule: 'unicorn/no-incomplete-accessor-override',
    silentIn: [
      BOTH_ACCESSORS_OVERRIDDEN,
      {
        path: 'src/labelled-badge.ts',
        source: `class Badge {
  get label() { return 'badge' }
}

export class LabelledBadge extends Badge {
  get label() { return 'labelled badge' }
}
`,
      },
    ],
    reportedIn: [
      SETTER_ONLY_OVERRIDE,
      SETTER_ONLY_OVERRIDE_IN_A_TEST_FILE,
      {
        path: 'src/upper-field.ts',
        source: `${FIELD_WITH_BOTH_ACCESSORS}
export class UpperField extends Field {
  get value() { return super.value.toUpperCase() }
}
`,
      },
    ],
  },
  {
    rule: 'unicorn/no-invalid-intl-options',
    silentIn: [
      {
        path: 'src/format-price-in-pounds.ts',
        source: `export const formatPrice = (amount: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount)
`,
      },
      {
        path: 'src/format-ratio.ts',
        source: "export const formatRatio = (ratio: number) => new Intl.NumberFormat('en-GB', { style: 'percent' }).format(ratio)\n",
      },
    ],
    reportedIn: [
      {
        path: 'src/format-price.ts',
        source: `export const formatPrice = (amount: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency' }).format(amount)
`,
      },
    ],
  },
  {
    rule: 'unicorn/no-invalid-property-descriptor',
    silentIn: [
      {
        path: 'src/settings-getter.ts',
        source: `export const settings = {}

Object.defineProperty(settings, 'version', {
  get: () => '1.0.0',
})
`,
      },
      {
        path: 'src/settings-value.ts',
        source: `export const settings = {}

Object.defineProperty(settings, 'version', {
  value: '1.0.0',
  writable: false,
})
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/settings.ts',
        source: `export const settings = {}

Object.defineProperty(settings, 'version', {
  get: () => '1.0.0',
  writable: false,
})
`,
      },
    ],
  },
  {
    rule: 'unicorn/no-invalid-response-options',
    silentIn: [
      { path: 'src/no-content-null.ts', source: 'export const noContent = () => new Response(null, { status: 204 })\n' },
      { path: 'src/created.ts', source: "export const created = () => new Response('Created', { status: 201 })\n" },
    ],
    reportedIn: [{ path: 'src/no-content.ts', source: "export const noContent = () => new Response('', { status: 204 })\n" }],
  },
  {
    rule: 'unicorn/no-invalid-temporal-arithmetic',
    silentIn: [
      { path: 'src/tomorrow-zoned.ts', source: 'export const tomorrow = () => Temporal.Now.zonedDateTimeISO().add({ days: 1 })\n' },
      { path: 'src/in-a-day.ts', source: 'export const inADay = () => Temporal.Now.instant().add({ hours: 24 })\n' },
    ],
    reportedIn: [
      { path: 'src/tomorrow.ts', source: 'export const tomorrow = () => Temporal.Now.instant().add({ days: 1 })\n' },
      { path: 'src/tomorrow.js', source: 'export const tomorrow = () => Temporal.Now.instant().add({ days: 1 })\n' },
    ],
  },
  {
    rule: 'unicorn/no-invalid-url-protocol-comparison',
    silentIn: [
      { path: 'src/is-secure-colon.ts', source: "export const isSecure = (href: string) => new URL(href).protocol === 'https:'\n" },
      { path: 'src/is-mail.ts', source: "export const isMail = (href: string) => new URL(href).protocol === 'mailto:'\n" },
    ],
    reportedIn: [{ path: 'src/is-secure.ts', source: "export const isSecure = (href: string) => new URL(href).protocol === 'https'\n" }],
  },
  {
    rule: 'unicorn/no-unsafe-json-serialization',
    silentIn: [
      { path: 'src/body-array.ts', source: "export const body = JSON.stringify({ roles: ['admin', 'editor'] })\n" },
      { path: 'src/body-spread.ts', source: "export const body = JSON.stringify({ roles: [...new Set(['admin', 'editor'])] })\n" },
    ],
    reportedIn: [{ path: 'src/body.ts', source: "export const body = JSON.stringify({ roles: new Set(['admin', 'editor']) })\n" }],
  },
  {
    rule: 'unicorn/no-unused-iterator-helper',
    silentIn: [
      {
        path: 'src/notify-all-loop.ts',
        source: `export function notifyAll(users: Map<string, string>, notify: (email: string) => void) {
  for (const email of users.values()) {
    notify(email)
  }
}
`,
      },
      {
        path: 'src/emails.ts',
        source: `export function emails(users: Map<string, { readonly email: string }>) {
  return users.values().map(({ email }) => email).toArray()
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/notify-all.ts',
        source: `export function notifyAll(users: Map<string, string>, notify: (email: string) => void) {
  users.values().map(notify)
}
`,
      },
      {
        path: 'src/notify-all.js',
        source: `export function notifyAll(users, notify) {
  users.values().map(notify)
}
`,
      },
    ],
  },
  {
    rule: 'unicorn/no-url-in-search-params',
    silentIn: [
      { path: 'src/params-search.ts', source: 'export const params = new URLSearchParams(window.location.search)\n' },
      { path: 'src/page-params.ts', source: "export const params = new URLSearchParams({ page: '2' })\n" },
    ],
    reportedIn: [{ path: 'src/params.ts', source: 'export const params = new URLSearchParams(window.location.href)\n' }],
  },
  {
    rule: 'unicorn/no-using-resource-escape',
    silentIn: [
      {
        path: 'src/read-log.ts',
        source: `declare function openFile(path: string): Disposable & { read(): string }

export function readLog() {
  using file = openFile('app.log')
  return file.read()
}
`,
      },
      {
        path: 'src/open-log-unscoped.ts',
        source: `declare function openFile(path: string): Disposable & { read(): string }

export function openLog() {
  const file = openFile('app.log')
  return file
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/open-log.ts',
        source: `declare function openFile(path: string): Disposable & { read(): string }

export function openLog() {
  using file = openFile('app.log')
  return file
}
`,
      },
      {
        path: 'src/open-log.js',
        source: `import { openFile } from './files.js'

export function openLog() {
  using file = openFile('app.log')
  return file
}
`,
      },
    ],
  },
  {
    rule: 'unicorn/require-text-decoder-streaming',
    silentIn: [
      {
        path: 'src/read-text-streaming.ts',
        source: `export async function readText(url: string) {
  const response = await fetch(url)
  const decoder = new TextDecoder()
  let text = ''
  for await (const chunk of response.body) {
    text += decoder.decode(chunk, { stream: true })
  }
  return text + decoder.decode()
}
`,
      },
      { path: 'src/decode-all.ts', source: 'export const decodeAll = (bytes: Uint8Array) => new TextDecoder().decode(bytes)\n' },
    ],
    reportedIn: [
      {
        path: 'src/read-text.ts',
        source: `export async function readText(url: string) {
  const response = await fetch(url)
  const decoder = new TextDecoder()
  let text = ''
  for await (const chunk of response.body) {
    text += decoder.decode(chunk)
  }
  return text
}
`,
      },
    ],
  },
  {
    rule: 'unicorn/no-ineffective-csp-directives',
    silentIn: [
      {
        path: 'src/policy-header-only.tsx',
        source: `// frame-ancestors moves to the Content-Security-Policy response header.
export const Policy = () => <meta httpEquiv="Content-Security-Policy" content="default-src 'self'" />
`,
      },
      {
        path: 'src/image-policy.tsx',
        source: `export const ImagePolicy = () => <meta httpEquiv="Content-Security-Policy" content="default-src 'self'; img-src https:" />
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/policy.tsx',
        source: `export const Policy = () => (
  <meta httpEquiv="Content-Security-Policy" content="default-src 'self'; frame-ancestors 'none'" />
)
`,
      },
    ],
  },
  {
    rule: 'unicorn/no-invalid-integrity',
    silentIn: [
      {
        path: 'src/app-script-hashed.tsx',
        source: `export const AppScript = () => (
  <script src="/app.js" integrity="${APP_SCRIPT_DIGEST}" />
)
`,
      },
      {
        path: 'src/app-styles.tsx',
        source: `export const AppStyles = () => (
  <link
    rel="stylesheet"
    href="/app.css"
    integrity="${APP_STYLES_DIGEST}"
    crossOrigin="anonymous"
  />
)
`,
      },
    ],
    reportedIn: [{ path: 'src/app-script.tsx', source: 'export const AppScript = () => <script src="/app.js" integrity="sha256-abc" />\n' }],
  },
  {
    rule: 'unicorn/no-invalid-boolean-attribute-value',
    silentIn: [
      {
        path: 'src/enable-button.ts',
        source: `const button = document.createElement('button')
button.removeAttribute('disabled')
`,
      },
      {
        path: 'src/disable-button.ts',
        source: `const button = document.createElement('button')
button.setAttribute('disabled', '')
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/button.ts',
        source: `const button = document.createElement('button')
button.setAttribute('disabled', 'false')
`,
      },
    ],
  },
  {
    rule: 'unicorn/no-invalid-dom-token',
    silentIn: [
      { path: 'src/select-each.ts', source: "export const select = (card: HTMLElement) => card.classList.add('card', 'selected')\n" },
      { path: 'src/toggle.ts', source: "export const toggle = (card: HTMLElement) => card.classList.toggle('selected')\n" },
    ],
    reportedIn: [{ path: 'src/select.ts', source: "export const select = (card: HTMLElement) => card.classList.add('card selected')\n" }],
  },
  {
    rule: 'unicorn/no-invalid-style-set-property',
    silentIn: [
      {
        path: 'src/paint-kebab.ts',
        source: "export const paint = (element: HTMLElement) => element.style.setProperty('background-color', 'red')\n",
      },
      { path: 'src/accent.ts', source: "export const accent = (element: HTMLElement) => element.style.setProperty('--accent', 'red')\n" },
    ],
    reportedIn: [
      { path: 'src/paint.ts', source: "export const paint = (element: HTMLElement) => element.style.setProperty('backgroundColor', 'red')\n" },
    ],
  },
  {
    rule: 'unicorn/no-prevent-default-in-passive-listener',
    silentIn: [
      {
        path: 'src/wheel-active.ts',
        source: `window.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault()
  },
  { passive: false },
)
`,
      },
      {
        path: 'src/wheel-tracked.ts',
        source: `declare function trackScroll(delta: number): void

window.addEventListener(
  'wheel',
  (event) => {
    trackScroll(event.deltaY)
  },
  { passive: true },
)
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/wheel.ts',
        source: `window.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault()
  },
  { passive: true },
)
`,
      },
    ],
  },
  {
    rule: 'unicorn/no-async-iterator-callback',
    silentIn: [
      {
        path: 'src/unsaved-drafts-awaited.ts',
        source: `export async function unsavedDrafts(drafts: Set<string>, isSaved: (draft: string) => Promise<boolean>) {
  const checked = await Promise.all(
    [...drafts].map(async (draft) => ({ draft, saved: await isSaved(draft) })),
  )
  return checked.filter(({ saved }) => !saved).map(({ draft }) => draft)
}
`,
      },
      {
        path: 'src/saved-states.ts',
        source: `export async function savedStates(drafts: Set<string>, isSaved: (draft: string) => Promise<boolean>) {
  return Promise.all(Iterator.from(drafts).map((draft) => isSaved(draft)).toArray())
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/unsaved-drafts.ts',
        source: `export function unsavedDrafts(drafts: Set<string>, isSaved: (draft: string) => Promise<boolean>) {
  // Every draft passes: an async callback returns a promise, and a promise is always truthy.
  return Iterator.from(drafts)
    .filter(async (draft) => !(await isSaved(draft)))
    .toArray()
}
`,
      },
      {
        path: 'src/unsaved-drafts.js',
        source: `export function unsavedDrafts(drafts, isSaved) {
  return Iterator.from(drafts)
    .filter(async (draft) => !(await isSaved(draft)))
    .toArray()
}
`,
      },
      {
        path: 'src/save-each.ts',
        source: `export function saveEach(drafts: Set<string>, save: (draft: string) => Promise<void>) {
  Iterator.from(drafts).forEach(async (draft) => {
    await save(draft)
  })
}
`,
      },
    ],
  },
]

export const ACCEPTED_1011_UG_HELD_CASES: ReadonlyArray<HeldCase<RuleCase>> = []

export const ACCESSOR_PAIRS_BESIDE_THE_OVERRIDE_RULE: RuleCase = {
  rule: 'accessor-pairs',
  subject: 'a setter-only override no-incomplete-accessor-override reports',
  silentIn: [SETTER_ONLY_OVERRIDE_IN_A_TEST_FILE, BOTH_ACCESSORS_OVERRIDDEN],
  reportedIn: [SETTER_ONLY_OVERRIDE],
}
