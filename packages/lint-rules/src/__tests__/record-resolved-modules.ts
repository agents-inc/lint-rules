// Run by dist-loading.test.ts as a Node process of its own, never imported. It records the URL of
// every module the process resolves and writes them to a file at exit: written to stdout at exit,
// the list was cut short (measured). Meanwhile it loads the built package the way a consumer does.
//
//   node record-resolved-modules.ts <record file> <dist dir> oxlint-side <lint rules JSON>
//   node record-resolved-modules.ts <record file> <dist dir> eslint-entry
import { writeFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

type Step = 'oxlint-side' | 'eslint-entry'

const STEPS: readonly Step[] = ['oxlint-side', 'eslint-entry']

const [recordFile, distDir, stepArgument, lintRulesJson] = process.argv.slice(2)
if (recordFile === undefined || distDir === undefined) throw new Error('usage: <record file> <dist dir> <step> [lint rules JSON]')
const step = parseStep(stepArgument)

const resolvedUrls: string[] = []
registerHooks({
  resolve: (specifier, context, nextResolve) => {
    const resolved = nextResolve(specifier, context)
    resolvedUrls.push(resolved.url)
    return resolved
  },
})
process.on('exit', () => {
  writeFileSync(recordFile, JSON.stringify(resolvedUrls))
})

if (step === 'oxlint-side') await loadTheOxlintSide(distDir, lintRulesJson)
else await import(builtEntry(distDir, 'eslint.mjs'))

/**
 * What a team's oxlint config does: define the lint rules, read both parts, and merge the oxlint one
 * into `{}`, naming no ESLint config, so no module of ESLint's side is loaded to read one.
 */
async function loadTheOxlintSide(dist: string, lintRules: string | undefined): Promise<void> {
  if (lintRules === undefined) throw new Error('the oxlint side needs the lint rules, as JSON')
  const index: typeof import('../index.ts') = await import(builtEntry(dist, 'index.mjs'))
  // Parse boundary: the lint rules the test serialised.
  const { eslint, oxlint } = index.defineLintRules(JSON.parse(lintRules)).editorRulesets
  if (eslint === undefined) throw new Error('defineLintRules returned no ESLint part')
  const oxlintEntry: typeof import('../oxlint.ts') = await import(builtEntry(dist, 'oxlint.mjs'))
  oxlintEntry.mergeOxlintConfig({}, oxlint, { eslintConfig: null })
}

function builtEntry(dist: string, file: string): string {
  return pathToFileURL(join(dist, file)).href
}

function parseStep(argument: string | undefined): Step {
  const step = STEPS.find((candidate) => candidate === argument)
  if (step === undefined) throw new Error(`the step is one of ${STEPS.join(', ')}, not ${String(argument)}`)
  return step
}
