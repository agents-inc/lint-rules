import { type JsonLayout, OUR_PACKAGE, OUR_RANGE, type PackageJsonObject, packageJsonTextIn } from '../factories/init-factories.ts'

// I-1 and I-7 (q-i4; spec-cli.md "The package.json edit"): init adds `"@agents-inc/lint-rules":
// "^<our version>"` to devDependencies, before the first key that sorts after it, else last, and a
// devDependencies it lacks as the last key; an entry under dependencies or devDependencies stays as
// it is. It edits the text, keeping every other byte. Each case's file before and after init, laid
// out the same way; `keywords` is an array on one line, which re-serialising would spread out.

export type PackageJsonEdit = {
  readonly kind: string
  readonly layout: JsonLayout
  readonly before: PackageJsonObject
  readonly after: PackageJsonObject
}

const TWO_SPACES_LF: JsonLayout = { indent: '  ', eol: '\n', finalNewline: true }
const FOUR_SPACES_LF: JsonLayout = { indent: '    ', eol: '\n', finalNewline: true }
const TAB_LF: JsonLayout = { indent: '\t', eol: '\n', finalNewline: true }
const TWO_SPACES_CRLF: JsonLayout = { indent: '  ', eol: '\r\n', finalNewline: true }
const TWO_SPACES_LF_NO_FINAL_NEWLINE: JsonLayout = { indent: '  ', eol: '\n', finalNewline: false }
const FOUR_SPACES_CRLF_NO_FINAL_NEWLINE: JsonLayout = { indent: '    ', eol: '\r\n', finalNewline: false }
const TAB_CRLF: JsonLayout = { indent: '\t', eol: '\r\n', finalNewline: true }

const PACKAGE_FIELDS: PackageJsonObject = {
  name: 'consumer-project',
  version: '1.0.0',
  private: true,
  type: 'module',
  keywords: { writtenAsIs: '["lint", "agents"]' },
  scripts: { test: 'vitest run' },
}
const OURS = { [OUR_PACKAGE]: OUR_RANGE }

export const PACKAGE_JSON_EDITS: readonly PackageJsonEdit[] = [
  {
    kind: 'sorted devDependencies, two-space indent, LF',
    layout: TWO_SPACES_LF,
    before: { ...PACKAGE_FIELDS, devDependencies: { eslint: '^10.0.0', typescript: '^6.0.0' } },
    after: { ...PACKAGE_FIELDS, devDependencies: { ...OURS, eslint: '^10.0.0', typescript: '^6.0.0' } },
  },
  {
    kind: 'a devDependency that sorts before ours, four-space indent, LF',
    layout: FOUR_SPACES_LF,
    before: { ...PACKAGE_FIELDS, devDependencies: { '@aaa/first': '1.0.0', eslint: '^10.0.0' } },
    after: { ...PACKAGE_FIELDS, devDependencies: { '@aaa/first': '1.0.0', ...OURS, eslint: '^10.0.0' } },
  },
  {
    kind: 'no devDependencies, tab indent, LF',
    layout: TAB_LF,
    before: PACKAGE_FIELDS,
    after: { ...PACKAGE_FIELDS, devDependencies: OURS },
  },
  {
    kind: 'unsorted devDependencies, the first that sorts after ours first in the file, two-space indent, CRLF',
    layout: TWO_SPACES_CRLF,
    before: { ...PACKAGE_FIELDS, devDependencies: { zod: '^4.0.0', '@aaa/first': '1.0.0', eslint: '^10.0.0' } },
    after: { ...PACKAGE_FIELDS, devDependencies: { ...OURS, zod: '^4.0.0', '@aaa/first': '1.0.0', eslint: '^10.0.0' } },
  },
  {
    kind: 'every devDependency sorting before ours, so ours goes last, two-space indent, no final newline',
    layout: TWO_SPACES_LF_NO_FINAL_NEWLINE,
    before: { ...PACKAGE_FIELDS, devDependencies: { '@aaa/first': '1.0.0', '@abc/second': '2.0.0' } },
    after: { ...PACKAGE_FIELDS, devDependencies: { '@aaa/first': '1.0.0', '@abc/second': '2.0.0', ...OURS } },
  },
  {
    kind: 'no devDependencies, four-space indent, CRLF, no final newline',
    layout: FOUR_SPACES_CRLF_NO_FINAL_NEWLINE,
    before: PACKAGE_FIELDS,
    after: { ...PACKAGE_FIELDS, devDependencies: OURS },
  },
  {
    kind: 'an empty devDependencies, tab indent, CRLF',
    layout: TAB_CRLF,
    before: { ...PACKAGE_FIELDS, devDependencies: {} },
    after: { ...PACKAGE_FIELDS, devDependencies: OURS },
  },
  {
    kind: 'devDependencies before another key, two-space indent, LF',
    layout: TWO_SPACES_LF,
    before: { ...PACKAGE_FIELDS, devDependencies: { typescript: '^6.0.0' }, engines: { node: '>=22.18' } },
    after: { ...PACKAGE_FIELDS, devDependencies: { ...OURS, typescript: '^6.0.0' }, engines: { node: '>=22.18' } },
  },
]

/** Entries init keeps as they are, and one it does not count (q-i4). */
export const PACKAGE_JSON_LISTING_US: readonly (PackageJsonEdit & { readonly entry: 'added' | 'kept' })[] = [
  {
    kind: 'listed under dependencies',
    entry: 'kept',
    layout: TWO_SPACES_LF,
    before: { ...PACKAGE_FIELDS, dependencies: { [OUR_PACKAGE]: '^9.9.9' } },
    after: { ...PACKAGE_FIELDS, dependencies: { [OUR_PACKAGE]: '^9.9.9' } },
  },
  {
    kind: 'listed under devDependencies, out of order',
    entry: 'kept',
    layout: TWO_SPACES_LF,
    before: { ...PACKAGE_FIELDS, devDependencies: { eslint: '^10.0.0', [OUR_PACKAGE]: '~0.0.1' } },
    after: { ...PACKAGE_FIELDS, devDependencies: { eslint: '^10.0.0', [OUR_PACKAGE]: '~0.0.1' } },
  },
  {
    kind: 'listed only under peerDependencies',
    entry: 'added',
    layout: TWO_SPACES_LF,
    before: { ...PACKAGE_FIELDS, peerDependencies: { [OUR_PACKAGE]: '*' } },
    after: { ...PACKAGE_FIELDS, peerDependencies: { [OUR_PACKAGE]: '*' }, devDependencies: OURS },
  },
]

/** A package.json's text before init's edit, and after it. */
export type PackageJsonTextEdit = { readonly kind: string; readonly before: string; readonly after: string }

const A_VALUE_WITH_ESCAPES = 'says "hi", and \\ goes on'
const WITH_ARRAYS: PackageJsonObject = { name: 'consumer-project', files: { writtenAsIs: '["dist"]' }, workspaces: { writtenAsIs: '[]' } }
const ON_ONE_LINE = '"name":"consumer-project","version":"1.0.0","private":true'
const OUR_ENTRY = `${JSON.stringify(OUR_PACKAGE)}: ${JSON.stringify(OUR_RANGE)}`

/**
 * Texts the edit reads past to find where the entry goes (q-i4): a string holding an escaped quote
 * and a backslash, arrays of one value and of none, and a file on one line, ending in a literal. A
 * file on one line has no indent to copy, so the lines init adds indent two spaces a level.
 */
export const PACKAGE_JSON_TEXT_EDITS: readonly PackageJsonTextEdit[] = [
  {
    kind: 'a string holding an escaped quote and a backslash',
    before: packageJsonTextIn({ name: 'consumer-project', description: A_VALUE_WITH_ESCAPES, devDependencies: { eslint: '^10.0.0' } }, TWO_SPACES_LF),
    after: packageJsonTextIn({ name: 'consumer-project', description: A_VALUE_WITH_ESCAPES, devDependencies: { ...OURS, eslint: '^10.0.0' } }, TWO_SPACES_LF),
  },
  {
    kind: 'an array of one value and an empty one',
    before: packageJsonTextIn({ ...WITH_ARRAYS, devDependencies: { eslint: '^10.0.0' } }, TWO_SPACES_LF),
    after: packageJsonTextIn({ ...WITH_ARRAYS, devDependencies: { ...OURS, eslint: '^10.0.0' } }, TWO_SPACES_LF),
  },
  {
    kind: 'no devDependencies, all on one line',
    before: `{${ON_ONE_LINE}}`,
    after: `{${ON_ONE_LINE},\n  "devDependencies": {\n    ${OUR_ENTRY}\n  }}`,
  },
  {
    kind: 'devDependencies, all on one line',
    before: `{${ON_ONE_LINE},"devDependencies":{"eslint":"^10.0.0"}}`,
    after: `{${ON_ONE_LINE},"devDependencies":{${OUR_ENTRY},\n    "eslint":"^10.0.0"}}`,
  },
]

/** A package.json whose devDependencies is an array: the edit refuses it, naming the file. */
export const DEV_DEPENDENCIES_AS_AN_ARRAY = packageJsonTextIn({ name: 'consumer-project', devDependencies: { writtenAsIs: '["eslint"]' } }, TWO_SPACES_LF)
