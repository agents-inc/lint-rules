import type { LintRules } from '../../index.ts'
import { checkConfigText } from './check-factories.ts'

export const LOADED = 'loaded\n'

/** check's config, adding LOADED to the file named, beside it, each time a run loads it. */
export function checkConfigTextRecordingEachLoad(agentRulesets: Partial<LintRules['agentRulesets']>, file: string): string {
  return `import { appendFileSync } from 'node:fs'
${checkConfigText(agentRulesets)}
appendFileSync(new URL(${JSON.stringify(`./${file}`)}, import.meta.url), ${JSON.stringify(LOADED)})
`
}
