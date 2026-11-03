import { buildBundlerTsconfig } from '../factories/tsconfig-factories.ts'

// Measured on eslint-plugin-sonarjs 4.2.2 and eslint-plugin-unicorn 78.0.0. sonarjs' fix moves the value into the
// return, which drops the `using` and so its disposal; unicorn reports the escape on the return's line.

export const PREFER_IMMEDIATE_RETURN = 'sonarjs/prefer-immediate-return'
export const USING_RESOURCE_ESCAPE = 'unicorn/no-using-resource-escape'

type WrittenFile = { readonly file: string; readonly source: string }

type ReportedFile = WrittenFile & { readonly line: number }

type FixedFile = ReportedFile & { readonly fixed: string }

/** Lib ESNext declares Disposable and AsyncDisposable. */
export const TSCONFIG_DECLARING_DISPOSABLES = `${JSON.stringify(buildBundlerTsconfig({ lib: ['ESNext'] }))}\n`

/** Each returns a variable a `using` declaration holds, so the resource is disposed as it leaves: in path order as check prints their findings, each on the line unicorn reports. */
export const RETURNED_USING_RESOURCES: readonly ReportedFile[] = [
  {
    file: 'src/open-log-async.ts',
    source: `declare function openFileAsync(path: string): Promise<AsyncDisposable & { read(): Promise<string> }>

export async function openLogAsync() {
  await using file = await openFileAsync('app.log')
  return file
}
`,
    line: 5,
  },
  {
    file: 'src/open-log.js',
    source: `import { openFile } from './files.js'

export function openLog() {
  using file = openFile('app.log')
  return file
}
`,
    line: 5,
  },
  {
    file: 'src/open-log.ts',
    source: `declare function openFile(path: string): Disposable & { read(): string }

export function openLog() {
  using file = openFile('app.log')
  return file
}
`,
    line: 5,
  },
]

/** Each throws a variable a `using` declaration holds, so the resource is disposed as it leaves; only prefer-immediate-return reports it, on its own. */
export const THROWN_USING_RESOURCES: readonly WrittenFile[] = [
  {
    file: 'src/fail-with-log-async.ts',
    source: `declare function openFailureAsync(path: string): Promise<AsyncDisposable & Error>

export async function failWithLogAsync() {
  await using failure = await openFailureAsync('app.log')
  throw failure
}
`,
  },
  {
    file: 'src/fail-with-log.js',
    source: `import { openFailure } from './failures.js'

export function failWithLog() {
  using failure = openFailure('app.log')
  throw failure
}
`,
  },
  {
    file: 'src/fail-with-log.ts',
    source: `declare function openFailure(path: string): Disposable & Error

export function failWithLog() {
  using failure = openFailure('app.log')
  throw failure
}
`,
  },
]

/** Each returns or throws a `const` declared just before: in path order, each on the line prefer-immediate-return reports. */
export const VALUES_RETURNED_IMMEDIATELY_ONCE_FIXED: readonly FixedFile[] = [
  {
    file: 'src/first-line.ts',
    source: `declare function openFile(path: string): Disposable & { read(): string }

export function firstLine() {
  using file = openFile('app.log')
  const line = file.read()
  return line
}
`,
    line: 5,
    fixed: `declare function openFile(path: string): Disposable & { read(): string }

export function firstLine() {
  using file = openFile('app.log')
  return file.read()
}
`,
  },
  {
    file: 'src/missing-log.ts',
    source: `export function missingLog(path: string) {
  const error = new Error(\`no log at \${path}\`)
  throw error
}
`,
    line: 2,
    fixed: `export function missingLog(path: string) {
  throw new Error(\`no log at \${path}\`)
}
`,
  },
  {
    file: 'src/open-log-unscoped.ts',
    source: `declare function openFile(path: string): Disposable & { read(): string }

export function openLog() {
  const file = openFile('app.log')
  return file
}
`,
    line: 4,
    fixed: `declare function openFile(path: string): Disposable & { read(): string }

export function openLog() {
  return openFile('app.log')
}
`,
  },
]
