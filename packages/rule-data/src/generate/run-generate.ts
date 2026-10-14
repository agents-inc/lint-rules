import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { rulesetDefinitions } from '../ruleset-definitions.ts'
import { buildInventory } from './build-inventory.ts'
import { buildRouting } from './build-routing.ts'
import { canonicalRules } from './canonical-rules.ts'
import { readInstalledEngines } from './read-installed.ts'
import { renderJson, renderRuleIdsFile, renderRulesetNames } from './render-generated.ts'

/** A file under the package root, as the generator would write it. */
export type GeneratedFile = { path: string; contents: string }

const PACKAGE_ROOT = new URL('../../', import.meta.url)

/** Every generated file, built in memory from the installed engines and `data/`. Writes nothing. */
export async function generateFiles(): Promise<readonly GeneratedFile[]> {
  const inventory = buildInventory(await readInstalledEngines())
  const routes = buildRouting({ inventory, canonicalRules })
  return [
    { path: 'src/generated/inventory.json', contents: renderJson(inventory) },
    { path: 'src/generated/routing.json', contents: renderJson(routes) },
    { path: 'src/generated/rule-ids.ts', contents: renderRuleIdsFile(routes) },
    { path: 'src/generated/ruleset-names.ts', contents: renderRulesetNames(rulesetDefinitions) },
  ]
}

async function writeGeneratedFiles(): Promise<void> {
  const files = await generateFiles()
  await Promise.all(files.map(writeGeneratedFile))
}

async function writeGeneratedFile({ path, contents }: GeneratedFile): Promise<void> {
  const target = fileURLToPath(new URL(path, PACKAGE_ROOT))
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, contents)
}

function isRunAsScript(): boolean {
  const entryScript = process.argv[1]
  return entryScript !== undefined && pathToFileURL(entryScript).href === import.meta.url
}

// Writes only when run as the script; importing this module (the staleness test does) writes nothing.
if (isRunAsScript()) await writeGeneratedFiles()
