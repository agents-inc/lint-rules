import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { catalog } from '@workspace/rule-data'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { namesARuleInEachKindOfString, namesRulesOnlyInComments } from './__tests__/cases/rule-id-strings.ts'

// lint-rules reads every rule, and what allowSuppressions decides, from the catalog and names none:
// moving a rule or changing its settings is then a change to rule-data's data alone.

const SOURCE_DIR = fileURLToPath(new URL('.', import.meta.url))
const TYPESCRIPT_SOURCE = /\.ts$/u
const TEST_SOURCE = /(?:\.test\.ts|\.type-test\.ts)$|^__tests__\//u
// The published entry points: a scan that misses them has read the wrong directory.
const ENTRY_POINTS = ['eslint.ts', 'index.ts', 'oxlint.ts']

/** Every string literal in the source, comments and template literals with substitutions aside, that is a RuleId. */
function ruleIdsNamedIn(source: string): string[] {
  const sourceFile = ts.createSourceFile('scanned.ts', source, ts.ScriptTarget.Latest)
  const named: string[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node) && catalog.rules.has(node.text)) named.push(node.text)
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return named
}

async function nonTestSourceFiles(): Promise<string[]> {
  const files = await readdir(SOURCE_DIR, { recursive: true })
  return files.filter((file) => TYPESCRIPT_SOURCE.test(file) && !TEST_SOURCE.test(file)).sort()
}

describe('the scan for rule IDs', () => {
  it('finds a RuleId in single quotes, double quotes and a template literal, and nothing else', () => {
    expect(ruleIdsNamedIn(namesARuleInEachKindOfString)).toStrictEqual(['house/no-suppressions', 'eqeqeq', 'no-debugger'])
  })

  it('finds none named only in comments', () => {
    expect(ruleIdsNamedIn(namesRulesOnlyInComments)).toStrictEqual([])
  })

  it('reads the source of lint-rules, its entry points included', async () => {
    const files = await nonTestSourceFiles()

    expect(ENTRY_POINTS.filter((entryPoint) => files.includes(entryPoint))).toStrictEqual(ENTRY_POINTS)
  })
})

describe('the source of lint-rules, tests aside', () => {
  it('names no rule ID in a string: every rule comes from the catalog', async () => {
    const files = await nonTestSourceFiles()
    const named = await Promise.all(
      files.map(async (file) =>
        ruleIdsNamedIn(await readFile(join(SOURCE_DIR, file), 'utf8')).map((id) => `${file}: ${id}`),
      ),
    )

    expect(named.flat()).toStrictEqual([])
  })
})
