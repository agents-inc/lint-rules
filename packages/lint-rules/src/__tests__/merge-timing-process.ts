// Run by outside-every-tsconfig.integration.test.ts as a Node process of its own, never imported, so a merge that
// never finishes can be stopped. Times mergeEslintConfig into an empty team config; prints `{ "mergeMs": … }`.
//
//   node merge-timing-process.ts <dist dir> <lint rules JSON>
import { builtEntry } from './built-entries.ts'

const [distDir, lintRulesJson] = process.argv.slice(2)
if (distDir === undefined || lintRulesJson === undefined) throw new Error('usage: merge-timing-process.ts <dist dir> <lint rules JSON>')

// Parse boundary: the built entries, which a dynamic import types as any, and the lint rules the test serialised.
const index = (await import(builtEntry(distDir, 'index.mjs'))) as typeof import('../index.ts')
const eslintEntry = (await import(builtEntry(distDir, 'eslint.mjs'))) as typeof import('../eslint.ts')
const { eslint } = index.defineLintRules(JSON.parse(lintRulesJson) as Parameters<typeof index.defineLintRules>[0]).editorRulesets
const start = performance.now()
// The project lists no oxlint, so it has no oxlint config to name.
eslintEntry.mergeEslintConfig([], eslint, { oxlintConfig: null })
process.stdout.write(JSON.stringify({ mergeMs: Math.round(performance.now() - start) }))
