import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { foundOr } from '@workspace/rule-data/collections'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { childNodesOf, enclosingFunctionNameOf, isRepoSource, nodesUnder } from './repo-programs.ts'

// The walk the collect-time finder and the slash-split census read: a node it skipped, or a name it gave a call
// wrongly, would hide a call from both.

const MODULE = '/project/module.ts'
const A_CALL_OF_TWO_ARGUMENTS = 'f(a, b)\n'
const A_CALL_WITH_A_CALL_FOR_AN_ARGUMENT = 'f(g(a), b)\n'
const TOP_LEVEL = '(top level)'

const CALLS_OF_F = [
  { place: 'a function declaration', text: 'function outer() {\n  return f()\n}\n', name: 'outer' },
  { place: 'a callback in a function declaration', text: 'function outer() {\n  return [1].map(() => f())\n}\n', name: 'outer' },
  { place: 'an arrow function a constant holds', text: 'const named = () => f()\n', name: 'named' },
  { place: 'a function expression a constant holds', text: 'const named = function () {\n  return f()\n}\n', name: 'named' },
  { place: 'a method', text: 'class Holder {\n  method() {\n    return f()\n  }\n}\n', name: 'method' },
  { place: 'the top level', text: 'f()\n', name: TOP_LEVEL },
  { place: 'a callback at the top level', text: '[1].map(() => f())\n', name: TOP_LEVEL },
] as const

/** With each node's parent set, as a program's checker sets them. */
function sourceFileOf(text: string): ts.SourceFile {
  return ts.createSourceFile(MODULE, text, ts.ScriptTarget.Latest, true)
}

/** The call the module's first statement makes. */
function firstStatementCall(text: string): ts.CallExpression {
  const [statement] = sourceFileOf(text).statements
  if (statement === undefined || !ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) {
    throw new Error(`${JSON.stringify(text)} starts with no call`)
  }
  return statement.expression
}

function textsOf(nodes: readonly ts.Node[]): string[] {
  return nodes.map((node) => node.getText())
}

function repoRoot(): string {
  return fileURLToPath(new URL('../../../..', import.meta.url))
}

describe('childNodesOf', () => {
  it("gives the call's callee and arguments, in source order, and none of its punctuation", () => {
    expect(textsOf(childNodesOf(firstStatementCall(A_CALL_OF_TWO_ARGUMENTS)))).toStrictEqual(['f', 'a', 'b'])
  })
})

describe('nodesUnder', () => {
  it("gives the node first, then each child's own nodes in turn, before the next child's", () => {
    expect(textsOf(nodesUnder(firstStatementCall(A_CALL_WITH_A_CALL_FOR_AN_ARGUMENT)))).toStrictEqual(['f(g(a), b)', 'f', 'g(a)', 'g', 'a', 'b'])
  })
})

describe('enclosingFunctionNameOf', () => {
  it.each(CALLS_OF_F)('names $name for a call in $place', ({ text, name }) => {
    const callOfF = nodesUnder(sourceFileOf(text)).find((node) => ts.isCallExpression(node) && node.expression.getText() === 'f')

    expect(enclosingFunctionNameOf(foundOr(callOfF, `${JSON.stringify(text)} calls no f`))).toBe(name)
  })
})

describe('isRepoSource', () => {
  it("answers yes for a file under the repo's root, and no for one an installed package holds or one outside the root", () => {
    const root = repoRoot()

    expect({
      underTheRoot: isRepoSource(join(root, 'packages/lint-rules/src/index.ts')),
      installed: isRepoSource(join(root, 'node_modules/typescript/lib/typescript.d.ts')),
      outsideTheRoot: isRepoSource(join(dirname(root), 'another-repo/src/index.ts')),
    }).toStrictEqual({ underTheRoot: true, installed: false, outsideTheRoot: false })
  })
})
