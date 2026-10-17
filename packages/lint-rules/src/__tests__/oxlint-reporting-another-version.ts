import { mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { OXLINT_SCHEMA_FILE } from './factories/package-json-factories.ts'
import { INSTALLED_OXLINT } from './temp-projects.ts'

const INSTALLED_OXLINT_DIR = 'node_modules/oxlint'
const PACKAGE_JSON = 'package.json'

/**
* Links every entry of the real oxlint, so `import { defineConfig } from 'oxlint'` loads, rewriting only its
* package.json; the schema is the real one's unless given. The fake-install factories' entry exports nothing,
* so a config importing oxlint cannot load beside it.
*/
export function installOxlintReporting(projectDir: string, version: string, schemaText?: string): void {
  const installDir = join(projectDir, INSTALLED_OXLINT_DIR)
  mkdirSync(installDir, { recursive: true })
  const written = schemaText === undefined ? [PACKAGE_JSON] : [PACKAGE_JSON, OXLINT_SCHEMA_FILE]
  readdirSync(INSTALLED_OXLINT.dir)
    .filter((entry) => !written.includes(entry))
    .forEach((entry) => symlinkSync(join(INSTALLED_OXLINT.dir, entry), join(installDir, entry)))
  writeFileSync(join(installDir, PACKAGE_JSON), `${JSON.stringify({ ...installedOxlintManifest(), version }, null, 2)}\n`)
  if (schemaText !== undefined) writeFileSync(join(installDir, OXLINT_SCHEMA_FILE), schemaText)
}

function installedOxlintManifest(): Readonly<Record<string, unknown>> {
  // Parse boundary: the manifest of the oxlint this repo installs.
  return JSON.parse(readFileSync(join(INSTALLED_OXLINT.dir, PACKAGE_JSON), 'utf8')) as Readonly<Record<string, unknown>>
}
