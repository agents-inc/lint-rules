import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Linter } from 'eslint'

/**
 * The `teamConfig` a JS module in the project exports, as a team's eslint.config.mjs hands its
 * config over: untyped, so it may hold what ESLint's types leave out, a function in `files`. Each
 * block is a plain object; nothing further is checked.
 */
export async function importedTeamConfig(projectDir: string, file: string): Promise<Linter.Config[]> {
  // Parse boundary: a JS module, typed as any by import().
  const module: unknown = await import(pathToFileURL(join(projectDir, file)).href)
  if (!isRecord(module) || !Array.isArray(module['teamConfig'])) throw new Error(`${file} exports no teamConfig array`)
  const blocks: unknown[] = module['teamConfig']
  return blocks.map((block, index) => {
    if (!isConfigBlock(block)) throw new Error(`block ${String(index)} of ${file}'s teamConfig is not an object`)
    return block
  })
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null
}

function isConfigBlock(value: unknown): value is Linter.Config {
  return isRecord(value) && !Array.isArray(value)
}
