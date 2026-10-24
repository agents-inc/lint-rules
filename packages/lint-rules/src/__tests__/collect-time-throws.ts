import ts from 'typescript'
import { childNodesOf } from './repo-programs.ts'

/** Where vitest runs code while it collects a test file's cases. */
type CollectTime = 'top level' | 'describe body' | '.each table'

/**
 * A call, made while vitest collects the file, to a function of ours that can throw. `module` names the test helper
 * the call is written in, where the file loads it rather than making the call itself.
 */
export type CollectTimeThrow = { readonly calls: string; readonly where: CollectTime; readonly module?: string }

// Where the repo keeps the modules its tests load besides production source.
const TEST_HELPER_FOLDER = /\/__tests__\//u
const SUITES: ReadonlySet<string> = new Set(['describe', 'suite'])
const EACH = 'each'
// Array and object methods that call the function they are given before they return.
const CALLING_NOW: ReadonlySet<string> = new Set(['map', 'flatMap', 'filter', 'find', 'findIndex', 'some', 'every', 'forEach', 'reduce', 'toSorted', 'sort', 'from', 'fromEntries'])

/** The identifier a call chain starts at: `describe` for `describe.each(rows)(name, fn)`. */
function rootNameOf(expression: ts.Expression): string | null {
  if (ts.isIdentifier(expression)) return expression.text
  return ts.isCallExpression(expression) || ts.isPropertyAccessExpression(expression) ? rootNameOf(expression.expression) : null
}

function isEachCall({ expression }: ts.CallExpression): boolean {
  return ts.isPropertyAccessExpression(expression) && expression.name.text === EACH
}

function bodyOf(node: ts.Node): ts.Node | null {
  const isFunction = ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)
  return isFunction && node.body !== undefined ? node.body : null
}

function callsNow({ expression }: ts.CallExpression): boolean {
  return ts.isPropertyAccessExpression(expression) && CALLING_NOW.has(expression.name.text)
}

function isCalledNow(fn: ts.Node): boolean {
  const { parent } = fn
  return ts.isCallExpression(parent) && callsNow(parent) && parent.arguments.some((argument) => argument === fn)
}

/** What the call runs before it returns: its callee, and a function it hands to a method that calls it, `ids.map(codeOf)`. */
function calleesOf(call: ts.CallExpression): ts.Expression[] {
  const handed = callsNow(call) ? call.arguments.filter((argument) => ts.isIdentifier(argument) || ts.isPropertyAccessExpression(argument)) : []
  return [call.expression, ...handed]
}

/** Reads, through the type checker, which functions of ours a call reaches and whether any of them throws. */
function throwFinderOf(checker: ts.TypeChecker, isOurs: (file: string) => boolean): (callee: ts.Expression) => boolean {
  const throwVerdictByFunction = new Map<ts.Node, boolean>()
  // The functions being read, the outermost first: a read's place here is its depth.
  const openReads: ts.Node[] = []
  // For an open read, the shallowest open read its "does not throw" so far rests on.
  const shallowestLeanByRead = new Map<ts.Node, number>()
  // A closed read that found no throw while resting on a read still open, with that read's depth: counted as not
  // throwing until that read closes.
  const restingDepthByFunction = new Map<ts.Node, number>()

  function leanOn(depth: number): void {
    const innermost = openReads.at(-1)
    if (innermost === undefined) throw new Error('a read leaned on another while none was open')
    shallowestLeanByRead.set(innermost, Math.min(depth, shallowestLeanByRead.get(innermost) ?? depth))
  }

  // What rests on a read reaches it through calls a throw would leave by, so its verdict is theirs.
  function settleRestingOn(depth: number, canThrow: boolean): void {
    for (const [fn, restingDepth] of restingDepthByFunction) {
      if (restingDepth < depth) continue
      restingDepthByFunction.delete(fn)
      throwVerdictByFunction.set(fn, canThrow)
    }
  }

  // A read that closes resting on a shallower one passes that rest on to what rested on it.
  function passRestOn(depth: number, shallowest: number): void {
    for (const [fn, restingDepth] of restingDepthByFunction) {
      if (restingDepth >= depth) restingDepthByFunction.set(fn, shallowest)
    }
  }

  function functionOf(callee: ts.Expression): ts.FunctionLikeDeclaration | null {
    const symbol = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(callee) ? callee.name : callee)
    if (symbol === undefined) return null
    const target = (symbol.flags & ts.SymbolFlags.Alias) === 0 ? symbol : checker.getAliasedSymbol(symbol)
    const [declaration] = target.declarations ?? []
    if (declaration === undefined || !isOurs(declaration.getSourceFile().fileName)) return null
    if (ts.isFunctionDeclaration(declaration) || ts.isMethodDeclaration(declaration)) return declaration
    const initializer = ts.isVariableDeclaration(declaration) ? declaration.initializer : undefined
    return initializer !== undefined && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) ? initializer : null
  }

  // A throw it reaches as it runs: not one a try catches, and not one in a function it only makes.
  function throwsUnder(node: ts.Node, inFunction: ts.Node): boolean {
    if (ts.isThrowStatement(node)) return true
    if (node !== inFunction && ts.isFunctionLike(node) && !isCalledNow(node)) return false
    if (ts.isTryStatement(node) && node.catchClause !== undefined) return [node.catchClause, node.finallyBlock].some((part) => part !== undefined && throwsUnder(part, inFunction))
    if (ts.isCallExpression(node) && calleesOf(node).some(reachesAThrow)) return true
    return childNodesOf(node).some((child) => throwsUnder(child, inFunction))
  }

  // The depth of the open read a function's verdict waits on: its own read, still open, or one it rests on.
  function restingDepthOf(fn: ts.Node): number | undefined {
    const openAt = openReads.indexOf(fn)
    return openAt === -1 ? restingDepthByFunction.get(fn) : openAt
  }

  // Settled once its read closes resting on no read still open; otherwise held until that read closes.
  function canThrowOnRead(fn: ts.Node, body: ts.Node): boolean {
    const depth = openReads.length
    openReads.push(fn)
    const canThrow = throwsUnder(body, body)
    openReads.pop()
    const shallowest = shallowestLeanByRead.get(fn) ?? depth
    shallowestLeanByRead.delete(fn)
    if (canThrow || shallowest >= depth) {
      throwVerdictByFunction.set(fn, canThrow)
      settleRestingOn(depth, canThrow)
    } else {
      restingDepthByFunction.set(fn, shallowest)
      passRestOn(depth, shallowest)
      leanOn(shallowest)
    }
    return canThrow
  }

  function reachesAThrow(callee: ts.Expression): boolean {
    const fn = functionOf(callee)
    if (fn?.body === undefined) return false
    const known = throwVerdictByFunction.get(fn)
    if (known !== undefined) return known
    // A function called back into while it is read, or resting on one, counts as not throwing for now: a throw
    // there is found by the read still open.
    const restingDepth = restingDepthOf(fn)
    if (restingDepth === undefined) return canThrowOnRead(fn, fn.body)
    leanOn(restingDepth)
    return false
  }

  return reachesAThrow
}

/** Reads a module's statements as vitest runs them while it collects a test file: each call reaching a throw, in source order. */
function collectTimeThrowFinderOf(reachesAThrow: (callee: Readonly<ts.Expression>) => boolean): (file: Readonly<ts.SourceFile>) => CollectTimeThrow[] {
  function inCall(call: ts.CallExpression, where: CollectTime): CollectTimeThrow[] {
    const root = rootNameOf(call.expression)
    if (isEachCall(call)) return call.arguments.flatMap((argument) => throwsCollectedIn(argument, '.each table'))
    if (root !== null && SUITES.has(root)) {
      return [
        ...throwsCollectedIn(call.expression, where),
        ...call.arguments.flatMap((argument) => {
          const body = bodyOf(argument)
          return body === null ? throwsCollectedIn(argument, where) : throwsCollectedIn(body, 'describe body')
        }),
      ]
    }
    const here = calleesOf(call)
      .filter(reachesAThrow)
      .map((callee) => ({ calls: callee.getText(), where }))
    return [...here, ...childNodesOf(call).flatMap((child) => throwsCollectedIn(child, where))]
  }

  function throwsCollectedIn(node: ts.Node, where: CollectTime): CollectTimeThrow[] {
    if (ts.isFunctionLike(node)) {
      const body = bodyOf(node)
      return body !== null && isCalledNow(node) ? throwsCollectedIn(body, where) : []
    }
    if (ts.isCallExpression(node)) return inCall(node, where)
    return childNodesOf(node).flatMap((child) => throwsCollectedIn(child, where))
  }

  return (file) => file.statements.filter((statement) => !ts.isImportDeclaration(statement)).flatMap((statement) => throwsCollectedIn(statement, 'top level'))
}

// Vitest erases `import type`, so the module it names is never loaded.
function isOfTypesOnly({ importClause }: Readonly<ts.ImportDeclaration>): boolean {
  return importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword
}

/** The source file an import loads as its file runs: none for an import of types only, or of a module no source file holds. */
function moduleLoadedBy(statement: Readonly<ts.Statement>, checker: ts.TypeChecker): ts.SourceFile | null {
  if (!ts.isImportDeclaration(statement) || isOfTypesOnly(statement)) return null
  const [declaration] = checker.getSymbolAtLocation(statement.moduleSpecifier)?.declarations ?? []
  return declaration !== undefined && ts.isSourceFile(declaration) ? declaration : null
}

/** A module of ours in a test-helper folder, as test files load besides production source. */
function isTestHelper({ fileName }: Readonly<ts.SourceFile>, isOurs: (file: string) => boolean): boolean {
  return TEST_HELPER_FOLDER.test(fileName) && isOurs(fileName)
}

/** Each module entered so far, those still loading among them, and the test helpers loaded, in the order vitest runs them. */
type HelperLoads = { readonly entered: ReadonlySet<ts.SourceFile>; readonly inOrder: readonly ts.SourceFile[] }

/** Each test helper the file loads, by its own imports or a helper's, once, in the order vitest runs them: a helper's imports first. */
function testHelpersLoadedBy(sourceFile: Readonly<ts.SourceFile>, checker: ts.TypeChecker, isOurs: (file: string) => boolean): readonly ts.SourceFile[] {
  function helpersImportedBy(file: Readonly<ts.SourceFile>): ts.SourceFile[] {
    return file.statements
      .map((statement) => moduleLoadedBy(statement, checker))
      .filter((loaded) => loaded !== null)
      .filter((loaded) => isTestHelper(loaded, isOurs))
  }

  function loadedThrough(file: Readonly<ts.SourceFile>, loads: HelperLoads): HelperLoads {
    return helpersImportedBy(file).reduce((soFar, helper) => (soFar.entered.has(helper) ? soFar : loadedAfterItsImports(helper, soFar)), loads)
  }

  function loadedAfterItsImports(helper: Readonly<ts.SourceFile>, loads: HelperLoads): HelperLoads {
    const throughIt = loadedThrough(helper, { ...loads, entered: new Set([...loads.entered, helper]) })
    return { ...throughIt, inOrder: [...throughIt.inOrder, helper] }
  }

  return loadedThrough(sourceFile, { entered: new Set([sourceFile]), inOrder: [] }).inOrder
}

function writtenIn(helper: Readonly<ts.SourceFile>): (found: CollectTimeThrow) => CollectTimeThrow {
  return (found) => ({ ...found, module: helper.fileName })
}

/**
 * Each call vitest makes while it collects the test file that reaches a throw in a function of ours: those at the top
 * level of each test helper it loads, as vitest runs them, then its own, in source order.
 */
export function collectTimeThrowsIn(sourceFile: ts.SourceFile, checker: ts.TypeChecker, isOurs: (file: string) => boolean): CollectTimeThrow[] {
  const collectTimeThrowsOf = collectTimeThrowFinderOf(throwFinderOf(checker, isOurs))
  const inHelpers = testHelpersLoadedBy(sourceFile, checker, isOurs).flatMap((helper) => collectTimeThrowsOf(helper).map(writtenIn(helper)))
  return [...inHelpers, ...collectTimeThrowsOf(sourceFile)]
}
