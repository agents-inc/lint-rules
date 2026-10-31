import { describe, expect, it } from 'vitest'
import {
  A_LOCATION_WRITE,
  A_SPREAD_OF_AN_ITERATOR_MAP,
  A_USELESS_SPREAD,
  CODE_A_KEPT_FIX_REWRITES,
  CODE_A_WITHHELD_JSDOM_FIX_WOULD_BREAK,
  LOOPS_OVER_A_COPY_OF_A_LIVE_LIST,
} from './__tests__/cases/jsdom-fix-check-sources.ts'
import { unshippedRuleRefusal } from './__tests__/cases/rules-we-do-not-ship.ts'
import { autofixedFilesIn, findingsIn, findingsInFile } from './__tests__/check-output.ts'
import { EXIT, runCheck } from './__tests__/cli-runs.ts'
import { checkedPackageFiles } from './__tests__/factories/check-factories.ts'
import { buildConsumerLintRules, emptyTsconfigRootDir } from './__tests__/factories/lint-rules-factories.ts'
import { createGitProject } from './__tests__/git-projects.ts'
import { allowEveryTestForParallelLoad } from './__tests__/parallel-load.ts'
import { setUpRunsBeforeTheSuite } from './__tests__/runs-before-the-suite.ts'
import { textsOf } from './__tests__/temp-projects.ts'
import { defineLintRules } from './index.ts'

// dom-node-dataset runs in oxlint and the others in ESLint, so each engine withholds a fix here.

allowEveryTestForParallelLoad()

const BROWSER_BESIDE_SECURITY_MODERN_JS_REDUNDANCY_CONVENTIONS_AND_TESTING_LIBRARY = {
  quality: ['security', 'modern-js', 'redundancy', 'conventions'],
  runtimes: ['browser'],
  libs: { testing: ['testing-library'] },
} as const
/** Each file is an exported arrow function, which consistent-function-style in conventions reports. */
const ARROW_FUNCTIONS_ALLOWED = { rules: { 'unicorn/consistent-function-style': 'off' } } as const
const SPREADS_THE_HELD_RULE_WOULD_REMOVE = [...LOOPS_OVER_A_COPY_OF_A_LIVE_LIST, { ...A_USELESS_SPREAD, findings: [] }]
const WRITTEN = [...CODE_A_WITHHELD_JSDOM_FIX_WOULD_BREAK, A_LOCATION_WRITE, A_SPREAD_OF_AN_ITERATOR_MAP, ...SPREADS_THE_HELD_RULE_WOULD_REMOVE, ...CODE_A_KEPT_FIX_REWRITES]
const PATHS = WRITTEN.map(({ file }) => file)
// In path order, as check prints them.
const FINDINGS = [
  ...CODE_A_WITHHELD_JSDOM_FIX_WOULD_BREAK.map(({ file, line, rule }) => `${file}:${line} ${rule}`),
  A_SPREAD_OF_AN_ITERATOR_MAP.finding,
  ...LOOPS_OVER_A_COPY_OF_A_LIVE_LIST.flatMap(({ findings }) => findings),
].toSorted()
/** Kept unshipped: ESLint's fix removes the copy a loop over a live list needs. */
const RULE_KEPT_UNSHIPPED = 'unicorn/no-useless-spread'
const SHIPPED_BESIDE = 'unicorn/prefer-query-selector'

describe('check, run twice, on files a fix would break a passing jsdom test through, beside files whose fix the owner kept', () => {
  const run = setUpRunsBeforeTheSuite((tempProjects) => {
    const project = createGitProject(tempProjects, { repo: 'committed', files: checkedPackageFiles(BROWSER_BESIDE_SECURITY_MODERN_JS_REDUNDANCY_CONVENTIONS_AND_TESTING_LIBRARY, ARROW_FUNCTIONS_ALLOWED) })
    for (const { file, source } of WRITTEN) project.write(file, source)
    const first = runCheck(project.dir)
    const afterFirst = textsOf(project.dir, PATHS)
    const second = runCheck(project.dir)
    const afterSecond = textsOf(project.dir, PATHS)
    return { first, afterFirst, second, afterSecond }
  })

  it.each(CODE_A_WITHHELD_JSDOM_FIX_WOULD_BREAK)('reports $rule on line $line of $file and leaves the file byte for byte', ({ file, source, line, rule }) => {
    const { first, afterFirst } = run()

    expect({ findings: findingsInFile(first.stdout, file), text: afterFirst[file] }).toStrictEqual({ findings: [`${file}:${line} ${rule}`], text: source })
  })

  it("reports those files, the spread of an iterator and the loop's class lookup alone, each on its one line, and exits on the findings", () => {
    const { first } = run()

    expect({ exitCode: first.exitCode, findings: findingsIn(first.stdout) }).toStrictEqual({ exitCode: EXIT.findings, findings: FINDINGS })
  })

  it('reports nothing in the location.href write and leaves it byte for byte', () => {
    const { first, afterFirst } = run()

    expect({ findings: findingsInFile(first.stdout, A_LOCATION_WRITE.file), text: afterFirst[A_LOCATION_WRITE.file] }).toStrictEqual({
      findings: [],
      text: A_LOCATION_WRITE.source,
    })
  })

  it("reports no useless spread around an iterator's map, and leaves the spread byte for byte", () => {
    const { first, afterFirst } = run()
    const { file, source, finding } = A_SPREAD_OF_AN_ITERATOR_MAP

    expect({ findings: findingsInFile(first.stdout, file), text: afterFirst[file] }).toStrictEqual({ findings: [finding], text: source })
  })

  it.each(SPREADS_THE_HELD_RULE_WOULD_REMOVE)('reports no useless spread in $file, and leaves it byte for byte', ({ file, source, findings }) => {
    const { first, afterFirst } = run()

    expect({ findings: findingsInFile(first.stdout, file), text: afterFirst[file] }).toStrictEqual({ findings, text: source })
  })

  it.each(CODE_A_KEPT_FIX_REWRITES)('applies the fix to $file', ({ file, fixed }) => {
    const { afterFirst } = run()

    expect(afterFirst[file]).toStrictEqual(fixed)
  })

  it('names the fixed files alone in the autofixed line', () => {
    const { first } = run()

    expect(autofixedFilesIn(first.stdout)).toStrictEqual(CODE_A_KEPT_FIX_REWRITES.map(({ file }) => file).toSorted())
  })

  it('reports the same findings on a second run, fixes nothing and changes no file', () => {
    const { second, afterFirst, afterSecond } = run()

    expect({ exitCode: second.exitCode, findings: findingsIn(second.stdout), autofixed: autofixedFilesIn(second.stdout), texts: afterSecond }).toStrictEqual({
      exitCode: EXIT.findings,
      findings: FINDINGS,
      autofixed: [],
      texts: afterFirst,
    })
  })
})

describe(`${RULE_KEPT_UNSHIPPED}, kept unshipped, named in agents-inc.lint.mts`, () => {
  it('is refused as a rule we do not ship', () => {
    const lintRules = buildConsumerLintRules(emptyTsconfigRootDir(), {}, { rules: { [RULE_KEPT_UNSHIPPED]: 'error' } })

    expect(() => defineLintRules(lintRules)).toThrow(new Error(unshippedRuleRefusal('rules', RULE_KEPT_UNSHIPPED)))
  })

  it('leaves beside it a browser rule we ship accepted there, its fix withheld or not', () => {
    const lintRules = buildConsumerLintRules(emptyTsconfigRootDir(), {}, { rules: { [SHIPPED_BESIDE]: 'error' } })

    expect(() => defineLintRules(lintRules)).not.toThrow()
  })
})
