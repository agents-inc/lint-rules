// Run by oxlint-merges-in-one-process.ts as a Node process of its own, never imported: both merges must be the
// one copy of the built package, as in a team's oxlint run, where a vitest worker would load two. Merges the
// project's oxlint part into the team's config as many times as asked, as oxlint.config.mts does on each load.
// Prints `{ "merged": [...] }`, or `{ "refused": "<message>" }` where a merge throws.
//
//   node oxlint-merges-process.ts <dist dir> <agents-inc.lint.mts path> <team oxlint config JSON> <ESLint config path> <merges>
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { OxlintConfig } from 'oxlint'
import type { OxlintPart } from '../core/editor-parts.ts'

const USAGE = 'usage: oxlint-merges-process.ts <dist dir> <agents-inc.lint.mts path> <team oxlint config JSON> <ESLint config path> <merges>'

const [distDir, lintRulesModule, teamConfigJson, eslintConfig, mergesText] = process.argv.slice(2)
if (distDir === undefined || lintRulesModule === undefined || teamConfigJson === undefined || eslintConfig === undefined || mergesText === undefined) {
  throw new Error(USAGE)
}

// Parse boundary: the built entry, which a dynamic import types as any.
const oxlintEntry = (await import(pathToFileURL(join(distDir, 'oxlint.mjs')).href)) as typeof import('../oxlint.ts')
// Parse boundary: the project's own module, which exports the part as a team's oxlint.config.mts imports it.
const { oxlint } = (await import(pathToFileURL(lintRulesModule).href)) as { readonly oxlint: OxlintPart | undefined }
// Parse boundary: the team config the test serialised.
const theirs = JSON.parse(teamConfigJson) as OxlintConfig
const merges = Number(mergesText)
if (!Number.isSafeInteger(merges) || merges < 1) throw new Error(`${USAGE}: <merges> is a whole number from 1, and was ${mergesText}`)

try {
  const merged = Array.from({ length: merges }, () => oxlintEntry.mergeOxlintConfig(theirs, oxlint, { eslintConfig }))
  process.stdout.write(JSON.stringify({ merged }))
} catch (error) {
  if (!(error instanceof Error)) throw new Error('a merge threw something that is no Error', { cause: error })
  process.stdout.write(JSON.stringify({ refused: error.message }))
}
