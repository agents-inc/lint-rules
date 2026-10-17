import { type BothEnginesRuns, setUpBothEnginesRuns } from './both-engines-runs.ts'
import {
  type CorpusCase,
  corpusSourcesOf,
  TEAM_CORPUS_ESLINT_RULES,
  TEAM_CORPUS_JS_AND_TS_EXTENSIONS,
  TEAM_CORPUS_OXLINT_CONFIG,
} from './cases/both-engines-corpus.ts'

/** The team's oxlint config is the case's where it gives one. Registers hooks: call it in a describe block. */
export function setUpCorpusRuns({ ourRulesets, ours, files, teamOxlintConfig = TEAM_CORPUS_OXLINT_CONFIG }: CorpusCase): () => BothEnginesRuns {
  return setUpBothEnginesRuns({
    sources: corpusSourcesOf(files),
    ourRulesets,
    ours,
    teamEslintRules: TEAM_CORPUS_ESLINT_RULES,
    teamJsAndTsExtensions: TEAM_CORPUS_JS_AND_TS_EXTENSIONS,
    teamOxlintConfig,
  })
}
