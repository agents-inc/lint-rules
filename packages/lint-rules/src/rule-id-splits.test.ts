import { describe, expect, it } from 'vitest'
import { PARALLEL_LOAD_TIMEOUT_MS } from './__tests__/parallel-load.ts'
import { repoSourceFiles } from './__tests__/repo-programs.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { slashSplitsIn } from './__tests__/slash-splits.ts'

// A rule ID or an oxlint name is split only by rule-data's rule-id-parts.ts (pluginPrefixOf, ruleNameOf and
// the rest), so a new prefix shape is decided in one place. Every other split, indexOf or lastIndexOf at a
// slash is listed here with what it cuts; a new one fails until it calls rule-id-parts or is listed.
const RULE_ID_PARTS = 'packages/rule-data/src/rule-id-parts.ts'

const CUTS_AT_A_SLASH_OF_NO_RULE_ID = [
  { site: { file: 'packages/eslint-plugin-house/src/rules/hook-file-naming.ts', in: 'fileNameOf', method: 'lastIndexOf' }, cuts: 'a file path' },
  { site: { file: 'packages/lint-rules/src/__tests__/oxlint-config-oracle.ts', in: 'foldersHolding', method: 'split' }, cuts: 'a file path' },
  // cutWhereOxlintCuts and prefixOfKey cut rule keys by hand on purpose: independent checks of production's cut.
  { site: { file: 'packages/lint-rules/src/__tests__/oxlint-rule-keys.ts', in: 'cutWhereOxlintCuts', method: 'lastIndexOf' }, cuts: 'a rule key, as an independent check' },
  { site: { file: 'packages/lint-rules/src/__tests__/oxlint-rule-keys.ts', in: 'cutWhereOxlintCuts', method: 'indexOf' }, cuts: 'a rule key, as an independent check' },
  { site: { file: 'packages/lint-rules/src/__tests__/oxlint-rule-keys.ts', in: 'withThePackageNamingCut', method: 'indexOf' }, cuts: 'an npm package name' },
  { site: { file: 'packages/lint-rules/src/__tests__/oxlint-rules-the-team-sets.ts', in: 'packageNameCut', method: 'split' }, cuts: 'an npm package name' },
  { site: { file: 'packages/lint-rules/src/__tests__/oxlint-rules-the-team-sets.ts', in: 'prefixOfKey', method: 'lastIndexOf' }, cuts: 'a rule key, as an independent check' },
  { site: { file: 'packages/lint-rules/src/__tests__/oxlint-rules-the-team-sets.ts', in: 'prefixOfKey', method: 'indexOf' }, cuts: 'a rule key, as an independent check' },
  { site: { file: 'packages/lint-rules/src/core/globs-read-from-above.ts', in: 'globsReadFromTheRoot', method: 'split' }, cuts: 'a glob' },
  { site: { file: 'packages/lint-rules/src/core/ignores-read-by-each-engine.integration.test.ts', in: '(top level)', method: 'split' }, cuts: 'a file path' },
  { site: { file: 'packages/lint-rules/src/core/ignores-read-by-each-engine.integration.test.ts', in: '(top level)', method: 'split' }, cuts: 'a file path' },
  { site: { file: 'packages/lint-rules/src/core/ignores-read-by-each-engine.ts', in: 'segmentsOf', method: 'split' }, cuts: 'a file path' },
  { site: { file: 'packages/rule-data/src/__tests__/schema-options.ts', in: 'resolvedIn', method: 'split' }, cuts: "a JSON schema's $ref" },
]

describe("the repo's TypeScript, as its tsconfigs take it in", () => {
  const cutsAtASlash = setUpRunsBeforeTheSuite(
    () => repoSourceFiles().flatMap(({ path, sourceFile, checker }) => slashSplitsIn(sourceFile, checker).map((split) => ({ file: path, ...split }))),
    { timeoutMs: PARALLEL_LOAD_TIMEOUT_MS, whatFailed: "the repo's TypeScript could not be read" },
  )

  it('cuts a rule ID at a slash in rule-id-parts.ts, where pluginPrefixOf finds the slash', () => {
    expect(cutsAtASlash().filter(({ file }) => file === RULE_ID_PARTS)).toContainEqual({ file: RULE_ID_PARTS, in: 'pluginPrefixOf', method: 'indexOf' })
  })

  it('cuts nothing else at a slash but the paths, globs, package names and independent checks listed', () => {
    expect(cutsAtASlash().filter(({ file }) => file !== RULE_ID_PARTS)).toStrictEqual(CUTS_AT_A_SLASH_OF_NO_RULE_ID.map(({ site }) => site))
  })
})
