// In the place of the header Stryker's instrumenter puts at the top of each file it mutates (instrumentationBabelHeader
// in @stryker-mutator/instrumenter), cut to what the bridge depends on: as the module loads it takes the active mutant
// from __STRYKER_ACTIVE_MUTANT__ where the namespace has none, which is how a child a test spawns finds it; at the first
// cover it takes the namespace's coverage map, making one where there is none, and keeps writing to that map, counting
// each mutant under the test Stryker names, or as static coverage while none is named.
const ACTIVE_MUTANT_ENV = '__STRYKER_ACTIVE_MUTANT__'

function strykerNamespace() {
  // eslint-disable-next-line unicorn/no-global-object-property-assignment -- in a child no setup file made the namespace, and child-coverage-hook.mjs reads the child's coverage from globalThis.__stryker__, where Stryker's instrumented code keeps it
  globalThis.__stryker__ ??= {}
  const namespace = globalThis.__stryker__
  namespace.activeMutant ??= process.env[ACTIVE_MUTANT_ENV]
  return namespace
}

const namespace = strykerNamespace()
const takenAtTheFirstCover = { coverage: undefined }

function coverageWrittenTo() {
  if (takenAtTheFirstCover.coverage === undefined) {
    namespace.mutantCoverage ??= { static: {}, perTest: {} }
    takenAtTheFirstCover.coverage = namespace.mutantCoverage
  }
  return takenAtTheFirstCover.coverage
}

function countsOfTheTestRunning() {
  const coverage = coverageWrittenTo()
  const { currentTestId } = namespace
  if (currentTestId === undefined) return coverage.static
  coverage.perTest[currentTestId] ??= {}
  return coverage.perTest[currentTestId]
}

export function cover(...mutantIds) {
  const counts = countsOfTheTestRunning()
  for (const mutantId of mutantIds) counts[mutantId] = (counts[mutantId] ?? 0) + 1
}

/** Null where none is on. */
export function activeMutant() {
  return namespace.activeMutant ?? null
}
