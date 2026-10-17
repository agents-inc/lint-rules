// Preloaded into each child a test spawns in Stryker's initial run (see child-process-bridge.ts).
import { randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const childCoverageDir = process.env.STRYKER_CHILD_COVERAGE_DIR

if (childCoverageDir !== undefined) {
  process.on('exit', () => {
    // A child that never loaded instrumented code has no Stryker namespace.
    const coverage = globalThis.__stryker__?.mutantCoverage
    if (coverage !== undefined) writeFileSync(join(childCoverageDir, `${randomUUID()}.json`), JSON.stringify(coverage))
  })
}
