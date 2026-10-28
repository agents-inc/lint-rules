import { consumerConfigFiles } from '@workspace/rule-data/consumer-config-files'
import { configErrorIn } from './config-error.ts'
import { namedGroupOf } from './named-groups.ts'
import { PACKAGE_JSON, readPackageJsonFile, resolvedFrom, THIS_PACKAGE, versionOf } from './package-json-files.ts'

const ESLINT = 'eslint'
const ESLINT_MANIFEST = `${ESLINT}/${PACKAGE_JSON}`
// The merge was measured on ESLint 10 alone.
const LOWEST_ESLINT_MAJOR = 10
// A prerelease of 10 is 10 too.
const MAJOR_VERSION = /^(?<major>\d+)\./u

/** Resolved from `tsconfigRootDir`, as the oxlint merge reads oxlint. Where none resolves, ESLint is installed where we cannot read it, and the merge goes on. */
// eslint-disable-next-line functional/no-return-void -- a refusal: an ESLint older than 10 must stop the merge before it builds anything, so it throws, and where it finds none it has nothing to give back
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

/** Parse boundary: the version an installed manifest gives. */
function majorOf(version: string, manifestPath: string): number {
  const match = MAJOR_VERSION.exec(version)
  if (match === null) throw new Error(`${manifestPath}: version "${version}" does not start with digits and a dot, as every ESLint release's does`)
  return Number(namedGroupOf(match, 'major'))
}
