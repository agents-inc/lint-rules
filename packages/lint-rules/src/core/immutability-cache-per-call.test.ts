import { catalog, routeOf } from '@workspace/rule-data'
import { foundOr } from '@workspace/rule-data/collections'
import { eslintPlugins } from '@workspace/rule-data/eslint-plugins'
import { ESLint, Linter } from 'eslint'
import type ts from 'typescript'
import tseslint from 'typescript-eslint'
import { describe, expect, it, vi } from 'vitest'
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
  TWO_INSTANTIATIONS_OF_ONE_GENERIC,
} from '../__tests__/cases/pick-parameter-sources.ts'
import { describeFinding, eslintEngineFindingsIn, fatalMessagesIn } from '../__tests__/engine-clis.ts'
import { moduleText } from '../__tests__/factories/check-factories.ts'
import { buildTeamEslintBlock } from '../__tests__/factories/team-config-factories.ts'
import { buildTsconfig } from '../__tests__/factories/tsconfig-factories.ts'
import { exportOf, programOfFiles } from '../__tests__/factories/typescript-program-factories.ts'
import { type RunsBeforeTheSuiteOptions, setUpRunsBeforeTheSuite } from '../__tests__/runs-before-the-suite.ts'
import { setUpTempProjects, type TempProjects } from '../__tests__/temp-projects.ts'
import { eslintPluginRegistry } from '../eslint-plugin-registry.ts'
import { checkerWithRecursionIdentitiesOfItsOwn, withImmutabilityCachedPerCall } from './immutability-cache-per-call.ts'

// is-immutable-type (5.0.4) caches each answer for the whole process under checker.getRecursionIdentity(type), which
// every instantiation of one generic shares (Pick, Required), so with the cache on the first answered decided the rest.
// eslint-plugin-functional (10.0.1) turns the cache off where NODE_ENV is "test", as Vitest sets it: each typed run
// here sets it otherwise, as a team's own run has it.

const FUNCTIONAL = 'functional'
const PREFER_IMMUTABLE_TYPES = 'prefer-immutable-types'
const RULE_ID = `${FUNCTIONAL}/${PREFER_IMMUTABLE_TYPES}`
// typescript-eslint's own refusal of a typed rule on a file it has no type information for (8.71).
const NEEDS_TYPE_INFORMATION = 'You have used a rule which requires type information'
const PICKED_FILE = '/project/picked.ts'
const READ_ONLY_SHALLOW = 'ReadonlyShallow'
const IMMUTABLE = 'Immutable'
const MUTABLE = 'Mutable'
const TYPED_RUNS: RunsBeforeTheSuiteOptions = { timeoutMs: 180_000, whatFailed: 'the typed lint runs could not be made before the suite' }

type Reported = { readonly at: string; readonly message: string }

type Linted = { readonly fatal: readonly string[]; readonly reported: readonly Reported[] }

function functionalPlugin(): ESLint.Plugin {
  return foundOr(eslintPlugins[FUNCTIONAL], 'rule-data registers no functional plugin')
}

function rulesOf(plugin: Readonly<ESLint.Plugin>): NonNullable<ESLint.Plugin['rules']> {
  if (plugin.rules === undefined) throw new Error('the plugin has no rules')
  return plugin.rules
}

function preferImmutableTypesOf(plugin: Readonly<ESLint.Plugin>): NonNullable<ESLint.Plugin['rules']>[string] {
  return foundOr(rulesOf(plugin)[PREFER_IMMUTABLE_TYPES], `the plugin has no ${PREFER_IMMUTABLE_TYPES}`)
}

function shippedOptions(): readonly unknown[] {
  const { shipped } = routeOf(RULE_ID, catalog)
  if (shipped === null) throw new Error(`${RULE_ID} is not shipped`)
  return shipped.options
}

function declaredTypeOf(program: ts.Program, name: string): ts.Type {
  return program.getTypeChecker().getDeclaredTypeOfSymbol(exportOf(program, PICKED_FILE, name))
}

/** A project whose tsconfig takes in src, holding the sources given. */
function typedProjectOf(tempProjects: TempProjects, sources: readonly ParameterSource[]): string {
  return tempProjects.create({
    files: {
      'tsconfig.json': JSON.stringify(buildTsconfig({ include: ['src'] })),
      ...Object.fromEntries(sources.map(({ file, lines }) => [file, moduleText(...lines)])),
    },
  })
}

/** The functional plugin given, running prefer-immutable-types alone at the options given, with type information. */
function typedBlockOf(projectDir: string, functional: Readonly<ESLint.Plugin>, options: readonly unknown[]): Linter.Config {
  return buildTeamEslintBlock('prefer-immutable-types alone, typed', {
    files: ['**/*.ts'],
    languageOptions: { parser: tseslint.parser, parserOptions: { projectService: true, tsconfigRootDir: projectDir } },
    plugins: { [FUNCTIONAL]: functional },
    rules: { [RULE_ID]: ['error', ...options] },
  })
}

/** Every file of the project linted in this process, one after another, with NODE_ENV as a team's own run has it. */
async function lintedWithTheCacheOn(projectDir: string, functional: Readonly<ESLint.Plugin>, options: readonly unknown[]): Promise<Linted> {
  vi.stubEnv('NODE_ENV', NODE_ENV_OUTSIDE_TESTS.NODE_ENV)
  try {
    const results = await new ESLint({ cwd: projectDir, overrideConfigFile: true, overrideConfig: typedBlockOf(projectDir, functional, options) }).lintFiles(['.'])
    return {
      fatal: fatalMessagesIn(results, projectDir),
      reported: eslintEngineFindingsIn(results, projectDir).map((finding) => ({ at: describeFinding(finding), message: finding.message })),
    }
  } finally {
    vi.unstubAllEnvs()
  }
}

function verified(plugin: Readonly<ESLint.Plugin>): () => void {
  return () => {
    new Linter().verify(moduleText(...B_MUTABLE_PICK.lines), [{ files: ['**/*.ts'], languageOptions: { parser: tseslint.parser }, plugins: { [FUNCTIONAL]: plugin }, rules: { [RULE_ID]: 'error' } }], { filename: 'a.ts' })
  }
}

describe('a checker whose recursion identities are its own', () => {
  it('identifies two instantiations of one generic as one, as the checker does, and two object types apart', () => {
    const program = programOfFiles(TWO_INSTANTIATIONS_OF_ONE_GENERIC)
    const own = checkerWithRecursionIdentitiesOfItsOwn(program.getTypeChecker())
    function identityOf(name: string): object {
      return own.getRecursionIdentity(declaredTypeOf(program, name))
    }

    expect({
      picksAsOne: identityOf('ReadonlyPicked') === identityOf('OverwritablePicked'),
      objectTypesAsOne: identityOf('Item') === identityOf('Box'),
    }).toStrictEqual({ picksAsOne: true, objectTypesAsOne: false })
  })

  it('gives a type the same identity each time one checker is asked, and another in each other checker derived', () => {
    const program = programOfFiles(TWO_INSTANTIATIONS_OF_ONE_GENERIC)
    const checker = program.getTypeChecker()
    const [first, second] = [checkerWithRecursionIdentitiesOfItsOwn(checker), checkerWithRecursionIdentitiesOfItsOwn(checker)]
    const picked = declaredTypeOf(program, 'ReadonlyPicked')
    const firstAsked = first.getRecursionIdentity(picked)
    const firstAskedAgain = first.getRecursionIdentity(picked)
    const secondAsked = second.getRecursionIdentity(picked)

    expect({ withinOne: firstAsked === firstAskedAgain, acrossTwo: firstAsked === secondAsked }).toStrictEqual({ withinOne: true, acrossTwo: false })
  })
})

describe('withImmutabilityCachedPerCall', () => {
  it("gives functional's prefer-immutable-types a module of its own and keeps its other rules, beside every other plugin, kept as it is", () => {
    const functional = functionalPlugin()
    const wrapped = rulesOf(withImmutabilityCachedPerCall(FUNCTIONAL, functional))
    const ours = rulesOf(functional)

    expect({
      ruleNames: Object.keys(wrapped),
      rulesReplaced: Object.keys(ours).filter((name) => wrapped[name] !== ours[name]),
      pluginsReplaced: Object.entries(eslintPlugins)
        .filter(([prefix, plugin]) => withImmutabilityCachedPerCall(prefix, plugin) !== plugin)
        .map(([prefix]) => prefix),
    }).toStrictEqual({ ruleNames: Object.keys(ours), rulesReplaced: [PREFER_IMMUTABLE_TYPES], pluginsReplaced: [FUNCTIONAL] })
  })

  it("keeps the rule's own meta, which check's fix filter, withheld list and option schema read", () => {
    const functional = functionalPlugin()

    expect(preferImmutableTypesOf(withImmutabilityCachedPerCall(FUNCTIONAL, functional)).meta).toBe(preferImmutableTypesOf(functional).meta)
  })

  it('refuses a functional plugin without rules, or without prefer-immutable-types, naming what is missing', () => {
    expect(() => withImmutabilityCachedPerCall(FUNCTIONAL, {})).toThrow(new Error('the plugin under functional has no rules'))
    expect(() => withImmutabilityCachedPerCall(FUNCTIONAL, { rules: {} })).toThrow(new Error('functional/prefer-immutable-types is not in its plugin'))
  })

  it('leaves a file with no type information to the rule, which says it needs some, as the rule unwrapped does', () => {
    const functional = functionalPlugin()

    expect(verified(functional)).toThrow(NEEDS_TYPE_INFORMATION)
    expect(verified(withImmutabilityCachedPerCall(FUNCTIONAL, functional))).toThrow(NEEDS_TYPE_INFORMATION)
  })
})

describe("the registry's functional plugin", () => {
  it('runs prefer-immutable-types as a module of its own, keeping its meta, and every other functional rule as the plugin has it', () => {
    const functional = functionalPlugin()
    const registered = foundOr(eslintPluginRegistry[FUNCTIONAL], 'the registry has no functional plugin')
    const ours = rulesOf(functional)

    expect({
      rulesReplaced: Object.keys(ours).filter((name) => rulesOf(registered)[name] !== ours[name]),
      metaKept: preferImmutableTypesOf(registered).meta === preferImmutableTypesOf(functional).meta,
    }).toStrictEqual({ rulesReplaced: [PREFER_IMMUTABLE_TYPES], metaKept: true })
  })
})

describe('prefer-immutable-types with its cache per call, at the shipped options, files linted one after another in one process', () => {
  const runs = setUpRunsBeforeTheSuite(async (tempProjects) => {
    const wrapped = withImmutabilityCachedPerCall(FUNCTIONAL, functionalPlugin())
    async function lintedHolding(sources: readonly ParameterSource[]): Promise<Linted> {
      return lintedWithTheCacheOn(typedProjectOf(tempProjects, sources), wrapped, shippedOptions())
    }
    return {
      bothInOneFile: await lintedHolding([BOTH_PICKS_IN_ONE_FILE]),
      readOnlyPickFirst: await lintedHolding([A_READONLY_PICK, B_MUTABLE_PICK]),
      overwritablePickFirst: await lintedHolding([A_MUTABLE_PICK, B_READONLY_PICK]),
      readOnlyRequiredFirst: await lintedHolding([A_READONLY_REQUIRED, B_MUTABLE_REQUIRED]),
      turtles: await lintedHolding([RECURSIVE_TURTLES]),
    }
  }, TYPED_RUNS)

  it('reports an overwritable Pick parameter after a read-only one in the same file, and not the read-only one', () => {
    expect(runs().bothInOneFile).toStrictEqual({
      fatal: [],
      reported: [{ at: 'src/c-both-in-one-file.ts:8 functional/prefer-immutable-types', message: parameterImmutabilityMessage(READ_ONLY_SHALLOW, MUTABLE) }],
    })
  })

  it('reports an overwritable Pick parameter in a file linted after one holding a read-only one, and not the read-only one', () => {
    expect(runs().readOnlyPickFirst).toStrictEqual({
      fatal: [],
      reported: [{ at: 'src/b-mutable-pick.ts:3 functional/prefer-immutable-types', message: parameterImmutabilityMessage(READ_ONLY_SHALLOW, MUTABLE) }],
    })
  })

  it('reports no read-only Pick parameter in a file linted after one holding an overwritable one, which it reports', () => {
    expect(runs().overwritablePickFirst).toStrictEqual({
      fatal: [],
      reported: [{ at: 'src/a-mutable-pick.ts:3 functional/prefer-immutable-types', message: parameterImmutabilityMessage(READ_ONLY_SHALLOW, MUTABLE) }],
    })
  })

  it('reports an overwritable Required parameter in a file linted after one holding a read-only one, and not the read-only one', () => {
    expect(runs().readOnlyRequiredFirst).toStrictEqual({
      fatal: [],
      reported: [{ at: 'src/b-mutable-required.ts:3 functional/prefer-immutable-types', message: parameterImmutabilityMessage(READ_ONLY_SHALLOW, MUTABLE) }],
    })
  })

  it('reports the parameter of a type recursing without end that is overwritable all the way down, as Mutable, and not the one immutable all the way down', () => {
    expect(runs().turtles).toStrictEqual({
      fatal: [],
      reported: [{ at: 'src/turtles.ts:6 functional/prefer-immutable-types', message: parameterImmutabilityMessage(READ_ONLY_SHALLOW, MUTABLE) }],
    })
  })
})

describe('prefer-immutable-types with its cache per call, parameters held to Immutable, on a type recursing without end', () => {
  const tempProjects = setUpTempProjects()

  it('ends within the default timeout, reporting the parameter overwritable all the way down as Mutable, and not the other', async () => {
    const linted = await lintedWithTheCacheOn(typedProjectOf(tempProjects, [RECURSIVE_TURTLES]), withImmutabilityCachedPerCall(FUNCTIONAL, functionalPlugin()), PARAMETERS_HELD_TO_IMMUTABLE)

    expect(linted).toStrictEqual({
      fatal: [],
      reported: [{ at: 'src/turtles.ts:6 functional/prefer-immutable-types', message: parameterImmutabilityMessage(IMMUTABLE, MUTABLE) }],
    })
  })
})
