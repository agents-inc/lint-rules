import { STUB_PACKAGES, type StubPackage } from '@workspace/rule-data/test-support/changed-settings-cases'
import { foundOr } from '@workspace/rule-data/collections'
import type { ProjectFiles } from '../temp-projects.ts'

// Packages a typed project imports that the repo does not install, as rule-data's typed cases declare them:
// shaped as the real packages are, which decides which allowForKnownSafeCalls entry reaches a call.

const NODE_MODULES = 'node_modules'

/** rule-data's stub of the package named. Throws where it has none. */
export function stubPackageNamed(name: string): StubPackage {
  return foundOr(
    STUB_PACKAGES.find((stub) => stub.name === name),
    `rule-data declares no stub of ${name}`,
  )
}

/** Each package's manifest and declarations under the project's node_modules, as a package manager installs it. */
export function stubPackageFiles(packages: readonly StubPackage[]): ProjectFiles {
  return Object.fromEntries(
    packages.flatMap(({ name, declarations }) => [
      [`${NODE_MODULES}/${name}/package.json`, `${JSON.stringify({ name, version: '0.0.0', types: 'index.d.ts' })}\n`],
      [`${NODE_MODULES}/${name}/index.d.ts`, declarations],
    ]),
  )
}
