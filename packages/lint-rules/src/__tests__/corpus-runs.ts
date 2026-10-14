import { type BothEnginesRuns, setUpBothEnginesRuns } from './both-engines-runs.ts'
import {
  type CorpusCase,
  corpusSourcesOf,
  TEAM_CORPUS_ESLINT_RULES,
  TEAM_CORPUS_JS_AND_TS_EXTENSIONS,
  TEAM_CORPUS_OXLINT_CONFIG,
} from './cases/both-engines-corpus.ts'

/**
 * Both engines' runs over a corpus project, made before the suite: its files, our settings, and the
 * team's two configs of the corpus, its oxlint config the case's where it gives one. Call it at the
 * top of a describe block: it registers that scope's hooks.
 */
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
