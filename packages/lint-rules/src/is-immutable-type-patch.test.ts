import { catalog, routeOf } from '@workspace/rule-data'
import { foundOr } from '@workspace/rule-data/collections'
import { eslintPlugins } from '@workspace/rule-data/eslint-plugins'
import { ESLint, type Linter } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, expect, it, vi } from 'vitest'
import { BOTH_SHELVES_IN_ONE_FILE } from './__tests__/cases/generic-interface-parameter-sources.ts'
import {
  A_MUTABLE_PICK,
  A_READONLY_PICK,
  A_READONLY_REQUIRED,
  B_MUTABLE_PICK,
  B_MUTABLE_REQUIRED,
  B_READONLY_PICK,
  BOTH_PICKS_IN_ONE_FILE,
  NODE_ENV_OUTSIDE_TESTS,
  PARAMETERS_HELD_TO_IMMUTABLE,
  type ParameterSource,
  parameterImmutabilityMessage,
  RECURSIVE_TURTLES,
} from './__tests__/cases/pick-parameter-sources.ts'
import {
  A_PICK_HELD_INSIDE_A_PICK,
  A_READ_ONLY_RECORD_MET_BESIDE_AN_OVERWRITABLE_OBJECT,
  A_TYPE_HOLDING_A_PICK_HELD_INSIDE_A_PICK,
  A_TYPE_MET_BESIDE_A_PICK_HELD_INSIDE_A_PICK,
  A_TYPE_MET_WHILE_ITS_HOLDER_IS_HALF_WORKED_OUT,
  A_TYPE_REFERRING_ONLY_TO_ITSELF_BESIDE_AN_OVERWRITABLE_OBJECT,
} from './__tests__/cases/work-in-progress-parameter-sources.ts'
import { describeFinding, eslintEngineFindingsIn, fatalMessagesIn } from './__tests__/engine-clis.ts'
import { moduleText } from './__tests__/factories/check-factories.ts'
import { buildTeamEslintBlock } from './__tests__/factories/team-config-factories.ts'
import { buildTsconfig } from './__tests__/factories/tsconfig-factories.ts'
import { type RunsBeforeTheSuiteOptions, setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import type { TempProjects } from './__tests__/temp-projects.ts'

// This repo installs is-immutable-type (5.0.4) patched (root package.json's patchedDependencies), so its process-wide
// cache keeps one instantiation of a generic from answering for another (its issue #625). Teams install the original,
// which the registry's per-call cache guards; here functional's plugin runs as npm gives it, so only the patch can.

const FUNCTIONAL = 'functional'
const RULE_ID = `${FUNCTIONAL}/prefer-immutable-types`
const READ_ONLY_SHALLOW = 'ReadonlyShallow'
const IMMUTABLE = 'Immutable'
const MUTABLE = 'Mutable'
// eslint-plugin-functional (10.0.1) hands is-immutable-type a cache of the call's own where NODE_ENV is "test".
const NODE_ENV_TURNING_THE_CACHE_OFF = { NODE_ENV: 'test' } as const
const TYPED_RUNS: RunsBeforeTheSuiteOptions = { timeoutMs: 300_000, whatFailed: 'the typed lint runs could not be made before the suite' }

type NodeEnv = { readonly NODE_ENV: string }

type Reported = { readonly at: string; readonly message: string }

type Linted = { readonly fatal: readonly string[]; readonly reported: readonly Reported[] }

type CacheOffAndOn = { readonly cacheOff: Linted; readonly cacheOn: Linted }

function shippedOptions(): readonly unknown[] {
  const { shipped } = routeOf(RULE_ID, catalog)
  if (shipped === null) throw new Error(`${RULE_ID} is not shipped`)
  return shipped.options
}

function typedProjectOf(tempProjects: TempProjects, sources: readonly ParameterSource[]): string {
  return tempProjects.create({
    files: {
      'tsconfig.json': JSON.stringify(buildTsconfig({ include: ['src'] })),
      ...Object.fromEntries(sources.map(({ file, lines }) => [file, moduleText(...lines)])),
    },
  })
}

function typedBlockOf(projectDir: string, options: readonly unknown[]): Linter.Config {
  return buildTeamEslintBlock('prefer-immutable-types as npm gives it, typed', {
    files: ['**/*.ts'],
    languageOptions: { parser: tseslint.parser, parserOptions: { projectService: true, tsconfigRootDir: projectDir } },
    plugins: { [FUNCTIONAL]: foundOr(eslintPlugins[FUNCTIONAL], 'rule-data registers no functional plugin') },
    rules: { [RULE_ID]: ['error', ...options] },
  })
}

async function lintedUnder(nodeEnv: NodeEnv, projectDir: string, options: readonly unknown[]): Promise<Linted> {
  vi.stubEnv('NODE_ENV', nodeEnv.NODE_ENV)
  try {
    const results = await new ESLint({ cwd: projectDir, overrideConfigFile: true, overrideConfig: typedBlockOf(projectDir, options) }).lintFiles(['.'])
    return {
      fatal: fatalMessagesIn(results, projectDir),
      reported: eslintEngineFindingsIn(results, projectDir).map((finding) => ({ at: describeFinding(finding), message: finding.message })),
    }
  } finally {
    vi.unstubAllEnvs()
  }
}

async function lintedWithTheCacheOffAndOn(tempProjects: TempProjects, sources: readonly ParameterSource[], options: readonly unknown[]): Promise<CacheOffAndOn> {
  return {
    cacheOff: await lintedUnder(NODE_ENV_TURNING_THE_CACHE_OFF, typedProjectOf(tempProjects, sources), options),
    cacheOn: await lintedUnder(NODE_ENV_OUTSIDE_TESTS, typedProjectOf(tempProjects, sources), options),
  }
}

function reportedAlone(at: string, least: string, actual: string): Linted {
  return reportedAtEach([at], least, actual)
}

function reportedAtEach(ats: readonly string[], least: string, actual: string): Linted {
  return { fatal: [], reported: ats.map((at) => ({ at: `${at} ${RULE_ID}`, message: parameterImmutabilityMessage(least, actual) })) }
}

describe("prefer-immutable-types as npm gives the plugin, over this repo's is-immutable-type, at the shipped options, files linted one after another in one process", () => {
  const runs = setUpRunsBeforeTheSuite(async (tempProjects) => {
    const options = shippedOptions()
    return {
      mutablePickAlone: await lintedWithTheCacheOffAndOn(tempProjects, [B_MUTABLE_PICK], options),
      turtles: await lintedWithTheCacheOffAndOn(tempProjects, [RECURSIVE_TURTLES], options),
      bothInOneFile: await lintedWithTheCacheOffAndOn(tempProjects, [BOTH_PICKS_IN_ONE_FILE], options),
      readOnlyPickFirst: await lintedWithTheCacheOffAndOn(tempProjects, [A_READONLY_PICK, B_MUTABLE_PICK], options),
      overwritablePickFirst: await lintedWithTheCacheOffAndOn(tempProjects, [A_MUTABLE_PICK, B_READONLY_PICK], options),
      readOnlyRequiredFirst: await lintedWithTheCacheOffAndOn(tempProjects, [A_READONLY_REQUIRED, B_MUTABLE_REQUIRED], options),
      recordBesideAnOverwritableObject: await lintedWithTheCacheOffAndOn(tempProjects, [A_READ_ONLY_RECORD_MET_BESIDE_AN_OVERWRITABLE_OBJECT], options),
    }
  }, TYPED_RUNS)

  it('reports an overwritable Pick parameter in a file alone, with the cache off and with it on', () => {
    const expected = reportedAlone('src/b-mutable-pick.ts:3', READ_ONLY_SHALLOW, MUTABLE)

    expect(runs().mutablePickAlone).toStrictEqual({ cacheOff: expected, cacheOn: expected })
  })

  it('reports the parameter of a type recursing without end that is overwritable all the way down, as Mutable, and not the one immutable all the way down, with the cache off and with it on', () => {
    const expected = reportedAlone('src/turtles.ts:6', READ_ONLY_SHALLOW, MUTABLE)

    expect(runs().turtles).toStrictEqual({ cacheOff: expected, cacheOn: expected })
  })

  it('reports an overwritable Pick parameter after a read-only one in the same file, and not the read-only one, with the cache off', () => {
    expect(runs().bothInOneFile.cacheOff).toStrictEqual(reportedAlone('src/c-both-in-one-file.ts:8', READ_ONLY_SHALLOW, MUTABLE))
  })

  it('reports an overwritable Pick parameter after a read-only one in the same file, and not the read-only one, with the cache on', () => {
    expect(runs().bothInOneFile.cacheOn).toStrictEqual(reportedAlone('src/c-both-in-one-file.ts:8', READ_ONLY_SHALLOW, MUTABLE))
  })

  it('reports an overwritable Pick parameter in a file linted after one holding a read-only one, and not the read-only one, with the cache off', () => {
    expect(runs().readOnlyPickFirst.cacheOff).toStrictEqual(reportedAlone('src/b-mutable-pick.ts:3', READ_ONLY_SHALLOW, MUTABLE))
  })

  it('reports an overwritable Pick parameter in a file linted after one holding a read-only one, and not the read-only one, with the cache on', () => {
    expect(runs().readOnlyPickFirst.cacheOn).toStrictEqual(reportedAlone('src/b-mutable-pick.ts:3', READ_ONLY_SHALLOW, MUTABLE))
  })

  it('reports no read-only Pick parameter in a file linted after one holding an overwritable one, which it reports, with the cache off', () => {
    expect(runs().overwritablePickFirst.cacheOff).toStrictEqual(reportedAlone('src/a-mutable-pick.ts:3', READ_ONLY_SHALLOW, MUTABLE))
  })

  it('reports no read-only Pick parameter in a file linted after one holding an overwritable one, which it reports, with the cache on', () => {
    expect(runs().overwritablePickFirst.cacheOn).toStrictEqual(reportedAlone('src/a-mutable-pick.ts:3', READ_ONLY_SHALLOW, MUTABLE))
  })

  it('reports an overwritable Required parameter in a file linted after one holding a read-only one, and not the read-only one, with the cache off', () => {
    expect(runs().readOnlyRequiredFirst.cacheOff).toStrictEqual(reportedAlone('src/b-mutable-required.ts:3', READ_ONLY_SHALLOW, MUTABLE))
  })

  it('reports an overwritable Required parameter in a file linted after one holding a read-only one, and not the read-only one, with the cache on', () => {
    expect(runs().readOnlyRequiredFirst.cacheOn).toStrictEqual(reportedAlone('src/b-mutable-required.ts:3', READ_ONLY_SHALLOW, MUTABLE))
  })

  it('reports no parameter that is a read-only record or undefined after meeting the record beside an overwritable object, and reports an overwritable parameter, with the cache off and with it on', () => {
    const expected = reportedAlone('src/readings.ts:13', READ_ONLY_SHALLOW, MUTABLE)

    expect(runs().recordBesideAnOverwritableObject).toStrictEqual({ cacheOff: expected, cacheOn: expected })
  })
})

describe("prefer-immutable-types as npm gives the plugin, over this repo's is-immutable-type, parameters held to Immutable, files linted one after another in one process", () => {
  const runs = setUpRunsBeforeTheSuite(
    async (tempProjects) => ({
      turtles: await lintedWithTheCacheOffAndOn(tempProjects, [RECURSIVE_TURTLES], PARAMETERS_HELD_TO_IMMUTABLE),
      readOnlyPickFirst: await lintedWithTheCacheOffAndOn(tempProjects, [A_READONLY_PICK, B_MUTABLE_PICK], PARAMETERS_HELD_TO_IMMUTABLE),
      bothShelvesInOneFile: await lintedWithTheCacheOffAndOn(tempProjects, [BOTH_SHELVES_IN_ONE_FILE], PARAMETERS_HELD_TO_IMMUTABLE),
      heldInsideAPick: await lintedWithTheCacheOffAndOn(tempProjects, [A_PICK_HELD_INSIDE_A_PICK], PARAMETERS_HELD_TO_IMMUTABLE),
      halfWorkedOut: await lintedWithTheCacheOffAndOn(tempProjects, [A_TYPE_MET_WHILE_ITS_HOLDER_IS_HALF_WORKED_OUT], PARAMETERS_HELD_TO_IMMUTABLE),
      besideAPickInAPick: await lintedWithTheCacheOffAndOn(tempProjects, [A_TYPE_MET_BESIDE_A_PICK_HELD_INSIDE_A_PICK], PARAMETERS_HELD_TO_IMMUTABLE),
      holdingAPickInAPick: await lintedWithTheCacheOffAndOn(tempProjects, [A_TYPE_HOLDING_A_PICK_HELD_INSIDE_A_PICK], PARAMETERS_HELD_TO_IMMUTABLE),
      besideATypeReferringOnlyToItself: await lintedWithTheCacheOffAndOn(tempProjects, [A_TYPE_REFERRING_ONLY_TO_ITSELF_BESIDE_AN_OVERWRITABLE_OBJECT], PARAMETERS_HELD_TO_IMMUTABLE),
    }),
    TYPED_RUNS,
  )

  it('ends on a type recursing without end, reporting the parameter overwritable all the way down as Mutable, and not the other, with the cache off and with it on', () => {
    const expected = reportedAlone('src/turtles.ts:6', IMMUTABLE, MUTABLE)

    expect(runs().turtles).toStrictEqual({ cacheOff: expected, cacheOn: expected })
  })

  it('reports an overwritable Pick parameter in a file linted after one holding a read-only one, and not the read-only one, with the cache off', () => {
    expect(runs().readOnlyPickFirst.cacheOff).toStrictEqual(reportedAlone('src/b-mutable-pick.ts:3', IMMUTABLE, MUTABLE))
  })

  it('reports an overwritable Pick parameter in a file linted after one holding a read-only one, and not the read-only one, with the cache on', () => {
    expect(runs().readOnlyPickFirst.cacheOn).toStrictEqual(reportedAlone('src/b-mutable-pick.ts:3', IMMUTABLE, MUTABLE))
  })

  it('reports a parameter of a generic interface holding an overwritable object after one immutable all the way down, and not that one, with the cache off', () => {
    expect(runs().bothShelvesInOneFile.cacheOff).toStrictEqual(reportedAlone('src/shelves.ts:9', IMMUTABLE, READ_ONLY_SHALLOW))
  })

  it('reports a parameter of a generic interface holding an overwritable object after one immutable all the way down, and not that one, with the cache on', () => {
    expect(runs().bothShelvesInOneFile.cacheOn).toStrictEqual(reportedAlone('src/shelves.ts:9', IMMUTABLE, READ_ONLY_SHALLOW))
  })

  it('reports a parameter of a type holding an overwritable Pick after meeting that type inside a Pick of another, with the cache off and with it on', () => {
    // KNOWN GAP: viaPick's parameter, at line 5, is ReadonlyShallow too, and every copy of the library misses it with the cache off and on: its
    // recursion guard takes the Pick inside for the Pick being worked out. Strict: src/holder.ts:5 reported beside src/holder.ts:9, alike in both.
    const expected = reportedAlone('src/holder.ts:9', IMMUTABLE, READ_ONLY_SHALLOW)

    expect(runs().heldInsideAPick).toStrictEqual({ cacheOff: expected, cacheOn: expected })
  })

  it('reports a parameter of a type met while the type holding it had only a partial answer, and that type, with the cache off and with it on', () => {
    const expected = reportedAtEach(['src/shelf.ts:5', 'src/shelf.ts:9'], IMMUTABLE, READ_ONLY_SHALLOW)

    expect(runs().halfWorkedOut).toStrictEqual({ cacheOff: expected, cacheOn: expected })
  })

  it('reports a parameter of a type met beside a Pick held inside a Pick, and the one holding both, with the cache off and with it on', () => {
    const expected = reportedAtEach(['src/root.ts:8', 'src/root.ts:12'], IMMUTABLE, READ_ONLY_SHALLOW)

    expect(runs().besideAPickInAPick).toStrictEqual({ cacheOff: expected, cacheOn: expected })
  })

  it('reports a parameter of a type holding a type that holds an overwritable Pick, after meeting it inside a Pick of another, and the one holding that Pick, with the cache off and with it on', () => {
    const expected = reportedAtEach(['src/middle.ts:7', 'src/middle.ts:11'], IMMUTABLE, READ_ONLY_SHALLOW)

    expect(runs().holdingAPickInAPick).toStrictEqual({ cacheOff: expected, cacheOn: expected })
  })

  it('reports a parameter of a type holding an overwritable object beside a type referring only to itself, and not one holding only that type, with the cache off and with it on', () => {
    const expected = reportedAlone('src/loop.ts:5', IMMUTABLE, READ_ONLY_SHALLOW)

    expect(runs().besideATypeReferringOnlyToItself).toStrictEqual({ cacheOff: expected, cacheOn: expected })
  })
})
