import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { OxlintConfig } from 'oxlint'
import { isRecord } from '../core/is-record.ts'
import { setUpRunsBeforeTheSuite } from './consumer-cli-runs.ts'
import { CONSUMER_CONFIG_FILES } from './factories/consumer-project-factories.ts'
import { INSTALLED_OXLINT, type LinkedPackage, type ProjectFiles, THIS_PACKAGE } from './temp-projects.ts'

/** What the merges in one process gave: each merged config, in order, or the message of the first that threw. */
export type OxlintMergesOutcome = { readonly merged: readonly OxlintConfig[] } | { readonly refused: string }

/** The merges one process runs, one after another: each of our oxlint part into the team's oxlint config given, naming the team's ESLint config given. */
export type OxlintMerges = { readonly theirs: OxlintConfig; readonly eslintConfig: string; readonly times: number }

/** The project the merges ran in, and what they gave. */
export type OxlintMergesRun = { readonly projectDir: string; readonly outcome: OxlintMergesOutcome }

const MERGES_PROCESS = fileURLToPath(new URL('./oxlint-merges-process.ts', import.meta.url))
const DIST_DIR = fileURLToPath(new URL('../../dist', import.meta.url))

/**
 * Makes the project before the suite, with the built package, oxlint and each package the team's
 * configs import installed, and runs the merges given in a Node process of its own, which loads the
 * built package as a team's oxlint run does (oxlint-merges-process.ts), our part taken from the
 * project's agents-inc.lint.mts. Reads the build output, so build the package first. Call it at the
 * top of a describe block: it registers that scope's hooks.
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
  const { status, stdout, stderr } = spawnSync(process.execPath, [MERGES_PROCESS, DIST_DIR, lintRulesModule, JSON.stringify(theirs), eslintConfig, String(times)], {
    cwd: projectDir,
    encoding: 'utf8',
  })
  if (status !== 0) throw new Error(`the merges process failed in ${projectDir} (exit ${String(status)}): ${stderr}`)
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
