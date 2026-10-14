// Run by outside-every-tsconfig.integration.test.ts as a Node process of its own, never imported, so
// a merge that never finishes can be stopped. It loads the built package the way a team's
// eslint.config.mjs does, defines the lint rules given, and times mergeEslintConfig merging their
// ESLint part into an empty team config. Prints `{ "mergeMs": … }` as JSON.
//
//   node merge-timing-process.ts <dist dir> <lint rules JSON>
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const [distDir, lintRulesJson] = process.argv.slice(2)
if (distDir === undefined || lintRulesJson === undefined) throw new Error('usage: merge-timing-process.ts <dist dir> <lint rules JSON>')

const index: typeof import('../index.ts') = await import(builtEntry(distDir, 'index.mjs'))
const eslintEntry: typeof import('../eslint.ts') = await import(builtEntry(distDir, 'eslint.mjs'))
// Parse boundary: the lint rules the test serialised.
const { eslint } = index.defineLintRules(JSON.parse(lintRulesJson)).editorRulesets
const start = performance.now()
// The project lists no oxlint, so it has no oxlint config to name.
eslintEntry.mergeEslintConfig([], eslint, { oxlintConfig: null })
process.stdout.write(JSON.stringify({ mergeMs: Math.round(performance.now() - start) }))

function builtEntry(dist: string, file: string): string {
  return pathToFileURL(join(dist, file)).href
}
