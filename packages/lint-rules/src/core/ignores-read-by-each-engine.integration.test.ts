import { catalog } from '@workspace/rule-data'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  ESLINT_READING_FILES,
  ESLINT_READING_LIMITS,
  FILES_ESLINT_DEFAULTS_LEAVE_OUT,
  IGNORES_READ_AS_ESLINT_READS_THEM,
  IGNORES_TAKING_FILES_BACK_FROM_ESLINT_DEFAULTS,
} from '../__tests__/cases/eslint-ignores-values.ts'
import { IGNORES_READ_AS_OXLINT_READS_THEM, OXLINT_READING_FILES, OXLINT_READING_LIMITS } from '../__tests__/cases/oxlint-ignores-values.ts'
import { filesEslintLintsUnderGlobalIgnores } from '../__tests__/eslint-global-ignores.ts'
import { buildLintRules } from '../__tests__/factories/lint-rules-factories.ts'
import { filesTheConditionMatches } from '../__tests__/files-condition-oracle.ts'
import { filesOxlintLintsUnderIgnorePatterns, projectFilesOxlintReportsIn } from '../__tests__/oxlint-ignore-patterns.ts'
import { allowEveryTestForParallelLoad } from '../__tests__/parallel-load.ts'
import { setUpTempProjects } from '../__tests__/temp-projects.ts'
import { oxlintIgnorePatternsOf } from './build-oxlint-config.ts'
import { eslintGlobalIgnoresOf } from './eslint-file-types.ts'
import { type RuleLayers, resolveRuleLayers } from './resolve-rule-layers.ts'
import { ourEslintPartOf, ourOxlintPartOf } from './where-our-parts-run.ts'

// Our ignore readings checked against the real engines (ESLint 10.12, oxlint 1.87): a file read wrongly is
// one where the team's copy of a rule is turned off with nobody running ours, or left on beside ours.

allowEveryTestForParallelLoad()

type FilesLeftOut = { readonly byTheReading: readonly string[]; readonly byTheEngine: readonly string[] }

const ESLINT_FILE_TEXT = 'export const a = 1\n'
const NO_IGNORES: readonly string[] = []
const EVERY_ESLINT_LIST = [...IGNORES_READ_AS_ESLINT_READS_THEM, ...IGNORES_TAKING_FILES_BACK_FROM_ESLINT_DEFAULTS, ...ESLINT_READING_LIMITS.map(({ ignores }) => ignores)]
const EVERY_OXLINT_LIST = [...IGNORES_READ_AS_OXLINT_READS_THEM, ...OXLINT_READING_LIMITS.map(({ ignores }) => ignores)]

const tempProjects = setUpTempProjects()
// Every reading is made before the tests, so one that throws fails the file instead of passing an it.fails.
const eslintLeftOutByList = new Map<string, FilesLeftOut>()
const oxlintLeftOutByList = new Map<string, FilesLeftOut>()

function layersIgnoring(ignores: readonly string[]): RuleLayers {
  return resolveRuleLayers(buildLintRules({}, { ignores: [...ignores] }), catalog)
}

beforeAll(async () => {
  const eslintProjectDir = tempProjects.create({ files: Object.fromEntries(ESLINT_READING_FILES.map((file) => [file, ESLINT_FILE_TEXT])) })
  const leftOutByEslintDefaults = await filesEslintLeavesOutGiven(eslintProjectDir, NO_IGNORES)
  for (const ignores of EVERY_ESLINT_LIST) {
    const layers = layersIgnoring(ignores)
    const leftOutByEslint = await filesEslintLeavesOutGiven(eslintProjectDir, eslintGlobalIgnoresOf(layers))
    eslintLeftOutByList.set(JSON.stringify(ignores), {
      byTheReading: filesTheConditionMatches(ourEslintPartOf(layers).leftOut, ESLINT_READING_FILES).toSorted(),
      byTheEngine: [...new Set([...leftOutByEslint, ...leftOutByEslintDefaults])].toSorted(),
    })
  }
  const oxlintProjectDir = tempProjects.create({ files: projectFilesOxlintReportsIn(OXLINT_READING_FILES) })
  for (const ignores of EVERY_OXLINT_LIST) {
    const layers = layersIgnoring(ignores)
    const linted = filesOxlintLintsUnderIgnorePatterns(oxlintProjectDir, oxlintIgnorePatternsOf(layers), OXLINT_READING_FILES)
    oxlintLeftOutByList.set(JSON.stringify(ignores), {
      byTheReading: filesTheConditionMatches(ourOxlintPartOf(layers, catalog).leftOut, OXLINT_READING_FILES).toSorted(),
      byTheEngine: OXLINT_READING_FILES.filter((file) => !linted.includes(file)).toSorted(),
    })
  }
})

/** As `eslint .` does, under one block of the list given as global ignores. */
async function filesEslintLeavesOutGiven(projectDir: string, ignores: readonly string[]): Promise<string[]> {
  const linted = await filesEslintLintsUnderGlobalIgnores(projectDir, ignores)
  return ESLINT_READING_FILES.filter((file) => !linted.includes(file))
}

function leftOutGiven(byList: ReadonlyMap<string, FilesLeftOut>, ignores: readonly string[]): FilesLeftOut {
  const leftOut = byList.get(JSON.stringify(ignores))
  if (leftOut === undefined) throw new Error(`no reading was made of ${JSON.stringify(ignores)}`)
  return leftOut
}

describe("the ESLint reading of our ignores, against the files the real ESLint leaves out in the editor under the same ignores", () => {
  // Lists with and without left-out files, so the comparison is seen to tell them apart.
  it('is checked over files ESLint leaves out and files it lints', () => {
    expect({
      legacyFolder: leftOutGiven(eslintLeftOutByList, ['legacy/']).byTheEngine,
      vueFiles: leftOutGiven(eslintLeftOutByList, ['**/*.vue']).byTheEngine,
      noIgnores: leftOutGiven(eslintLeftOutByList, NO_IGNORES).byTheEngine,
    }).toStrictEqual({
      legacyFolder: [...new Set([...ESLINT_READING_FILES.filter((file) => file.split('/').includes('legacy')), ...FILES_ESLINT_DEFAULTS_LEAVE_OUT])].toSorted(),
      vueFiles: [...FILES_ESLINT_DEFAULTS_LEAVE_OUT].toSorted(),
      noIgnores: [...FILES_ESLINT_DEFAULTS_LEAVE_OUT].toSorted(),
    })
  })

  // Each list's name in full in its title, which describe.each's $-interpolation would cut short.
  IGNORES_READ_AS_ESLINT_READS_THEM.forEach((ignores) => {
    it(`leaves out exactly the files ESLint leaves out, given ${JSON.stringify(ignores)}`, () => {
      const { byTheReading, byTheEngine } = leftOutGiven(eslintLeftOutByList, ignores)

      expect(byTheReading).toStrictEqual(byTheEngine)
    })
  })

  // In the editor our negated lines take back nothing ESLint's default ignores leave out (a known limit).
  IGNORES_TAKING_FILES_BACK_FROM_ESLINT_DEFAULTS.forEach((ignores) => {
    it(`leaves out exactly the files ESLint leaves out, its default ignores holding whatever our negated lines say, given ${JSON.stringify(ignores)}`, () => {
      const { byTheReading, byTheEngine } = leftOutGiven(eslintLeftOutByList, ignores)

      expect(byTheReading).toStrictEqual(byTheEngine)
    })
  })

  ESLINT_READING_LIMITS.forEach(({ ignores, takenInByTheReadingOnly }) => {
    describe(`given ${JSON.stringify(ignores)}`, () => {
      // KNOWN GAP: ESLint decides a file by the highest left-out folder above it, which the globs cannot always tell
      // from a deeper one (no-var in legacy/keep/legacy/a.js under **/legacy/** and !**/keep/**). The editor
      // merge then runs our ESLint rules where the agent build leaves them out.
      it.fails('leaves out exactly the files ESLint leaves out', () => {
        const { byTheReading, byTheEngine } = leftOutGiven(eslintLeftOutByList, ignores)

        expect(byTheReading).toStrictEqual(byTheEngine)
      })

      it('takes in only the files of the limit that ESLint leaves out, and leaves out none ESLint lints', () => {
        const { byTheReading, byTheEngine } = leftOutGiven(eslintLeftOutByList, ignores)

        expect({
          takenInByTheReadingOnly: byTheEngine.filter((file) => !byTheReading.includes(file)),
          leftOutByTheReadingOnly: byTheReading.filter((file) => !byTheEngine.includes(file)),
        }).toStrictEqual({ takenInByTheReadingOnly: [...takenInByTheReadingOnly].toSorted(), leftOutByTheReadingOnly: [] })
      })
    })
  })
})

describe('the oxlint reading of our ignores, against the files the real oxlint leaves out under the ignore patterns the agent build gives it', () => {
  // Lists with and without left-out files, so the comparison is seen to tell them apart.
  it('is checked over files oxlint leaves out and files it lints', () => {
    const inNodeModules = OXLINT_READING_FILES.filter((file) => file.includes('node_modules/'))

    expect({
      legacyFolder: leftOutGiven(oxlintLeftOutByList, ['legacy/']).byTheEngine,
      noIgnores: leftOutGiven(oxlintLeftOutByList, NO_IGNORES).byTheEngine,
    }).toStrictEqual({
      legacyFolder: [...new Set([...OXLINT_READING_FILES.filter((file) => file.split('/').includes('legacy')), ...inNodeModules])].toSorted(),
      noIgnores: [...inNodeModules].toSorted(),
    })
  })

  IGNORES_READ_AS_OXLINT_READS_THEM.forEach((ignores) => {
    it(`leaves out exactly the files oxlint leaves out, given ${JSON.stringify(ignores)}`, () => {
      const { byTheReading, byTheEngine } = leftOutGiven(oxlintLeftOutByList, ignores)

      expect(byTheReading).toStrictEqual(byTheEngine)
    })
  })

  OXLINT_READING_LIMITS.forEach(({ ignores, takenBackByTheReadingOnly }) => {
    describe(`given ${JSON.stringify(ignores)}`, () => {
      // KNOWN GAP: where a negated line takes back a folder, oxlint decides a file by a deeper left-out folder,
      // which the globs cannot tell, so the editor merge runs our oxlint rules there and the agent build does not.
      it.fails('leaves out exactly the files oxlint leaves out', () => {
        const { byTheReading, byTheEngine } = leftOutGiven(oxlintLeftOutByList, ignores)

        expect(byTheReading).toStrictEqual(byTheEngine)
      })

      it('takes back only the files of the limit that oxlint leaves out, and leaves out none oxlint lints', () => {
        const { byTheReading, byTheEngine } = leftOutGiven(oxlintLeftOutByList, ignores)

        expect({
          takenBackByTheReadingOnly: byTheEngine.filter((file) => !byTheReading.includes(file)),
          leftOutByTheReadingOnly: byTheReading.filter((file) => !byTheEngine.includes(file)),
        }).toStrictEqual({ takenBackByTheReadingOnly: [...takenBackByTheReadingOnly].toSorted(), leftOutByTheReadingOnly: [] })
      })
    })
  })
})
