// Loaded first in each run bridge-runs.ts makes, in the place of the setup file Stryker's vitest runner puts ahead of
// the bridge (its stryker-setup.js), cut to the namespace the bridge reads: a mutant run turns the mutant on as files
// load (static) or before the tests (runtime); a dry run names each test while it runs (unless the run says it names
// none) and, its after-hook running last, writes the coverage the bridge left, where Stryker reads it. Plain JS, as
// the bridge's own hook is.
import { writeFileSync } from 'node:fs'
import { afterAll, afterEach, beforeAll, beforeEach, inject } from 'vitest'

const FINAL_COVERAGE = new URL('./final-coverage.json', import.meta.url)

const namespace = {}
// eslint-disable-next-line unicorn/no-global-object-property-assignment -- the bridge reads Stryker's namespace from globalThis.__stryker__ (strykerNamespace in child-process-bridge.ts) and refuses to run without it, so the stand-in puts it where Stryker's setup file does
globalThis.__stryker__ = namespace

if (inject('mode') === 'mutant') {
  if (inject('mutantActivation') === 'static') namespace.activeMutant = inject('activeMutant')
  else
    beforeAll(() => {
      namespace.activeMutant = inject('activeMutant')
    })
} else {
  namespace.activeMutant = undefined
  if (inject('testsNamed') === 'each')
    beforeEach(({ task }) => {
      namespace.currentTestId = task.name
    })
  afterEach(() => {
    namespace.currentTestId = undefined
  })
  afterAll(() => {
    writeFileSync(FINAL_COVERAGE, JSON.stringify(namespace.mutantCoverage ?? null))
  })
}
