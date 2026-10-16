import { catalog } from '@workspace/rule-data'
import { describe, expect, it } from 'vitest'
import { IGNORED_FILES, IGNORES_AS_GITIGNORE_LINES, type IgnoresRow, MORE_IGNORES_AS_GITIGNORE_LINES } from '../__tests__/cases/ignores-as-gitignore-lines.ts'
import { buildFileOverride, buildLintRules } from '../__tests__/factories/lint-rules-factories.ts'
import { filesTheConditionMatches } from '../__tests__/files-condition-oracle.ts'
import { type RuleLayers, resolveRuleLayers } from './resolve-rule-layers.ts'
import { ourEslintPartOf, ourOxlintPartOf } from './where-our-parts-run.ts'

// q62 (owner): a value of our ignores means what it would mean as a .gitignore line, in both engines.
// Our layers hold each value in forms the agent build gives both engines, and both merges read
// through the shared readings of each engine (ignores-read-by-each-engine.ts, checked against the
// real engines in its integration test). So each engine's reading of the layers leaves out the files
// the .gitignore line does. The forms themselves are the developer's: only the files are pinned
// here, beside the values whose forms the answer leaves as they are.

const LEGACY_FOLDER_AT_THE_ROOT_ONLY = 'src/legacy/'
const EVERY_FILE_UNDER_THE_ROOT_LEGACY_FOLDER = 'legacy/**'
const EVERY_LEGACY_FOLDER = '**/legacy/'
const LEGACY_FOLDERS_BY_A_TRAILING_SLASH = 'legacy/'
const EVERY_ROW: readonly IgnoresRow[] = [...IGNORES_AS_GITIGNORE_LINES, ...MORE_IGNORES_AS_GITIGNORE_LINES]

function layersIgnoring(ignores: readonly string[]): RuleLayers {
  return resolveRuleLayers(buildLintRules({}, { ignores: [...ignores] }), catalog)
}

/** The files each engine's reading of our layers leaves out, of those checked, in the order checked. */
function filesEachEngineLeavesOut(ignores: readonly string[]): { readonly eslint: readonly string[]; readonly oxlint: readonly string[] } {
  const layers = layersIgnoring(ignores)
  return {
    eslint: filesTheConditionMatches(ourEslintPartOf(layers).leftOutByOurIgnores, IGNORED_FILES),
    oxlint: filesTheConditionMatches(ourOxlintPartOf(layers, catalog).leftOut, IGNORED_FILES),
  }
}

describe('our ignores, as each engine reads the forms our layers hold them in', () => {
  // Each list's values in full in its title, which it.each's $-interpolation would cut short.
  EVERY_ROW.forEach(({ ignores, leftOut }) => {
    it(`leave out in each engine the files a .gitignore holding ${JSON.stringify(ignores)} leaves out`, () => {
      expect(filesEachEngineLeavesOut(ignores)).toStrictEqual({ eslint: leftOut, oxlint: leftOut })
    })
  })
})

describe('the values the answer leaves as they are', () => {
  it.each([LEGACY_FOLDER_AT_THE_ROOT_ONLY, EVERY_FILE_UNDER_THE_ROOT_LEGACY_FOLDER, EVERY_LEGACY_FOLDER])(
    'hold %s in our layers as it is written',
    (ignore) => {
      expect(layersIgnoring([ignore]).ignores).toStrictEqual([ignore])
    },
  )

  it("hold an entry's files, legacy/ among them, as they are written, while the same value among our ignores names every legacy folder", () => {
    const layers = resolveRuleLayers(
      buildLintRules({}, { ignores: [LEGACY_FOLDERS_BY_A_TRAILING_SLASH], fileOverrides: [buildFileOverride([LEGACY_FOLDERS_BY_A_TRAILING_SLASH], { rules: { 'no-debugger': 'off' } })] }),
      catalog,
    )

    expect({
      entryFiles: layers.fileOverrides.map((layer) => layer.files),
      leftOutByOurIgnores: filesTheConditionMatches(ourEslintPartOf(layers).leftOutByOurIgnores, IGNORED_FILES),
    }).toStrictEqual({ entryFiles: [[LEGACY_FOLDERS_BY_A_TRAILING_SLASH]], leftOutByOurIgnores: ['legacy/a.js', 'src/legacy/a.js', 'legacy/keep/a.js'] })
  })
})
