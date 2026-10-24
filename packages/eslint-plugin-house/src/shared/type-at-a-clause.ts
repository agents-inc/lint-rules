import ts from 'typescript'

type NeverBinding = {
  readonly statement: ts.VariableStatement
  readonly value: ts.Expression
}

/**
 * The type TypeScript gives an expression bound by a never default at the start of `clause`, `const unhandled: never =
 * <expression>`, narrowed as it narrows a name there.
 */
export function typeAtTheStartOf(checker: ts.TypeChecker, clause: Readonly<ts.CaseOrDefaultClause>, expressionText: string): ts.Type {
  const value = neverBindingStandingAt(expressionText, clause, firstRunningStatementOf(clause))
  return checker.getTypeAtLocation(value)
}

// TypeScript's binder records on each of these statements the point in the code's flow it starts at, and nothing on a
// statement it reads as never run; a block or a declaration gets no record and leaves the flow where it was.
function recordsAFlowNode(statement: Readonly<ts.Statement>): boolean {
  return statement.kind >= ts.SyntaxKind.FirstStatement && statement.kind <= ts.SyntaxKind.LastStatement
}

// A class runs its heritage and an enum its initializers where they are declared, though TypeScript records no flow
// node on either declaration.
function runsWhereItIsDeclared(statement: Readonly<ts.Statement>): boolean {
  return ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement)
}

// The statements in the order they run, read through the blocks among them.
function statementsThroughBlocks(statements: readonly ts.Statement[]): readonly ts.Statement[] {
  return statements.flatMap((statement) => (ts.isBlock(statement) ? statementsThroughBlocks(statement.statements) : [statement]))
}

function firstRunningStatementOf(clause: Readonly<ts.CaseOrDefaultClause>): ts.Statement {
  const first = statementsThroughBlocks(clause.statements).find((statement) => recordsAFlowNode(statement) || runsWhereItIsDeclared(statement))
  if (first === undefined) throw new Error('the clause holds no statement that runs')
  return first
}

// TypeScript keeps the binder's record off its public types, so it is read as it is and handed on untouched.
function flowNodeOf(node: Readonly<ts.Node>): unknown {
  return 'flowNode' in node ? node.flowNode : undefined
}

// The first node in it that carries a flow node, in the order the binder walks them.
function firstFlowNodeIn(node: Readonly<ts.Node>): unknown {
  return ts.forEachChild(node, (child) => flowNodeOf(child) ?? firstFlowNodeIn(child))
}

// Where the statement starts in the code's flow: for a class or an enum, where its first name does (a decorator's, or
// its own), which the binder records before anything in the declaration runs.
function flowNodeAtTheStartOf(statement: Readonly<ts.Statement>): unknown {
  if (recordsAFlowNode(statement)) return flowNodeOf(statement)
  const flowNode = firstFlowNodeIn(statement)
  if (flowNode === undefined) throw new Error('TypeScript recorded no flow node in the declaration')
  return flowNode
}

function notOneExpression(text: string): Error {
  return new Error(`\`${text}\` does not parse as one expression`)
}

// Read against never, as a never default reads it, the value is narrowed through a type parameter's constraint.
function parsedNeverBinding(text: string, languageVersion: ts.ScriptTarget): NeverBinding {
  const [statement] = ts.createSourceFile('never-binding.ts', `const unhandled: never = ${text}`, languageVersion, true).statements
  if (statement === undefined || !ts.isVariableStatement(statement)) throw notOneExpression(text)
  const { declarations } = statement.declarationList
  const [declaration] = declarations
  // A comma would read as a second declaration.
  if (declarations.length !== 1 || declaration?.initializer === undefined) throw notOneExpression(text)
  return { statement, value: declaration.initializer }
}

// The nodes TypeScript narrows by the flow node they carry, as its binder marks them.
function isNarrowedByItsFlowNode(node: Readonly<ts.Node>): boolean {
  return ts.isIdentifier(node) || node.kind === ts.SyntaxKind.ThisKeyword || ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)
}

// Each node takes the range, so TypeScript's checks of where a name is used (before its declaration, after its last
// assignment) read it there; with an empty range TypeScript would take it for a node the parser made up.
function takeRange(node: ts.Node, range: Readonly<ts.TextRange>): void {
  ts.setTextRange(node, range)
  ts.forEachChild(node, (child) => {
    takeRange(child, range)
  })
}

function takeFlowNode(node: ts.Node, flowNode: unknown): void {
  if (isNarrowedByItsFlowNode(node)) Object.assign(node, { flowNode })
  ts.forEachChild(node, (child) => {
    takeFlowNode(child, flowNode)
  })
}

// The never binding, parsed apart and set where `start` stands: hung from the clause, so it reads names in the clause's
// scope, at the start's place in the text and in the code's flow.
function neverBindingStandingAt(text: string, clause: Readonly<ts.CaseOrDefaultClause>, start: Readonly<ts.Statement>): ts.Expression {
  const { statement, value } = parsedNeverBinding(text, clause.getSourceFile().languageVersion)
  Object.assign(statement, { parent: clause })
  takeRange(statement, { pos: start.getStart(), end: start.end })
  takeFlowNode(value, flowNodeAtTheStartOf(start))
  return value
}
