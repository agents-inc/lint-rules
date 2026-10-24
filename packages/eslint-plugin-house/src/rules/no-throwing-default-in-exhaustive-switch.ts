import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils'
import ts from 'typescript'

import { programWithTheFileRewritten } from '../shared/program-with-a-file-rewritten.ts'
import { typeAtTheStartOf } from '../shared/type-at-a-clause.ts'

type SwitchCaseWithStatements = Pick<TSESTree.SwitchCase, 'consequent'>

type MessageId =
  | 'throwingDefault'
  | 'throwingDefaultWhereNothingReturns'
  | 'throwingDefaultOnAValueToHoldInAConst'
  | 'throwingDefaultOnAValueToHoldInAConstWhereNothingReturns'

type Report = {
  readonly messageId: MessageId
  readonly data: Readonly<Record<string, string>>
}

// How a never default ends: returning the value it binds, or, where nothing can be returned, throwing after it.
type Ending = 'return' | 'throw'

// The const the rewrite asked about holds the switch's value in, numbered from 1 to a name the file does not use.
const NAME_OF_THE_CONST = 'switchedOn'

// What TypeScript checks where it stands, needing no symbol of its own, so a copy parsed apart can be asked about. A
// function, a class, an object literal, a type or a type assertion in a copy would throw, or leave errors and deferred
// checks in the program the rule shares.
const KINDS_CHECKED_WHERE_THEY_STAND: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.PropertyAccessExpression,
  ts.SyntaxKind.ElementAccessExpression,
  ts.SyntaxKind.NonNullExpression,
  ts.SyntaxKind.ParenthesizedExpression,
  ts.SyntaxKind.CallExpression,
  ts.SyntaxKind.BinaryExpression,
])

// The message suggesting a never default of each form, by how it ends.
const MESSAGE_BINDING_A_PART = { return: 'throwingDefault', throw: 'throwingDefaultWhereNothingReturns' } as const satisfies Record<Ending, MessageId>
const MESSAGE_BINDING_A_CONST = {
  return: 'throwingDefaultOnAValueToHoldInAConst',
  throw: 'throwingDefaultOnAValueToHoldInAConstWhereNothingReturns',
} as const satisfies Record<Ending, MessageId>

const MESSAGE_OPENING = 'This switch covers every case of its union, so this default runs only for a case added later, and the throw turns that into a runtime error.'

// A case's statements, read through the one block that often wraps them.
function statementsOf({ consequent }: Readonly<SwitchCaseWithStatements>): readonly TSESTree.Statement[] {
  const [only] = consequent
  return consequent.length === 1 && only?.type === AST_NODE_TYPES.BlockStatement ? only.body : consequent
}

function endsInAThrow(defaultCase: Readonly<SwitchCaseWithStatements>): boolean {
  return statementsOf(defaultCase).at(-1)?.type === AST_NODE_TYPES.ThrowStatement
}

function isNeverTyped(declarator: Readonly<TSESTree.VariableDeclarator>): boolean {
  return declarator.id.typeAnnotation?.typeAnnotation.type === AST_NODE_TYPES.TSNeverKeyword
}

// `const unhandled: never = x` keeps TypeScript's error for a missing case, whatever follows it.
function bindsToNever(defaultCase: Readonly<SwitchCaseWithStatements>): boolean {
  return statementsOf(defaultCase).some(
    (statement) => statement.type === AST_NODE_TYPES.VariableDeclaration && statement.declarations.some(isNeverTyped),
  )
}

/** A default that ends in a throw and binds nothing to never: the place a never default would take. */
function throwsInPlaceOfANeverDefault(defaultCase: Readonly<SwitchCaseWithStatements>): boolean {
  return endsInAThrow(defaultCase) && !bindsToNever(defaultCase)
}

function isNever(type: Readonly<ts.Type>): boolean {
  return (type.flags & ts.TypeFlags.Never) !== 0
}

function childrenOf(node: Readonly<ts.Node>): readonly ts.Node[] {
  const children: ts.Node[] = []
  ts.forEachChild(node, (child) => {
    children.push(child)
  })
  return children
}

// A name, `this`, a property, an element, a `!` or parentheses, but a name after a dot: what a never default can bind.
function isAPart(node: Readonly<ts.Node>): node is ts.Expression {
  const isANameAfterADot = ts.isPropertyAccessExpression(node.parent) && node.parent.name === node
  const isAReference =
    ts.isIdentifier(node) ||
    node.kind === ts.SyntaxKind.ThisKeyword ||
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node) ||
    ts.isNonNullExpression(node) ||
    ts.isParenthesizedExpression(node)
  return isAReference && !isANameAfterADot
}

// The parts of the switch's value, the value first where it is one, then each in it but those in a type, in the order
// written.
function partsIn(node: Readonly<ts.Node>): readonly ts.Expression[] {
  if (ts.isTypeNode(node)) return []
  const below = childrenOf(node).flatMap(partsIn)
  return isAPart(node) ? [node, ...below] : below
}

function isCheckedWhereItStands(node: Readonly<ts.Node>): boolean {
  return (ts.isToken(node) || KINDS_CHECKED_WHERE_THEY_STAND.has(node.kind)) && childrenOf(node).every(isCheckedWhereItStands)
}

// The objects it reads a property or an element of, each after those read in it.
function objectsReadIn(node: Readonly<ts.Node>): readonly ts.Expression[] {
  const below = childrenOf(node).flatMap(objectsReadIn)
  const isARead = ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)
  return isARead ? [...below, node.expression] : below
}

// The first part of the switch's value that TypeScript reads as never at the default. A part reading a property of an
// object TypeScript narrows there to never, or to null or undefined alone, does not compile, and is not asked about:
// TypeScript would keep its error in the program the rule shares.
function partNeverAtTheDefault(checker: ts.TypeChecker, defaultClause: Readonly<ts.CaseOrDefaultClause>, value: Readonly<ts.Expression>): ts.Expression | undefined {
  function typeAtTheDefault(node: Readonly<ts.Expression>): ts.Type {
    return typeAtTheStartOf(checker, defaultClause, node.getText())
  }
  function canBeReadOf(object: Readonly<ts.Expression>): boolean {
    return !isNever(checker.getNonNullableType(typeAtTheDefault(object)))
  }
  function isNeverAtTheDefault(part: Readonly<ts.Expression>): boolean {
    return isCheckedWhereItStands(part) && objectsReadIn(part).every(canBeReadOf) && isNever(typeAtTheDefault(part))
  }
  return partsIn(value).find(isNeverAtTheDefault)
}

function nameUnusedIn(text: string, number = 1): string {
  const name = `${NAME_OF_THE_CONST}${number}`
  return text.includes(name) ? nameUnusedIn(text, number + 1) : name
}

function defaultOfTheSwitchOn(node: Readonly<ts.Node>, name: string): ts.DefaultClause | undefined {
  return ts.forEachChild(node, (child) => {
    const isTheSwitch = ts.isSwitchStatement(child) && ts.isIdentifier(child.expression) && child.expression.text === name
    return isTheSwitch ? child.caseBlock.clauses.find(ts.isDefaultClause) : defaultOfTheSwitchOn(child, name)
  })
}

// The switch's value held in a const, the switch on the const, the two in a block of their own in place of the switch.
function textWithTheValueInAConst(switchStatement: Readonly<ts.SwitchStatement>, name: string): string {
  const { text } = switchStatement.getSourceFile()
  const value = switchStatement.expression
  const switchStart = switchStatement.getStart()
  return [
    text.slice(0, switchStart),
    `{ const ${name} = (${value.getText()});\n`,
    text.slice(switchStart, value.getStart()),
    name,
    text.slice(value.end, switchStatement.end),
    '\n}',
    text.slice(switchStatement.end),
  ].join('')
}

function errorsIn(program: Readonly<ts.Program>, sourceFile: Readonly<ts.SourceFile>): readonly string[] {
  return [...program.getSyntacticDiagnostics(sourceFile), ...program.getSemanticDiagnostics(sourceFile)]
    .filter(({ category }) => category === ts.DiagnosticCategory.Error)
    .map(({ code, messageText }) => `TS${code}: ${ts.flattenDiagnosticMessageText(messageText, '\n')}`)
}

function timesIn(errors: readonly string[], error: string): number {
  return errors.filter((each) => each === error).length
}

function addsAnError(written: readonly string[], rewritten: readonly string[]): boolean {
  return rewritten.some((error) => timesIn(rewritten, error) > timesIn(written, error))
}

// TypeScript narrows nothing to never in some values, a call among them, yet narrows a const holding the value as it
// narrows a name. Asked of a program holding the file so rewritten: the const must be never at the default, and the
// rewrite add no type error to the file, as where a case read a value the switch's own value narrowed.
function doesANeverDefaultOnAConstCompile(program: Readonly<ts.Program>, switchStatement: Readonly<ts.SwitchStatement>): boolean {
  const sourceFile = switchStatement.getSourceFile()
  const name = nameUnusedIn(sourceFile.text)
  const rewritten = programWithTheFileRewritten(program, sourceFile.fileName, textWithTheValueInAConst(switchStatement, name))
  const defaultClause = defaultOfTheSwitchOn(rewritten.sourceFile, name)
  if (defaultClause === undefined) throw new Error(`the rewrite of ${sourceFile.fileName} holds no default of a switch on ${name}`)
  const isNeverThere = isNever(typeAtTheStartOf(rewritten.program.getTypeChecker(), defaultClause, name))
  return isNeverThere && !addsAnError(errorsIn(program, sourceFile), errorsIn(rewritten.program, rewritten.sourceFile))
}

// The function, class static block, namespace body or file a statement runs in.
function bodyItRunsIn(node: Readonly<ts.Node>): ts.Node {
  const { parent } = node
  const isABody = ts.isFunctionLike(parent) || ts.isClassStaticBlockDeclaration(parent) || ts.isModuleBlock(parent) || ts.isSourceFile(parent)
  return isABody ? parent : bodyItRunsIn(parent)
}

// A file's top level, a class static block or a setter, where `return unhandled` does not compile. A namespace body is
// not a file's top level.
function isWhereNothingReturns(switchStatement: Readonly<ts.SwitchStatement>): boolean {
  const body = bodyItRunsIn(switchStatement)
  return ts.isSourceFile(body) || ts.isClassStaticBlockDeclaration(body) || ts.isSetAccessorDeclaration(body)
}

function endingOfANeverDefaultIn(switchStatement: Readonly<ts.SwitchStatement>): Ending {
  return isWhereNothingReturns(switchStatement) ? 'throw' : 'return'
}

// The never default to suggest in place of the throwing one, of the first form TypeScript compiles: binding a part of
// the switch's value, then binding a const holding the value; none where neither compiles.
function reportSuggestingANeverDefault(program: Readonly<ts.Program>, switchStatement: Readonly<ts.SwitchStatement>, defaultClause: Readonly<ts.CaseOrDefaultClause>): Report | null {
  const ending = endingOfANeverDefaultIn(switchStatement)
  const part = partNeverAtTheDefault(program.getTypeChecker(), defaultClause, switchStatement.expression)
  if (part !== undefined) return { messageId: MESSAGE_BINDING_A_PART[ending], data: { discriminant: part.getText() } }
  if (!doesANeverDefaultOnAConstCompile(program, switchStatement)) return null
  return { messageId: MESSAGE_BINDING_A_CONST[ending], data: { value: switchStatement.expression.getText() } }
}

export const noThrowingDefaultInExhaustiveSwitch = ESLintUtils.RuleCreator.withoutDocs<[], MessageId>({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow a default that throws in a switch covering every case of a union; a never default keeps a missing case a type error',
    },
    messages: {
      throwingDefault: `${MESSAGE_OPENING} End it in \`default: { const unhandled: never = {{discriminant}}; return unhandled }\`, so a missing case stays a type error.`,
      throwingDefaultWhereNothingReturns: `${MESSAGE_OPENING} Start it with \`const unhandled: never = {{discriminant}}\` before the throw (nothing can be returned here), so a missing case stays a type error.`,
      throwingDefaultOnAValueToHoldInAConst: `${MESSAGE_OPENING} TypeScript narrows nothing in \`{{value}}\` to never here: hold it in a const, switch on the const, and end the switch in \`default: { const unhandled: never = <the const>; return unhandled }\`, so a missing case stays a type error.`,
      throwingDefaultOnAValueToHoldInAConstWhereNothingReturns: `${MESSAGE_OPENING} TypeScript narrows nothing in \`{{value}}\` to never here: hold it in a const, switch on the const, and start the default with \`const unhandled: never = <the const>\` before the throw (nothing can be returned here), so a missing case stays a type error.`,
    },
    schema: [],
    defaultOptions: [],
  },
  create(context) {
    const services = ESLintUtils.getParserServices(context, true)
    // Without type information there is no union to cover.
    if (services.program === null) return {}
    const { program } = services
    return {
      'SwitchStatement:exit'(node) {
        const defaultCase = node.cases.find(({ test }) => test === null)
        if (defaultCase === undefined || !throwsInPlaceOfANeverDefault(defaultCase)) return
        const report = reportSuggestingANeverDefault(program, services.esTreeNodeToTSNodeMap.get(node), services.esTreeNodeToTSNodeMap.get(defaultCase))
        if (report !== null) context.report({ node: defaultCase, ...report })
      },
    }
  },
})
