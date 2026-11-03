import type { CaseFile } from '../rule-case-runs.ts'
import type { RuleCase } from './changed-settings.ts'

// A rule another case list or the ESLint fallback proves is left to it, as promise's one rule routed to ESLint is.

type SourceFileType = 'ts' | 'cjs'

type Proof = {
  readonly reported: string
  readonly corrected: string
  readonly fileType?: SourceFileType
  /** Files the shipped options report and the rule's defaults leave alone. */
  readonly reportedAsShippedIn?: readonly CaseFile[]
  /** Files the shipped options leave alone and the rule's defaults report. */
  readonly silentAsShippedIn?: readonly CaseFile[]
}

function reportedAndCorrected(rule: string, { reported, corrected, fileType = 'ts', reportedAsShippedIn = [], silentAsShippedIn = [] }: Proof): RuleCase {
  return {
    rule,
    silentIn: [{ path: `src/corrected.${fileType}`, source: corrected }, ...silentAsShippedIn],
    reportedIn: [{ path: `src/reported.${fileType}`, source: reported }, ...reportedAsShippedIn],
  }
}

function importedGlobal(rule: string, { imported, used }: { readonly imported: string; readonly used: string }): RuleCase {
  return reportedAndCorrected(rule, { reported: `${imported}\n${used}\n`, corrected: `${used}\n` })
}

// eslint-disable-next-line no-secrets/no-secrets -- the key is the hard-coded secret the rule must report
const LEAKED_STRIPE_KEY = 'sk_live_4eC39HqLyjWDarjtT1zdp7dcJkRmSLRpQxdpLvMKU7xYz'

const GREETING_PACKAGE = { name: 'greeting', declarations: 'export declare const greeting: string\n', module: "export const greeting = 'hello'\n" }

export const PROOF_NODE_CASES: readonly RuleCase[] = [
  {
    rule: 'check-file/filename-blocklist',
    silentIn: [
      { path: 'src/notes.ts', source: 'export const notes = 1\n' },
      { path: 'src/old-prices.ts', source: 'export const prices = 1\n' },
      { path: 'src/copy-button.ts', source: 'export const copy = 1\n' },
    ],
    reportedIn: [
      { path: 'src/notes.old.ts', source: 'export const notes = 1\n' },
      { path: 'src/notes.bak.ts', source: 'export const notes = 1\n' },
      { path: 'src/notes (1).ts', source: 'export const notes = 1\n' },
      { path: 'src/Copy of notes.ts', source: 'export const notes = 1\n' },
      { path: 'src/untitled.ts', source: 'export const notes = 1\n' },
    ],
  },
  reportedAndCorrected('import-x/no-import-module-exports', {
    reported: "import path from 'node:path'\nmodule.exports = path\n",
    corrected: "import path from 'node:path'\nexport default path\n",
  }),
  // An installed package stands in for a workspace's sibling: its own package.json, reached by a relative path.
  {
    rule: 'import-x/no-relative-packages',
    silentIn: [{ path: 'src/by-name.ts', source: "import { greeting } from 'greeting'\nexport const shown = greeting\n" }],
    reportedIn: [
      { path: 'src/relative.ts', source: "import { greeting } from '../node_modules/greeting/index.js'\nexport const shown = greeting\n" },
      { path: 'src/relative.cjs', source: "const { greeting } = require('../node_modules/greeting/index.js')\nmodule.exports = greeting\n" },
    ],
    packages: [GREETING_PACKAGE],
  },
  reportedAndCorrected('import-x/no-useless-path-segments', {
    reported: "import { target } from './sub/../target.js'\nexport const shown = target\n",
    corrected: "import { target } from './target.js'\nexport const shown = target\n",
    silentAsShippedIn: [{ path: 'src/target.js', source: 'export const target = 1\n' }],
    reportedAsShippedIn: [{ path: 'src/useless.cjs', source: "const { target } = require('./sub/../target.js')\nmodule.exports = target\n" }],
  }),
  reportedAndCorrected('import-x/order', {
    reported: "import local from './local.js'\nimport path from 'node:path'\nexport default [local, path]\n",
    corrected: "import path from 'node:path'\nimport local from './local.js'\nexport default [local, path]\n",
    reportedAsShippedIn: [{ path: 'src/unsorted.ts', source: "import path from 'node:path'\nimport fs from 'node:fs'\nexport default [fs, path]\n" }],
    silentAsShippedIn: [
      { path: 'src/external-first.ts', source: "import { defineLintRules } from '@agents-inc/lint-rules'\nimport path from 'node:path'\nexport default [defineLintRules, path]\n" },
    ],
  }),
  // KNOWN GAP: n/no-unpublished-bin reports only beside a package.json naming a bin, which a RuleCase cannot write without linting it.
  // The project's package.json lists no bin and every file is published, so a shebang is never owed.
  reportedAndCorrected('n/hashbang', {
    reported: '#!/usr/bin/env node\nexport const x = 1\n',
    corrected: 'export const x = 1\n',
  }),
  reportedAndCorrected('n/no-callback-literal', {
    reported: "export function run(callback: (error: unknown) => void): void {\n  callback('oops')\n}\n",
    corrected: "export function run(callback: (error: unknown) => void): void {\n  callback(new Error('oops'))\n}\n",
  }),
  reportedAndCorrected('n/no-deprecated-api', {
    reported: "import { isArray } from 'node:util'\nexport const checked = isArray([])\n",
    corrected: 'export const checked = Array.isArray([])\n',
  }),
  // @agents-inc/lint-rules is the project's one devDependency.
  reportedAndCorrected('n/no-unpublished-require', {
    reported: "const { defineLintRules } = require('@agents-inc/lint-rules')\nmodule.exports = defineLintRules\n",
    corrected: "const path = require('node:path')\nmodule.exports = path\n",
    fileType: 'cjs',
  }),
  importedGlobal('n/prefer-global/buffer', { imported: "import { Buffer } from 'node:buffer'", used: 'export const bytes = Buffer.alloc(1)' }),
  importedGlobal('n/prefer-global/console', { imported: "import { console } from 'node:console'", used: "console.log('saved')" }),
  importedGlobal('n/prefer-global/crypto', { imported: "import { webcrypto as crypto } from 'node:crypto'", used: 'export const id = crypto.randomUUID()' }),
  importedGlobal('n/prefer-global/process', { imported: "import process from 'node:process'", used: 'export const args = process.argv' }),
  importedGlobal('n/prefer-global/text-decoder', { imported: "import { TextDecoder } from 'node:util'", used: 'export const decoder = new TextDecoder()' }),
  importedGlobal('n/prefer-global/text-encoder', { imported: "import { TextEncoder } from 'node:util'", used: 'export const encoder = new TextEncoder()' }),
  importedGlobal('n/prefer-global/timers', { imported: "import { setTimeout } from 'node:timers'", used: 'export const timer = setTimeout(() => undefined, 1)' }),
  importedGlobal('n/prefer-global/url', { imported: "import { URL } from 'node:url'", used: "export const home = new URL('https://example.com')" }),
  importedGlobal('n/prefer-global/url-search-params', { imported: "import { URLSearchParams } from 'node:url'", used: "export const query = new URLSearchParams('a=1')" }),
  reportedAndCorrected('n/prefer-import/assert-strict', {
    reported: "import assert from 'node:assert'\nassert.ok(true)\n",
    corrected: "import assert from 'node:assert/strict'\nassert.ok(true)\n",
  }),
  reportedAndCorrected('n/prefer-promises/dns', {
    reported: "import dns from 'node:dns'\ndns.lookup('example.com', () => undefined)\n",
    corrected: "import dns from 'node:dns/promises'\nexport const found = dns.lookup('example.com')\n",
  }),
  reportedAndCorrected('n/prefer-promises/fs', {
    reported: "import fs from 'node:fs'\nfs.readFile('notes.txt', () => undefined)\n",
    corrected: "import fs from 'node:fs/promises'\nexport const read = fs.readFile('notes.txt')\n",
  }),
  reportedAndCorrected('no-secrets/no-secrets', {
    reported: `export const key = '${LEAKED_STRIPE_KEY}'\n`,
    corrected: 'export const key = process.env.STRIPE_KEY\n',
    // eslint-disable-next-line no-secrets/no-secrets -- the source is credentials in a URL, which the shipped pattern must report
    reportedAsShippedIn: [{ path: 'src/credentials-in-url.ts', source: "export const database = 'postgres://admin:hunter22@db.example.com/app'\n" }],
    silentAsShippedIn: [
      { path: 'src/fixture.ts', source: `export const fixtureKey = '${LEAKED_STRIPE_KEY}'\n` },
      // eslint-disable-next-line no-secrets/no-secrets -- the source is a data URL, which the shipped options leave alone
      { path: 'src/data-url.ts', source: "export const icon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='\n" },
      // eslint-disable-next-line no-secrets/no-secrets -- the source is a subresource hash, which the shipped options leave alone
      { path: 'src/subresource-hash.ts', source: "export const subresourceHash = 'sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC'\n" },
    ],
  }),
]
