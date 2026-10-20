import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { OxlintConfig } from 'oxlint'
import { isRecord } from '../core/is-record.ts'
import { CONSUMER_CONFIG_FILES } from './factories/consumer-project-factories.ts'
import { runNodeScript } from './node-process.ts'
import { setUpRunsBeforeTheSuite } from './runs-before-the-suite.ts'
import { BUILT_DIST_DIR, INSTALLED_OXLINT, type LinkedPackage, type ProjectFiles, THIS_PACKAGE } from './temp-projects.ts'

type OxlintMergesOutcome = { readonly merged: readonly OxlintConfig[] } | { readonly refused: string }

/** Each merges our oxlint part into `theirs`, naming `eslintConfig`. */
export type OxlintMerges = { readonly theirs: OxlintConfig; readonly eslintConfig: string; readonly times: number }

export type OxlintMergesRun = { readonly projectDir: string; readonly outcome: OxlintMergesOutcome }

const MERGES_PROCESS = fileURLToPath(new URL('./oxlint-merges-process.ts', import.meta.url))

/**
* Runs the merges in a process of its own, loading the built package as a team's oxlint run does: build it
* first. Registers hooks: call it in a describe block.
*/
export function setUpOxlintMergesInOneProcess(
  files: ProjectFiles,
  merges: OxlintMerges,
  packagesTheTeamImports: readonly LinkedPackage[] = [],
): () => OxlintMergesRun {
  return setUpRunsBeforeTheSuite((tempProjects) => {
    const projectDir = tempProjects.create({ files, linkedPackages: [THIS_PACKAGE, INSTALLED_OXLINT, ...packagesTheTeamImports] })
    return { projectDir, outcome: oxlintMergesIn(projectDir, merges) }
  })
}

/** Each merged config, in order: throws where a merge was refused. */
export function mergedConfigsOf({ projectDir, outcome }: OxlintMergesRun): readonly OxlintConfig[] {
  if ('refused' in outcome) throw new Error(`a merge in ${projectDir} was refused: ${outcome.refused}`)
  return outcome.merged
}

function oxlintMergesIn(projectDir: string, { theirs, eslintConfig, times }: OxlintMerges): OxlintMergesOutcome {
  const lintRulesModule = join(projectDir, CONSUMER_CONFIG_FILES.lintRules)
  const stdout = runNodeScript(MERGES_PROCESS, [BUILT_DIST_DIR, lintRulesModule, JSON.stringify(theirs), eslintConfig, String(times)], {
    cwd: projectDir,
    whatFailed: `the merges process failed in ${projectDir}`,
  })
  return outcomePrinted(JSON.parse(stdout))
}

/** Parse boundary: what the merges process printed, `{ merged }` or `{ refused }`. */
function outcomePrinted(printed: unknown): OxlintMergesOutcome {
  if (!isRecord(printed)) throw new Error(`the merges process printed ${JSON.stringify(printed)}, no object`)
  const { merged, refused } = printed
  if (typeof refused === 'string') return { refused }
  if (Array.isArray(merged) && merged.every(isRecord)) return { merged: merged as OxlintConfig[] }
  throw new Error(`the merges process printed neither merged configs nor a refusal: ${JSON.stringify(printed)}`)
}
