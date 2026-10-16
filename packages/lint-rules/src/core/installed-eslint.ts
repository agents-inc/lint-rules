import { consumerConfigFiles } from '@workspace/rule-data/consumer-config-files'
import { configErrorIn } from './config-error.ts'
import { PACKAGE_JSON, readPackageJsonFile, resolvedFrom, THIS_PACKAGE, versionOf } from './package-json-files.ts'

const ESLINT = 'eslint'
const ESLINT_MANIFEST = `${ESLINT}/${PACKAGE_JSON}`
// The merge was measured on ESLint 10 alone (q-r7).
const LOWEST_ESLINT_MAJOR = 10
// Every ESLint release's version starts with its major and a dot; a prerelease of 10 is 10 too.
const MAJOR_VERSION = /^(?<major>\d+)\./u

/**
 * The ESLint merge refuses an ESLint below 10 installed for the project, read as the oxlint merge
 * reads the project's oxlint: the one `eslint/package.json` resolves to from `tsconfigRootDir`.
 * Where none resolves, the ESLint running the config is installed elsewhere, where we cannot read
 * it, and the merge goes on (spec-core.md call 9).
 */
export function refuseUnsupportedInstalledEslint(tsconfigRootDir: string): void {
  const manifestPath = resolvedFrom(tsconfigRootDir, ESLINT_MANIFEST)
  if (manifestPath === null) return
  const version = versionOf(readPackageJsonFile(manifestPath))
  if (majorOf(version, manifestPath) >= LOWEST_ESLINT_MAJOR) return
  throw configErrorIn(
    consumerConfigFiles.eslintConfig,
    `the ESLint installed for ${tsconfigRootDir} is ${version}; ${THIS_PACKAGE} needs ESLint ${String(LOWEST_ESLINT_MAJOR)} or later: install ${ESLINT} ${String(LOWEST_ESLINT_MAJOR)}`,
  )
}

/** Parse boundary: the major of the version an installed manifest gives. */
function majorOf(version: string, manifestPath: string): number {
  const major = MAJOR_VERSION.exec(version)?.groups?.['major']
  if (major === undefined) throw new Error(`${manifestPath}: version "${version}" does not start with digits and a dot, as every ESLint release's does`)
  return Number(major)
}
