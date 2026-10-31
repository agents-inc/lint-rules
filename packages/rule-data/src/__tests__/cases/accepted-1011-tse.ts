import type { HeldCase } from '../accepted-rules-out-of-place.ts'
import type { RuleCase } from './changed-settings.ts'

// The typescript-eslint rules the owner accepted on the old candidates page on 2026-10-11: each reports the page's code
// and stays silent on its corrected form, and on a shape its docs say it leaves alone. The two oxlint runs report
// TypeScript-only syntax, which no .js file holds, so they have no .js copy. Each global namespace a script or
// declaration file declares has a name no other file declares, as the files share one program.

// consistent-type-imports ships typed in ESLint, not in oxlint: under experimentalDecorators and emitDecoratorMetadata,
// oxlint's fix turns the import of a decorated class's constructor parameter type into `import type`, so the emitted
// design:paramtypes names Function, not the class; typescript-eslint's version, typed, leaves such a file alone.

/** How the candidates page proposed shipping each typescript-eslint rule the owner accepted on 2026-10-11. */
type ProposedEntry = {
  readonly ruleset: string
  readonly engine: 'eslint' | 'oxlint'
  readonly oxlintName?: string
  readonly options: readonly object[]
  readonly typed: boolean
}

/**
 * Each accepted typescript-eslint rule as the page proposed it: oxlint where its version there is untyped, else ESLint
 * with type information (each ESLint one reports its case only with it); consistent-type-imports as the owner answered.
 */
export const ACCEPTED_1011_TSE_ENTRIES: Readonly<Record<string, ProposedEntry>> = {
  '@typescript-eslint/consistent-type-exports': { ruleset: 'conventions', engine: 'eslint', options: [], typed: true },
  '@typescript-eslint/consistent-type-imports': { ruleset: 'conventions', engine: 'eslint', options: [{ disallowTypeAnnotations: false }], typed: true },
  '@typescript-eslint/dot-notation': {
    ruleset: 'conventions',
    engine: 'eslint',
    options: [{ allowPrivateClassPropertyAccess: true, allowProtectedClassPropertyAccess: true }],
    typed: true,
  },
  '@typescript-eslint/no-namespace': { ruleset: 'type-safety', engine: 'oxlint', oxlintName: 'typescript/no-namespace', options: [], typed: false },
  '@typescript-eslint/no-unnecessary-qualifier': { ruleset: 'redundancy', engine: 'eslint', options: [], typed: true },
  '@typescript-eslint/parameter-properties': { ruleset: 'type-safety', engine: 'oxlint', oxlintName: 'typescript/parameter-properties', options: [], typed: false },
  '@typescript-eslint/prefer-readonly': { ruleset: 'immutability', engine: 'eslint', options: [], typed: true },
  '@typescript-eslint/prefer-string-starts-ends-with': { ruleset: 'modern-js', engine: 'eslint', options: [], typed: true },
  '@typescript-eslint/use-unknown-in-catch-callback-variable': { ruleset: 'type-safety', engine: 'eslint', options: [], typed: true },
}

const USER_MODULE = `export type User = { readonly name: string }

export const guest: User = { name: 'guest' }
`

const API_MODULE = `export class Api {
  get(path: string) {
    return path
  }
}
`

const INJECTABLE_MODULE = 'export const Injectable = (): ClassDecorator => () => {}\n'

// A container injecting by the emitted design:paramtypes reads the class Api names, so its import is a value import.
const DECORATED_SERVICE = `import { Api } from './api'
import { Injectable } from './injectable'

@Injectable()
export class UserService {
  readonly api: Api

  constructor(api: Api) {
    this.api = api
  }
}
`

const UNDECORATED_SERVICE = `import { Api } from './api'

export class PlainService {
  readonly api: Api

  constructor(api: Api) {
    this.api = api
  }
}
`

const DECORATORS = { experimentalDecorators: true }

/** Each shipped accepted typescript-eslint rule's report case beside its silent twin. */
export const ACCEPTED_1011_TSE_CASES: readonly RuleCase[] = [
  {
    rule: '@typescript-eslint/consistent-type-exports',
    silentIn: [
      { path: 'src/user.ts', source: USER_MODULE },
      { path: 'src/split-exports.ts', source: "export { guest } from './user'\nexport type { User } from './user'\n" },
      { path: 'src/inline-type-export.ts', source: "export { guest, type User } from './user'\n" },
    ],
    reportedIn: [
      { path: 'src/mixed-exports.ts', source: "export { guest, User } from './user'\n" },
      { path: 'src/type-as-value-export.ts', source: "export { User } from './user'\n" },
    ],
  },
  {
    rule: '@typescript-eslint/dot-notation',
    silentIn: [
      { path: 'src/dot-access.ts', source: "const config = { apiUrl: 'https://api.example.com' }\n\nexport const apiUrl = config.apiUrl\n" },
      {
        path: 'src/non-identifier-key.ts',
        source: "const headers = { 'content-type': 'application/json' }\n\nexport const contentType = headers['content-type']\n",
      },
      {
        path: 'src/private-and-protected-access.ts',
        source: `export class Counter {
  private count = 0
  protected step = 1
}

export const peekCount = (counter: Counter) => counter['count']
export const peekStep = (counter: Counter) => counter['step']
`,
      },
    ],
    reportedIn: [
      { path: 'src/bracket-access.ts', source: "const config = { apiUrl: 'https://api.example.com' }\n\nexport const apiUrl = config['apiUrl']\n" },
      {
        path: 'src/public-member-access.ts',
        source: `export class Counter {
  count = 0
}

export const peekCount = (counter: Counter) => counter['count']
`,
      },
    ],
  },
  {
    rule: '@typescript-eslint/no-namespace',
    silentIn: [
      { path: 'src/plain-export.ts', source: "export const currency = 'EUR'\n" },
      { path: 'src/asset-modules.ts', source: "declare module '*.svg' {\n  const url: string\n  export default url\n}\n" },
      { path: 'src/analytics-globals.d.ts', source: "declare namespace Analytics {\n  type Event = { readonly name: string }\n}\n" },
    ],
    reportedIn: [
      { path: 'src/namespace-block.ts', source: "export namespace Billing {\n  export const currency = 'EUR'\n}\n" },
      { path: 'src/declared-namespace.ts', source: "export declare namespace Billing {\n  const currency: string\n}\n" },
    ],
  },
  {
    rule: '@typescript-eslint/no-unnecessary-qualifier',
    silentIn: [
      {
        path: 'src/unqualified.ts',
        source: "export namespace Billing {\n  export type Currency = 'EUR' | 'USD'\n  export const fallback: Currency = 'EUR'\n}\n",
      },
      {
        path: 'src/qualified-outside.ts',
        source: "export namespace Billing {\n  export type Currency = 'EUR' | 'USD'\n}\n\nexport const fallback: Billing.Currency = 'EUR'\n",
      },
    ],
    reportedIn: [
      {
        path: 'src/qualified-inside.ts',
        source: "namespace Billing {\n  export type Currency = 'EUR' | 'USD'\n  export const fallback: Billing.Currency = 'EUR'\n}\n",
      },
    ],
  },
  {
    rule: '@typescript-eslint/parameter-properties',
    silentIn: [
      {
        path: 'src/assigned-field.ts',
        source: `type Api = { get: (path: string) => Promise<unknown> }

export class UserService {
  private readonly api: Api

  constructor(api: Api) {
    this.api = api
  }
}
`,
      },
      {
        path: 'src/plain-parameter.ts',
        source: `export class Greeting {
  readonly text: string

  constructor(name: string) {
    this.text = \`Hello \${name}\`
  }
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/private-readonly-parameter.ts',
        source: `type Api = { get: (path: string) => Promise<unknown> }

export class UserService {
  constructor(private readonly api: Api) {}
}
`,
      },
      {
        path: 'src/public-parameter.ts',
        source: `type Api = { get: (path: string) => Promise<unknown> }

export class UserService {
  constructor(public api: Api) {}
}
`,
      },
    ],
  },
  {
    rule: '@typescript-eslint/prefer-readonly',
    silentIn: [
      {
        path: 'src/readonly-field.ts',
        source: `export class Cart {
  private readonly items: string[] = []

  count() {
    return this.items.length
  }
}
`,
      },
      {
        path: 'src/reassigned-field.ts',
        source: `export class Counter {
  private count = 0

  increment() {
    this.count += 1
    return this.count
  }
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/never-reassigned-field.ts',
        source: `export class Cart {
  private items: string[] = []

  count() {
    return this.items.length
  }
}
`,
      },
      {
        path: 'src/never-reassigned-hash-field.ts',
        source: `export class Cart {
  #items: string[] = []

  count() {
    return this.#items.length
  }
}
`,
      },
    ],
  },
  {
    rule: '@typescript-eslint/prefer-string-starts-ends-with',
    silentIn: [
      { path: 'src/starts-with.ts', source: "export const isHeading = (line: string) => line.startsWith('#')\n" },
      { path: 'src/array-index-of.ts', source: "export const startsWithHeading = (lines: readonly string[]) => lines.indexOf('#') === 0\n" },
    ],
    reportedIn: [
      { path: 'src/index-of-zero.ts', source: "export const isHeading = (line: string) => line.indexOf('#') === 0\n" },
      { path: 'src/anchored-regex.ts', source: 'export const isHeading = (line: string) => /^#/.test(line)\n' },
    ],
  },
  {
    rule: '@typescript-eslint/use-unknown-in-catch-callback-variable',
    silentIn: [
      {
        path: 'src/unknown-error.ts',
        source: `export const loadName = (request: Promise<string>) =>
  request.catch((error: unknown) => {
    console.error(error)
    return 'unknown'
  })
`,
      },
      { path: 'src/no-error-parameter.ts', source: "export const loadName = (request: Promise<string>) => request.catch(() => 'unknown')\n" },
    ],
    reportedIn: [
      {
        path: 'src/untyped-error.ts',
        source: `export const loadName = (request: Promise<string>) =>
  request.catch((error) => {
    console.error(error)
    return 'unknown'
  })
`,
      },
      {
        path: 'src/untyped-rejection-handler.ts',
        source: `export const loadName = (request: Promise<string>) =>
  request.then(
    (name) => name,
    (error) => {
      console.error(error)
      return 'unknown'
    },
  )
`,
      },
    ],
  },
  {
    rule: '@typescript-eslint/consistent-type-imports',
    silentIn: [
      { path: 'src/user.ts', source: USER_MODULE },
      { path: 'src/type-import.ts', source: "import type { User } from './user'\n\nexport const greet = (user: User) => `Hello ${user.name}`\n" },
      { path: 'src/inline-import-type.ts', source: "export const greet = (user: import('./user').User) => `Hello ${user.name}`\n" },
      { path: 'src/value-import.ts', source: "import { guest } from './user'\n\nexport const guestName = guest.name\n" },
    ],
    reportedIn: [
      { path: 'src/type-used-as-value-import.ts', source: "import { User } from './user'\n\nexport const greet = (user: User) => `Hello ${user.name}`\n" },
      {
        path: 'src/mixed-import.ts',
        source: "import { guest, User } from './user'\n\nexport const greet = (user: User = guest) => `Hello ${user.name}`\n",
      },
    ],
  },
]

/**
 * consistent-type-imports, typed, beside decorators: it leaves the import a decorated class's emitted design:paramtypes
 * reads, and reports the same import where no metadata is emitted.
 */
export const TYPE_IMPORTS_BESIDE_DECORATORS_CASES: readonly RuleCase[] = [
  {
    rule: '@typescript-eslint/consistent-type-imports',
    subject: 'a decorated class under emitDecoratorMetadata',
    compilerOptions: { ...DECORATORS, emitDecoratorMetadata: true },
    silentIn: [
      { path: 'src/api.ts', source: API_MODULE },
      { path: 'src/injectable.ts', source: INJECTABLE_MODULE },
      { path: 'src/user-service.ts', source: DECORATED_SERVICE },
    ],
    reportedIn: [{ path: 'src/plain-service.ts', source: UNDECORATED_SERVICE }],
  },
  {
    rule: '@typescript-eslint/consistent-type-imports',
    subject: 'a decorated class without emitDecoratorMetadata',
    compilerOptions: DECORATORS,
    silentIn: [
      { path: 'src/api.ts', source: API_MODULE },
      { path: 'src/injectable.ts', source: INJECTABLE_MODULE },
    ],
    reportedIn: [{ path: 'src/user-service.ts', source: DECORATED_SERVICE }],
  },
]

/**
 * The cases of accepted typescript-eslint rules whose measurement tripped the spec's stop, unrun until the owner answers
 * the card each waits on: once the rule ships, its case moves to ACCEPTED_1011_TSE_CASES.
 */
export const ACCEPTED_1011_TSE_HELD_CASES: ReadonlyArray<HeldCase<RuleCase>> = []
