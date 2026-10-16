// Loaded into every child process a test spawns during Stryker's initial run (child-process-bridge.ts
// puts it in NODE_OPTIONS). At exit, it writes the mutants the child's instrumented `dist/` covered
// into the folder the bridge reads.
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
