import type { EngineBuild, TeamConfigs } from '../engine-run.ts'

/** The editor parts merged into a team's configs: empty ones unless given. */
export function buildEditorBuild(teamConfigs: Partial<TeamConfigs> = {}): EngineBuild {
  return { kind: 'editor', teamEslintConfig: [], teamOxlintConfig: {}, ...teamConfigs }
}
