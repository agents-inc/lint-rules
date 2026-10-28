// Run by dist-loading.test.ts as a Node process of its own, never imported. Records the URL of every module it
// resolves to a file at exit (stdout cut the list short), while loading the built package as a consumer does.
//
//   node record-resolved-modules.ts <record file> <dist dir> oxlint-side <lint rules JSON>
//   node record-resolved-modules.ts <record file> <dist dir> eslint-entry
import { writeFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { builtEntry } from './built-entries.ts'

type Step = 'oxlint-side' | 'eslint-entry'

const STEPS: readonly Step[] = ['oxlint-side', 'eslint-entry']

const [recordFile, distDir, stepArgument, lintRulesJson] = process.argv.slice(2)
if (recordFile === undefined || distDir === undefined) throw new Error('usage: <record file> <dist dir> <step> [lint rules JSON]')
const step = parseStep(stepArgument)

const resolvedUrls: string[] = []
registerHooks({
  resolve(specifier, context, nextResolve) {
    const resolved = nextResolve(specifier, context)
    // eslint-disable-next-line functional/immutable-data -- Node hands each module it resolves to this hook one at a time, and dist-loading.test.ts reads the whole list as one JSON array written at exit: the list is gathered here
    resolvedUrls.push(resolved.url)
    return resolved
  },
})
process.on('exit', () => {
  writeFileSync(recordFile, JSON.stringify(resolvedUrls))
})

if (step === 'oxlint-side') await loadTheOxlintSide(distDir, lintRulesJson)
else await import(builtEntry(distDir, 'eslint.mjs'))

/** As a team's oxlint config does, naming no ESLint config, so no module of ESLint's side loads to read one. */
async function loadTheOxlintSide(dist: string, lintRules: string | undefined): Promise<void> {
  if (lintRules === undefined) throw new Error('the oxlint side needs the lint rules, as JSON')
  // Parse boundary: the built entries, which a dynamic import types as any, and the lint rules the test serialised.
  const index = (await import(builtEntry(dist, 'index.mjs'))) as typeof import('../index.ts')
  const { oxlint } = index.defineLintRules(JSON.parse(lintRules) as Parameters<typeof index.defineLintRules>[0]).editorRulesets
  const oxlintEntry = (await import(builtEntry(dist, 'oxlint.mjs'))) as typeof import('../oxlint.ts')
  oxlintEntry.mergeOxlintConfig({}, oxlint, { eslintConfig: null })
}

function parseStep(argument: string | undefined): Step {
  const named = STEPS.find((candidate) => candidate === argument)
  if (named === undefined) throw new Error(`the step is one of ${STEPS.join(', ')}, not ${String(argument)}`)
  return named
}
