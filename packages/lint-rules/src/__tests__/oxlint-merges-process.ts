// Run by oxlint-merges-in-one-process.ts as a Node process of its own, never imported. A merge
// reads the team's ESLint config with require(), and where that file calls our ESLint merge, takes
// what that merge hands it: both merges must be the one copy of the built package the process
// loads, as in a team's oxlint run. In a vitest worker the merge a test imports is another copy than
// the one the config file imports. This process loads the built oxlint entry, takes the oxlint part
// the project's agents-inc.lint.mts exports, and merges it into the team's oxlint config given,
// naming the team's ESLint config given, as many times as asked, one after another, as oxlint.config.mts
// does each time it is loaded. Prints `{ "merged": [...] }`, each merged config in order, or
// `{ "refused": "<message>" }` where a merge throws.
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

const oxlintEntry: typeof import('../oxlint.ts') = await import(pathToFileURL(join(distDir, 'oxlint.mjs')).href)
// Parse boundary: the project's own module, which exports the part as a team's oxlint.config.mts imports it.
const { oxlint } = (await import(pathToFileURL(lintRulesModule).href)) as { readonly oxlint: OxlintPart | undefined }
// Parse boundary: the team config the test serialised.
const theirs = JSON.parse(teamConfigJson) as OxlintConfig
const merges = Number(mergesText)
if (!Number.isInteger(merges) || merges < 1) throw new Error(`${USAGE}: <merges> is a whole number from 1, and was ${mergesText}`)

try {
  const merged = Array.from({ length: merges }, () => oxlintEntry.mergeOxlintConfig(theirs, oxlint, { eslintConfig }))
  process.stdout.write(JSON.stringify({ merged }))
} catch (error) {
  if (!(error instanceof Error)) throw new Error('a merge threw something that is no Error', { cause: error })
  process.stdout.write(JSON.stringify({ refused: error.message }))
}
