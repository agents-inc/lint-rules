// Spawned by the fixtures leaving no coverage map: it writes, to the folder the bridge has children write their coverage
// to, a file child-coverage-hook.mjs never writes, of the shape it is given. It loads no instrumented code, so the hook
// writes nothing of its own.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CHILD_COVERAGE_DIR_ENV = 'STRYKER_CHILD_COVERAGE_DIR'
// By the shape: `static` and `perTest` name the map holding a hit count in text, every other count a number; the rest
// name what stands where the hook writes an object of maps, each map an object.
const NOT_A_COVERAGE_MAP = {
  static: { static: { 'counted-as-text': '1' }, perTest: {} },
  perTest: { static: { 'counted-as-a-number': 1 }, perTest: { 'a test of the child': { 'counted-as-text': '1' } } },
  nullInPlaceOfTheMaps: null,
  staticCountsInAList: { static: [1], perTest: {} },
  perTestMapsANumber: { static: { 'counted-as-a-number': 1 }, perTest: 1 },
}

const childCoverageDir = process.env[CHILD_COVERAGE_DIR_ENV]
if (childCoverageDir === undefined) throw new Error(`the bridge handed this child no ${CHILD_COVERAGE_DIR_ENV}`)
const [shape] = process.argv.slice(2)
if (shape === undefined || !Object.hasOwn(NOT_A_COVERAGE_MAP, shape)) {
  throw new Error(`give the shape to write: ${Object.keys(NOT_A_COVERAGE_MAP).join(', ')}`)
}

writeFileSync(join(childCoverageDir, 'not-a-coverage-map.json'), JSON.stringify(NOT_A_COVERAGE_MAP[shape]))
