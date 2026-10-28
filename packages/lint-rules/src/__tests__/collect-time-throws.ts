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

/** What reading the functions calls reach has settled so far, and what it still has open. */
type Reads = {
  /** Whether each function settled so far can throw. */
  readonly verdictByFunction: ReadonlyMap<ts.Node, boolean>
  /** The functions being read, the outermost first: a read's place here is its depth. */
  readonly openReads: readonly ts.Node[]
  /** For an open read, the shallowest open read its "does not throw" so far rests on. */
  readonly shallowestLeanByRead: ReadonlyMap<ts.Node, number>
  /**
   * A closed read that found no throw while resting on a read still open, with that read's depth: counted as not
   * throwing until that read closes.
   */
  readonly restingDepthByFunction: ReadonlyMap<ts.Node, number>
}

/** What was found, and the reads as they stand once it was. */
type Read<Found> = readonly [found: Found, reads: Reads]

type ThrowFinder = (callee: Readonly<ts.Expression>, reads: Reads) => Read<boolean>

/** The identifier a call chain starts at: `describe` for `describe.each(rows)(name, fn)`. */
function rootNameOf(expression: Readonly<ts.Expression>): string | null {
  if (ts.isIdentifier(expression)) return expression.text
  return ts.isCallExpression(expression) || ts.isPropertyAccessExpression(expression) ? rootNameOf(expression.expression) : null
}

function isEachCall({ expression }: Readonly<ts.CallExpression>): boolean {
  return ts.isPropertyAccessExpression(expression) && expression.name.text === EACH
}

function bodyOf(node: ts.Node): ts.Node | null {
  const isFunction = ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)
  return isFunction && node.body !== undefined ? node.body : null
}

function callsNow({ expression }: Readonly<ts.CallExpression>): boolean {
  return ts.isPropertyAccessExpression(expression) && CALLING_NOW.has(expression.name.text)
}

function isCalledNow(fn: ts.Node): boolean {
  const { parent } = fn
  return ts.isCallExpression(parent) && callsNow(parent) && parent.arguments.some((argument) => argument === fn)
}

/** What the call runs before it returns: its callee, and a function it hands to a method that calls it, `ids.map(codeOf)`. */
function calleesOf(call: Readonly<ts.CallExpression>): ts.Expression[] {
  const handed = callsNow(call) ? call.arguments.filter((argument) => ts.isIdentifier(argument) || ts.isPropertyAccessExpression(argument)) : []
  return [call.expression, ...handed]
}

function noReads(): Reads {
  return { verdictByFunction: new Map(), openReads: [], shallowestLeanByRead: new Map(), restingDepthByFunction: new Map() }
}

/** Each item's finds in order, the reads carried from one item to the next. */
function flatMapReading<Item extends ts.Node, Found>(items: readonly Item[], reads: Reads, findsIn: (item: Item, reads: Reads) => Read<readonly Found[]>): Read<Found[]> {
  const [first, ...rest] = items
  if (first === undefined) return [[], reads]
  const [foundInFirst, afterFirst] = findsIn(first, reads)
  const [foundInRest, afterRest] = flatMapReading(rest, afterFirst, findsIn)
  return [[...foundInFirst, ...foundInRest], afterRest]
}

/** Whether any item holds, read in order up to the first that does, the reads carried from one item to the next. */
function someReading<Item extends ts.Node>(items: readonly Item[], reads: Reads, holdsFor: (item: Item, reads: Reads) => Read<boolean>): Read<boolean> {
  return items.reduce<Read<boolean>>(([found, soFar], item) => (found ? [found, soFar] : holdsFor(item, soFar)), [false, reads])
}

function filterReading<Item extends ts.Node>(items: readonly Item[], reads: Reads, holdsFor: (item: Item, reads: Reads) => Read<boolean>): Read<Item[]> {
  return flatMapReading<Item, Item>(items, reads, (item, soFar) => {
    const [holds, after] = holdsFor(item, soFar)
    return [holds ? [item] : [], after]
  })
}

function withEntry<Key, Value>(entries: ReadonlyMap<Key, Value>, key: Key, value: Value): ReadonlyMap<Key, Value> {
  return new Map<Key, Value>([...entries, [key, value]])
}

function withoutEntry<Key, Value>(entries: ReadonlyMap<Key, Value>, key: Key): ReadonlyMap<Key, Value> {
  return new Map([...entries].filter(([entryKey]) => entryKey !== key))
}

function leanOn(depth: number, reads: Reads): Reads {
  const innermost = reads.openReads.at(-1)
  if (innermost === undefined) throw new Error('a read leaned on another while none was open')
  const shallowest = Math.min(depth, reads.shallowestLeanByRead.get(innermost) ?? depth)
  return { ...reads, shallowestLeanByRead: withEntry(reads.shallowestLeanByRead, innermost, shallowest) }
}

// What rests on a read reaches it through calls a throw would leave by, so its verdict is theirs.
function settledRestingOn(depth: number, canThrow: boolean, reads: Reads): Reads {
  const resting = [...reads.restingDepthByFunction]
  const settled = resting.filter(([, restingDepth]) => restingDepth >= depth).map(([fn]) => [fn, canThrow] as const)
  return {
    ...reads,
    verdictByFunction: new Map([...reads.verdictByFunction, ...settled]),
    restingDepthByFunction: new Map(resting.filter(([, restingDepth]) => restingDepth < depth)),
  }
}

// A read that closes resting on a shallower one passes that rest on to what rested on it.
function restPassedOn(depth: number, shallowest: number, reads: Reads): Reads {
  const passed = [...reads.restingDepthByFunction].map(([fn, restingDepth]) => [fn, restingDepth >= depth ? shallowest : restingDepth] as const)
  return { ...reads, restingDepthByFunction: new Map(passed) }
}

function withReadOpened(fn: ts.Node, reads: Reads): Reads {
  return { ...reads, openReads: [...reads.openReads, fn] }
}

/** The innermost read, which is the function's own, closed, and what it leaned on forgotten. */
function withReadClosed(fn: ts.Node, reads: Reads): Reads {
  return { ...reads, openReads: reads.openReads.slice(0, -1), shallowestLeanByRead: withoutEntry(reads.shallowestLeanByRead, fn) }
}

/** The function's verdict, and that of every function resting on its read. */
function withVerdictSettled(fn: ts.Node, canThrow: boolean, depth: number, reads: Reads): Reads {
  return settledRestingOn(depth, canThrow, { ...reads, verdictByFunction: withEntry(reads.verdictByFunction, fn, canThrow) })
}

/** Not throwing for now: the function, and what rested on its read, rest on the shallowest read it leaned on. */
function withVerdictResting(fn: ts.Node, { depth, shallowest }: { readonly depth: number; readonly shallowest: number }, reads: Reads): Reads {
  const resting: Reads = { ...reads, restingDepthByFunction: withEntry(reads.restingDepthByFunction, fn, shallowest) }
  return leanOn(shallowest, restPassedOn(depth, shallowest, resting))
}

// The depth of the open read a function's verdict waits on: its own read, still open, or one it rests on.
function restingDepthOf(fn: ts.Node, reads: Reads): number | undefined {
  const openAt = reads.openReads.indexOf(fn)
  return openAt === -1 ? reads.restingDepthByFunction.get(fn) : openAt
}

/** Reads, through the type checker, which functions of ours a call reaches and whether any of them throws. */
function throwFinderOf(checker: ts.TypeChecker, isOurs: (file: string) => boolean): ThrowFinder {
  function functionOf(callee: Readonly<ts.Expression>): ts.FunctionLikeDeclaration | null {
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
  function throwsUnder(node: ts.Node, inFunction: ts.Node, reads: Reads): Read<boolean> {
    if (ts.isThrowStatement(node)) return [true, reads]
    if (node !== inFunction && ts.isFunctionLike(node) && !isCalledNow(node)) return [false, reads]
    if (ts.isTryStatement(node) && node.catchClause !== undefined) {
      const lettingOut = [node.catchClause, node.finallyBlock].filter((part) => part !== undefined)
      return someReading(lettingOut, reads, (part, soFar) => throwsUnder(part, inFunction, soFar))
    }
    const [callThrows, afterTheCall]: Read<boolean> = ts.isCallExpression(node) ? someReading(calleesOf(node), reads, reachesAThrow) : [false, reads]
    if (callThrows) return [true, afterTheCall]
    return someReading(childNodesOf(node), afterTheCall, (child, soFar) => throwsUnder(child, inFunction, soFar))
  }

  // Settled once its read closes resting on no read still open; otherwise held until that read closes.
  function throwVerdictOnReading(fn: ts.Node, body: ts.Node, reads: Reads): Read<boolean> {
    const depth = reads.openReads.length
    const [canThrow, read] = throwsUnder(body, body, withReadOpened(fn, reads))
    const shallowest = read.shallowestLeanByRead.get(fn) ?? depth
    const closed = withReadClosed(fn, read)
    if (canThrow || shallowest >= depth) return [canThrow, withVerdictSettled(fn, canThrow, depth, closed)]
    return [canThrow, withVerdictResting(fn, { depth, shallowest }, closed)]
  }

  function reachesAThrow(callee: Readonly<ts.Expression>, reads: Reads): Read<boolean> {
    const fn = functionOf(callee)
    if (fn?.body === undefined) return [false, reads]
    const known = reads.verdictByFunction.get(fn)
    if (known !== undefined) return [known, reads]
    // A function called back into while it is read, or resting on one, counts as not throwing for now: a throw
    // there is found by the read still open.
    const restingDepth = restingDepthOf(fn, reads)
    if (restingDepth === undefined) return throwVerdictOnReading(fn, fn.body, reads)
    return [false, leanOn(restingDepth, reads)]
  }

  return reachesAThrow
}

/** Reads a module's statements as vitest runs them while it collects a test file: each call reaching a throw, in source order. */
function collectTimeThrowFinderOf(reachesAThrow: ThrowFinder): (file: Readonly<ts.SourceFile>, reads: Reads) => Read<CollectTimeThrow[]> {
  function inCall(call: Readonly<ts.CallExpression>, where: CollectTime, reads: Reads): Read<CollectTimeThrow[]> {
    const root = rootNameOf(call.expression)
    if (isEachCall(call)) return flatMapReading(call.arguments, reads, (argument, soFar) => throwsCollectedIn(argument, '.each table', soFar))
    if (root !== null && SUITES.has(root)) return inSuiteCall(call, where, reads)
    const [throwing, afterTheCallees] = filterReading(calleesOf(call), reads, reachesAThrow)
    const [inTheChildren, afterTheChildren] = flatMapReading(childNodesOf(call), afterTheCallees, (child, soFar) => throwsCollectedIn(child, where, soFar))
    return [[...throwing.map((callee) => ({ calls: callee.getText(), where })), ...inTheChildren], afterTheChildren]
  }

  // `describe(name, fn)`: its callee and arguments as they run, and the body of a function among them as vitest calls it.
  function inSuiteCall(call: Readonly<ts.CallExpression>, where: CollectTime, reads: Reads): Read<CollectTimeThrow[]> {
    const [inTheCallee, afterTheCallee] = throwsCollectedIn(call.expression, where, reads)
    const [inTheArguments, afterTheArguments] = flatMapReading(call.arguments, afterTheCallee, (argument, soFar) => {
      const body = bodyOf(argument)
      return body === null ? throwsCollectedIn(argument, where, soFar) : throwsCollectedIn(body, 'describe body', soFar)
    })
    return [[...inTheCallee, ...inTheArguments], afterTheArguments]
  }

  function throwsCollectedIn(node: ts.Node, where: CollectTime, reads: Reads): Read<CollectTimeThrow[]> {
    if (ts.isFunctionLike(node)) {
      const body = bodyOf(node)
      return body !== null && isCalledNow(node) ? throwsCollectedIn(body, where, reads) : [[], reads]
    }
    if (ts.isCallExpression(node)) return inCall(node, where, reads)
    return flatMapReading(childNodesOf(node), reads, (child, soFar) => throwsCollectedIn(child, where, soFar))
  }

  return (file, reads) =>
    flatMapReading(
      file.statements.filter((statement) => !ts.isImportDeclaration(statement)),
      reads,
      (statement, soFar) => throwsCollectedIn(statement, 'top level', soFar),
    )
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
export function collectTimeThrowsIn(sourceFile: Readonly<ts.SourceFile>, checker: ts.TypeChecker, isOurs: (file: string) => boolean): CollectTimeThrow[] {
  const collectTimeThrowsOf = collectTimeThrowFinderOf(throwFinderOf(checker, isOurs))
  const [inHelpers, afterTheHelpers] = flatMapReading(testHelpersLoadedBy(sourceFile, checker, isOurs), noReads(), (helper, reads) => {
    const [found, after] = collectTimeThrowsOf(helper, reads)
    return [found.map(writtenIn(helper)), after]
  })
  const [inTheFile] = collectTimeThrowsOf(sourceFile, afterTheHelpers)
  return [...inHelpers, ...inTheFile]
}
