import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import * as typescriptEslintParser from '@typescript-eslint/parser'
import { TSESLint } from '@typescript-eslint/utils'
import ts from 'typescript'
import { beforeAll, describe, expect, it, onTestFinished } from 'vitest'

import { projectHoldingAPackageInstalledTwice, projectReferencingABuiltProject } from '../__tests__/cases/no-throwing-default-in-exhaustive-switch-projects.ts'
import * as cases from '../__tests__/cases/no-throwing-default-in-exhaustive-switch.ts'
import { repoOwnPlugin } from '../repo-own-plugin.ts'

type CaseName = keyof typeof cases

// Each case's text by its name, for a test whose rows name the cases.
const CASE_TEXTS: Readonly<Record<CaseName, string>> = cases

type ProjectOnDisk = typeof projectHoldingAPackageInstalledTwice

type Report = Pick<TSESLint.Linter.LintMessage, 'ruleId' | 'line' | 'message'>

type CaseOnItsOwn = {
  readonly program: ts.Program
  readonly folder: string
  readonly path: string
}

type NeverBinding = (discriminant: Readonly<ts.Expression>, sourceFile: Readonly<ts.SourceFile>) => string

// How a never default ends: returning the value it binds, or, where nothing can be returned, throwing after it.
type Ending = 'return' | 'throw'

type NeverDefault = {
  readonly text: string
  // The message at each default, were the rule to suggest this never default there.
  readonly messages: readonly string[]
}

type NeverDefaultFile = NeverDefault & { readonly path: string }

type Edit = { readonly start: number; readonly end: number; readonly replacement: string }

type CaseVerdicts = {
  readonly failingAsWritten: readonly string[]
  readonly notLinted: readonly string[]
  readonly reported: readonly string[]
  readonly compilingWithANeverDefault: readonly string[]
  readonly reportedSuggestingNoNeverDefaultOfTheFirstFormThatCompiles: readonly string[]
}

const RULE_ID = 'house-repo/no-throwing-default-in-exhaustive-switch'

// The rule asks nothing of a default that does not throw in place of a never default, so whether a never default
// would compile there says nothing of the rule.
const CASES_WITH_NO_DEFAULT_THROWING_IN_PLACE_OF_A_NEVER_DEFAULT: readonly CaseName[] = [
  'neverBindingAfterAnotherDeclaratorThenThrow',
  'neverBindingThenThrow',
  'neverBindingThenThrowAtTheTopLevelOfAFile',
  'neverBindingThenThrowInAClassStaticBlock',
  'neverBindingThenThrowInASetter',
  'neverDefaultAfterEveryCase',
  'neverDefaultAfterEveryCaseOfABrandedUnion',
  'neverDefaultOnACommaExpression',
  'neverDefaultOnAConstHoldingACall',
  'neverDefaultOnADiscriminant',
  'neverDefaultOnADiscriminantReadAsAnElement',
  'neverDefaultOnADiscriminantReadThroughAnOptionalChain',
  'neverDefaultOnAGenericPropertyOfThis',
  'neverDefaultOnAGenericValue',
  'neverDefaultOnAGenericValueUsedAsAKey',
  'neverDefaultOnANestedProperty',
  'neverDefaultOnANonNullAssertionOnAValueThatCannotBeNull',
  'neverDefaultOnAPropertyOfAUnionItDoesNotTellApart',
  'neverDefaultOnAPropertyOfAUnionItPartlyTellsApart',
  'neverDefaultOnAPropertyOfAnObject',
  'neverDefaultOnAPropertyOfSuper',
  'neverDefaultOnAnAssignment',
  'neverDefaultOnAnElementOfAnObject',
  'neverDefaultOnAnElementWithAConstKey',
  'neverDefaultOnAnElementWithATemplateKey',
  'neverDefaultOnAnElementWithAUniqueSymbolKey',
  'neverDefaultOnAnOptionalPropertyAfterEveryCaseAndUndefined',
  'neverDefaultOnTheDiscriminantOfAGenericUnion',
  'neverDefaultOnTheDiscriminantOfANestedUnion',
  'neverDefaultOnTheDiscriminantOfANonNullAssertedUnion',
  'neverDefaultOnTheDiscriminantOfANonNullAssertedUnionThatCanBeUndefined',
  'neverDefaultOnTheDiscriminantOfThis',
  'noDefaultAfterEveryCase',
  'returningDefaultAfterEveryCase',
]

// The const the never defaults of the last two forms hold the switch's value in.
const CONST_HOLDING_THE_VALUE = 'switchedOn'

// Typing and linting every case in each form, two of them of thousands of cases, takes seconds: too near vitest's
// default 5 s on a loaded machine.
const EVERY_CASE_TIMEOUT_MS = 60_000

// Cases whose switch's value, whose default, or another of whose cases declares a name: where the never default would
// stand, TypeScript finds no such name, finds it before its declaration, or finds that case's. Beside them, values
// holding a function, an object literal or a type that declare no name of their own, and defaults declaring another
// name, or the name in a block of their own.
const CASES_DECLARING_A_NAME: readonly CaseName[] = [
  'throwingDefaultOnACallTakingAnArrowWithAParameter',
  'throwingDefaultOnACallTakingAFunctionWithAParameter',
  'throwingDefaultOnAPropertyOfAnObjectLiteralWithAKey',
  'throwingDefaultOnAPropertyOfAnInstanceOfAClassExpression',
  'throwingDefaultOnAPropertyOfAnInstanceOfAClassExpressionWithAParameterProperty',
  'throwingDefaultDeclaringTheNameItsSwitchTests',
  'throwingDefaultDeclaringTheNameItsSwitchTestsWithALet',
  'throwingDefaultDeclaringAFunctionOfTheNameItsSwitchTests',
  'throwingDefaultDeclaringAClassOfTheNameItsSwitchTests',
  'throwingDefaultDeclaringTheObjectOfThePropertyItsSwitchTests',
  'throwingDefaultOnACallDeclaringANameTheCallReads',
  'throwingDefaultDeclaringTheNameItsSwitchTestsInASwitchAfterAReturn',
  'caseFallingIntoAThrowingDefaultDeclaringTheNameItsSwitchTests',
  'throwingDefaultOnAPropertyOfACallTakingAnArrow',
  'throwingDefaultOnAPropertyOfACallWithAnObjectLiteral',
  'throwingDefaultOnAPropertyOfACallWithATypeArgument',
  'throwingDefaultDeclaringAnotherName',
  'throwingDefaultBlockDeclaringTheNameItsSwitchTests',
  'throwingDefaultAfterACaseDeclaringTheNameItsSwitchTests',
  'throwingDefaultBeforeACaseDeclaringTheNameItsSwitchTests',
  'throwingDefaultAfterACaseDeclaringTheObjectOfThePropertyTheSwitchTests',
]

const TEMP_PROJECT_PREFIX = 'house-no-throwing-default-'

const MESSAGE_OPENING =
  'This switch covers every case of its union, so this default runs only for a case added later, and the throw turns that into a runtime error.'

// The rule's messages, written out here rather than read from the rule, so a change to their text fails a test.
function messageSuggesting(binding: string): string {
  return `${MESSAGE_OPENING} End it in \`default: { const unhandled: never = ${binding}; return unhandled }\`, so a missing case stays a type error.`
}

function messageSuggestingTheBindingBeforeTheThrow(binding: string): string {
  return `${MESSAGE_OPENING} Start it with \`const unhandled: never = ${binding}\` before the throw (nothing can be returned here), so a missing case stays a type error.`
}

function messageSuggestingAConst(value: string): string {
  return `${MESSAGE_OPENING} TypeScript narrows nothing in \`${value}\` to never here: hold it in a const, switch on the const, and end the switch in \`default: { const unhandled: never = <the const>; return unhandled }\`, so a missing case stays a type error.`
}

function messageSuggestingAConstBoundBeforeTheThrow(value: string): string {
  return `${MESSAGE_OPENING} TypeScript narrows nothing in \`${value}\` to never here: hold it in a const, switch on the const, and start the default with \`const unhandled: never = <the const>\` before the throw (nothing can be returned here), so a missing case stays a type error.`
}

function typedProjectFolder(): string {
  return fileURLToPath(new URL('../__tests__/typed-project/', import.meta.url))
}

function throwUnreadableConfig(diagnostic: Readonly<ts.Diagnostic>): never {
  throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
}

// The options the rule tester types every case with, but its fallthrough error: a case falling into its default is
// what the rule asks about, so that error would fail such a case as written, and the never binding fails it anyway.
function compilerOptionsOfTheTypedProject(folder: string): ts.CompilerOptions {
  const tsconfig = join(folder, 'tsconfig.json')
  const parsed = ts.getParsedCommandLineOfConfigFile(tsconfig, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: throwUnreadableConfig })
  if (parsed === undefined) throw new Error(`${tsconfig} could not be read`)
  return { ...parsed.options, noFallthroughCasesInSwitch: false }
}

// The value the switch tests.
function theDiscriminant(discriminant: Readonly<ts.Expression>, sourceFile: Readonly<ts.SourceFile>): string {
  return discriminant.getText(sourceFile)
}

// For a switch on a property, read with a dot or as an element, the object holding it. Where that object is a union the
// property tells apart, TypeScript narrows the object to never at the default, so `shape.kind` there is a property of
// never and fails to compile, while `shape` compiles.
function theObjectOfAProperty(discriminant: Readonly<ts.Expression>, sourceFile: Readonly<ts.SourceFile>): string {
  const isAProperty = ts.isPropertyAccessExpression(discriminant) || ts.isElementAccessExpression(discriminant)
  return (isAProperty ? discriminant.expression : discriminant).getText(sourceFile)
}

// For a switch on an assignment, `=`, `??=` and the rest, the name assigned to, which TypeScript narrows at the default;
// the assignment there would run again, at its declared type.
function theNameAssigned(discriminant: Readonly<ts.Expression>, sourceFile: Readonly<ts.SourceFile>): string {
  const isAnAssignment =
    ts.isBinaryExpression(discriminant) &&
    discriminant.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
    discriminant.operatorToken.kind <= ts.SyntaxKind.LastAssignment
  return (isAnAssignment ? discriminant.left : discriminant).getText(sourceFile)
}

// The value under parentheses, `!`, or a comma's last operand, which TypeScript narrows as it narrows the value itself.
function unwrapped(expression: Readonly<ts.Expression>): Readonly<ts.Expression> {
  if (ts.isParenthesizedExpression(expression) || ts.isNonNullExpression(expression)) return unwrapped(expression.expression)
  const isAComma = ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.CommaToken
  return isAComma ? unwrapped(expression.right) : expression
}

// For a switch on `engine!` or `(note(), engine)`, the value inside: `engine`.
function theValueUnwrapped(discriminant: Readonly<ts.Expression>, sourceFile: Readonly<ts.SourceFile>): string {
  return unwrapped(discriminant).getText(sourceFile)
}

// For a switch on a property of a value under `!`, `shape!.kind`, the object inside: `shape`.
function theObjectOfAPropertyUnwrapped(discriminant: Readonly<ts.Expression>, sourceFile: Readonly<ts.SourceFile>): string {
  const value = unwrapped(discriminant)
  const isAProperty = ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value)
  return (isAProperty ? unwrapped(value.expression) : value).getText(sourceFile)
}

const NEVER_BINDINGS: readonly NeverBinding[] = [theDiscriminant, theObjectOfAProperty, theNameAssigned, theValueUnwrapped, theObjectOfAPropertyUnwrapped]

function isAReferenceCandidate(node: Readonly<ts.Node>): boolean {
  const isANameAfterADot = ts.isPropertyAccessExpression(node.parent) && node.parent.name === node
  const isAReferenceKind =
    ts.isIdentifier(node) ||
    node.kind === ts.SyntaxKind.ThisKeyword ||
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node) ||
    ts.isNonNullExpression(node) ||
    ts.isParenthesizedExpression(node)
  return isAReferenceKind && !isANameAfterADot
}

function referenceCandidatesIn(node: Readonly<ts.Node>, sourceFile: Readonly<ts.SourceFile>): readonly string[] {
  if (ts.isTypeNode(node)) return []
  const below = node.getChildren(sourceFile).flatMap((child) => referenceCandidatesIn(child, sourceFile))
  return isAReferenceCandidate(node) ? [node.getText(sourceFile), ...below] : below
}

// What TypeScript may narrow by a switch on the value, as the reviews' harness tries it: the value itself, then each
// name, `this`, property, element, `!` and parenthesised expression in it, but a name after a dot, in the order written.
function candidateReferencesOf(discriminant: Readonly<ts.Expression>, sourceFile: Readonly<ts.SourceFile>): readonly string[] {
  return [...new Set([discriminant.getText(sourceFile), ...referenceCandidatesIn(discriminant, sourceFile)])]
}

// The candidate at `index` in each default's switch, or the value itself where the switch has no more.
function theCandidateReferenceAt(index: number): NeverBinding {
  return (discriminant, sourceFile) => candidateReferencesOf(discriminant, sourceFile)[index] ?? discriminant.getText(sourceFile)
}

function defaultClausesIn(node: ts.Node, sourceFile: Readonly<ts.SourceFile>): readonly ts.DefaultClause[] {
  const below = node.getChildren(sourceFile).flatMap((child) => defaultClausesIn(child, sourceFile))
  return ts.isDefaultClause(node) ? [node, ...below] : below
}

function candidateReferencesAtEachDefault(text: string): ReadonlyArray<readonly string[]> {
  const sourceFile = ts.createSourceFile('case.ts', text, ts.ScriptTarget.Latest, true)
  return defaultClausesIn(sourceFile, sourceFile).map((clause) => candidateReferencesOf(clause.parent.parent.expression, sourceFile))
}

// The named bindings, then each candidate in turn, at every default.
function bindingsOfEveryDefault(text: string): readonly NeverBinding[] {
  const most = Math.max(0, ...candidateReferencesAtEachDefault(text).map((candidates) => candidates.length))
  return [...NEVER_BINDINGS, ...Array.from({ length: most }, (_, index) => theCandidateReferenceAt(index))]
}

function indentAt(sourceFile: Readonly<ts.SourceFile>, position: number): string {
  return ' '.repeat(sourceFile.getLineAndCharacterOfPosition(position).character)
}

function neverDefaultWritten(bound: string, indent: string, ending: Ending): string {
  const last = ending === 'return' ? 'return unhandled' : 'throw new Error(String(unhandled))'
  return ['default: {', `${indent}  const unhandled: never = ${bound}`, `${indent}  ${last}`, `${indent}}`].join('\n')
}

// Each default, none inside another, written as a never default binding what `binding` names, at the default's indent.
function withNeverDefaults(text: string, binding: NeverBinding, ending: Ending = 'return'): string {
  const sourceFile = ts.createSourceFile('case.ts', text, ts.ScriptTarget.Latest, true)
  return defaultClausesIn(sourceFile, sourceFile).reduceRight((rewritten, clause) => {
    const start = clause.getStart(sourceFile)
    const neverDefault = neverDefaultWritten(binding(clause.parent.parent.expression, sourceFile), indentAt(sourceFile, start), ending)
    return `${rewritten.slice(0, start)}${neverDefault}${rewritten.slice(clause.end)}`
  }, text)
}

// Each switch with a default on a const declared just before it, holding its value, and that default a never default
// binding the const.
function withAConstSwitchedOn(text: string, ending: Ending): string {
  const sourceFile = ts.createSourceFile('case.ts', text, ts.ScriptTarget.Latest, true)
  const edits = defaultClausesIn(sourceFile, sourceFile).flatMap((clause): readonly Edit[] => {
    const switchStatement = clause.parent.parent
    const switchStart = switchStatement.getStart(sourceFile)
    const value = switchStatement.expression
    const clauseStart = clause.getStart(sourceFile)
    return [
      { start: switchStart, end: switchStart, replacement: `const ${CONST_HOLDING_THE_VALUE} = ${value.getText(sourceFile)}\n${indentAt(sourceFile, switchStart)}` },
      { start: value.getStart(sourceFile), end: value.end, replacement: CONST_HOLDING_THE_VALUE },
      { start: clauseStart, end: clause.end, replacement: neverDefaultWritten(CONST_HOLDING_THE_VALUE, indentAt(sourceFile, clauseStart), ending) },
    ]
  })
  return edits.toSorted((first, second) => second.start - first.start).reduce((rewritten, { start, end, replacement }) => `${rewritten.slice(0, start)}${replacement}${rewritten.slice(end)}`, text)
}

// What `binding` names at each default, in the order the defaults are written.
function bindingsAtEachDefault(text: string, binding: NeverBinding): readonly string[] {
  const sourceFile = ts.createSourceFile('case.ts', text, ts.ScriptTarget.Latest, true)
  return defaultClausesIn(sourceFile, sourceFile).map((clause) => binding(clause.parent.parent.expression, sourceFile))
}

function neverDefaultBinding(text: string, binding: NeverBinding, ending: Ending): NeverDefault {
  const message = ending === 'return' ? messageSuggesting : messageSuggestingTheBindingBeforeTheThrow
  return { text: withNeverDefaults(text, binding, ending), messages: bindingsAtEachDefault(text, binding).map(message) }
}

// Each binding's never default, ending as given, written once.
function neverDefaultsEnding(text: string, ending: Ending): readonly NeverDefault[] {
  const byText = new Map(bindingsOfEveryDefault(text).map((binding) => neverDefaultBinding(text, binding, ending)).map((neverDefault) => [neverDefault.text, neverDefault] as const))
  return byText.values().toArray()
}

// Each binding's never default that returns what it binds, written once.
function neverDefaultsOf(text: string): readonly NeverDefault[] {
  return neverDefaultsEnding(text, 'return')
}

function neverDefaultOnAConst(text: string, ending: Ending): NeverDefault {
  const message = ending === 'return' ? messageSuggestingAConst : messageSuggestingAConstBoundBeforeTheThrow
  return { text: withAConstSwitchedOn(text, ending), messages: bindingsAtEachDefault(text, theDiscriminant).map(message) }
}

// The never defaults the rule may suggest, in the order of the forms it prefers: binding a part of the value and
// returning it, binding it before the throw, then each of those on a const holding the value.
function neverDefaultFormsOf(text: string): ReadonlyArray<readonly NeverDefault[]> {
  return [neverDefaultsEnding(text, 'return'), neverDefaultsEnding(text, 'throw'), [neverDefaultOnAConst(text, 'return')], [neverDefaultOnAConst(text, 'throw')]]
}

// The files given are read from memory, by absolute path; every other file, the default library's, from disk.
function programOf(files: ReadonlyMap<string, string>, options: Readonly<ts.CompilerOptions>): ts.Program {
  const host = ts.createCompilerHost(options, true)
  const inMemory: ts.CompilerHost = {
    ...host,
    fileExists(path) {
      return files.has(path) || host.fileExists(path)
    },
    readFile(path) {
      return files.get(path) ?? host.readFile(path)
    },
    getSourceFile(path, languageVersion, onError, shouldCreateNewSourceFile) {
      const text = files.get(path)
      return text === undefined ? host.getSourceFile(path, languageVersion, onError, shouldCreateNewSourceFile) : ts.createSourceFile(path, text, languageVersion, true)
    },
  }
  return ts.createProgram({ rootNames: files.keys().toArray(), options, host: inMemory })
}

// TypeScript reads a file's errors once, the first time it is asked, and answers the same after.
function typeErrorsIn(program: ts.Program, path: string): readonly string[] {
  const sourceFile = program.getSourceFile(path)
  if (sourceFile === undefined) throw new Error(`the program holds no ${path}`)
  return [...program.getSyntacticDiagnostics(sourceFile), ...program.getSemanticDiagnostics(sourceFile)]
    .filter(({ category }) => category === ts.DiagnosticCategory.Error)
    .map(({ code, messageText }) => `TS${code} ${ts.flattenDiagnosticMessageText(messageText, ' ')}`)
}

function hasTypeErrors(program: ts.Program, path: string): boolean {
  return typeErrorsIn(program, path).length > 0
}

// The rule as this repo's own config runs it, typed by the program given rather than by a tsconfig.
function messagesOfTheRule(program: ts.Program, folder: string, path: string, text: string): readonly TSESLint.Linter.LintMessage[] {
  const linter = new TSESLint.Linter({ configType: 'flat', cwd: folder })
  const config: TSESLint.FlatConfig.Config = {
    files: ['**/*.ts'],
    languageOptions: { parser: typescriptEslintParser, parserOptions: { programs: [program] } },
    plugins: { 'house-repo': repoOwnPlugin },
    rules: { [RULE_ID]: 'error' },
  }
  return linter.verify(text, [config], path)
}

function reportsIn(messages: readonly TSESLint.Linter.LintMessage[]): readonly Report[] {
  return messages.map(({ ruleId, line, message }) => ({ ruleId, line, message }))
}

// One case, typed on its own by a program of its own.
function theCaseOnItsOwn(text: string): CaseOnItsOwn {
  const folder = join(typedProjectFolder(), 'the-message')
  const path = join(folder, 'case.ts')
  return { program: programOf(new Map([[path, text]]), compilerOptionsOfTheTypedProject(typedProjectFolder())), folder, path }
}

// The rule's reports on one case, typed on its own.
function reportsOn(text: string): readonly Report[] {
  const { program, folder, path } = theCaseOnItsOwn(text)
  return reportsIn(messagesOfTheRule(program, folder, path, text))
}

// The type errors TypeScript gives one case, typed on its own, the rule never run.
function typeErrorsOfTheCase(text: string): readonly string[] {
  const { program, path } = theCaseOnItsOwn(text)
  return typeErrorsIn(program, path)
}

// The type errors in the program the rule linted the case through, read for the first time after it did.
function typeErrorsAfterTheRuleLints(text: string): readonly string[] {
  const { program, folder, path } = theCaseOnItsOwn(text)
  messagesOfTheRule(program, folder, path, text)
  return typeErrorsIn(program, path)
}

// The project written to a folder of its own, removed once the test finishes.
function folderHolding(project: ProjectOnDisk): string {
  const folder = realpathSync(mkdtempSync(join(tmpdir(), TEMP_PROJECT_PREFIX)))
  onTestFinished(() => {
    rmSync(folder, { recursive: true, force: true })
  })
  for (const [path, text] of Object.entries(project.files)) {
    mkdirSync(dirname(join(folder, path)), { recursive: true })
    writeFileSync(join(folder, path), text)
  }
  return folder
}

// The program the project's tsconfig builds, as `tsc` builds it.
function programOfTheProjectIn(folder: string, project: ProjectOnDisk): ts.Program {
  const tsconfig = join(folder, project.configFolder, 'tsconfig.json')
  const parsed = ts.getParsedCommandLineOfConfigFile(tsconfig, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: throwUnreadableConfig })
  if (parsed === undefined) throw new Error(`${tsconfig} could not be read`)
  const { fileNames, options, projectReferences } = parsed
  return ts.createProgram({ rootNames: fileNames, options, ...(projectReferences !== undefined && { projectReferences }) })
}

function reportsOnTheProjectIn(folder: string, project: ProjectOnDisk, program: ts.Program): readonly Report[] {
  const path = join(folder, project.linted)
  return reportsIn(messagesOfTheRule(program, folder, path, readFileSync(path, 'utf8')))
}

// The files of the project the program holds, each by the name it holds it by, from the project's folder.
function namesOfTheProjectsFilesIn(program: ts.Program, folder: string): readonly string[] {
  return program
    .getSourceFiles()
    .map(({ fileName }) => relative(folder, fileName))
    .filter((name) => !name.startsWith('..'))
}

// TypeScript keeps a redirect off its public types: it stands for a package installed again at one version.
function holdsARedirect(program: ts.Program): boolean {
  return program.getSourceFiles().some((sourceFile) => 'redirectInfo' in sourceFile && sourceFile.redirectInfo !== undefined)
}

// The rule names this never default at each default, and reports no other.
function isSuggestedBy(neverDefault: NeverDefault, messages: readonly TSESLint.Linter.LintMessage[]): boolean {
  const reports = messages.filter(({ ruleId }) => ruleId === RULE_ID).map(({ message }) => message)
  return isDeepStrictEqual(reports, neverDefault.messages)
}

// One program types every case as written and, where its default throws in place of a never default, with never
// defaults of each form instead; the rule lints each case as written through the same program.
function verdictsOfEveryCase(): CaseVerdicts {
  const folder = join(typedProjectFolder(), 'cases-against-typescript')
  const notAsked: ReadonlySet<string> = new Set(CASES_WITH_NO_DEFAULT_THROWING_IN_PLACE_OF_A_NEVER_DEFAULT)
  const everyCase = Object.entries(cases).map(([name, text]) => ({ name, text, asWritten: join(folder, `${name}.ts`) }))
  const asked = everyCase
    .filter(({ name }) => !notAsked.has(name))
    .map((each) => ({
      ...each,
      forms: neverDefaultFormsOf(each.text).map((form, formIndex): readonly NeverDefaultFile[] =>
        form.map((neverDefault, index) => ({ ...neverDefault, path: join(folder, `${each.name}.form-${formIndex}.never-${index}.ts`) })),
      ),
    }))
  const program = programOf(
    new Map([
      ...everyCase.map(({ asWritten, text }) => [asWritten, text] as const),
      ...asked.flatMap(({ forms }) => forms.flat().map(({ path, text }) => [path, text] as const)),
    ]),
    compilerOptionsOfTheTypedProject(typedProjectFolder()),
  )
  function doesCompile({ path }: NeverDefaultFile): boolean {
    return !hasTypeErrors(program, path)
  }
  // The never defaults that compile, of the first form any of whose never defaults does.
  function compilingOfTheFirstFormThatCompiles(forms: ReadonlyArray<readonly NeverDefaultFile[]>): readonly NeverDefaultFile[] {
    const firstThatCompiles = forms.find((form) => form.some(doesCompile))
    return firstThatCompiles === undefined ? [] : firstThatCompiles.filter(doesCompile)
  }
  const linted = asked.map(({ name, text, asWritten, forms }) => ({ name, forms, messages: messagesOfTheRule(program, folder, asWritten, text) }))
  const reported = linted.filter(({ messages }) => messages.some(({ ruleId }) => ruleId === RULE_ID))
  return {
    failingAsWritten: everyCase.filter(({ asWritten }) => hasTypeErrors(program, asWritten)).map(({ name }) => name),
    notLinted: linted.filter(({ messages }) => messages.some(({ ruleId }) => ruleId === null)).map(({ name }) => name),
    reported: reported.map(({ name }) => name),
    compilingWithANeverDefault: asked.filter(({ forms }) => forms.flat().some(doesCompile)).map(({ name }) => name),
    reportedSuggestingNoNeverDefaultOfTheFirstFormThatCompiles: reported
      .filter(({ messages, forms }) => compilingOfTheFirstFormThatCompiles(forms).every((neverDefault) => !isSuggestedBy(neverDefault, messages)))
      .map(({ name }) => name),
  }
}

describe('no-throwing-default-in-exhaustive-switch, against TypeScript', () => {
  describe('the never default written in place of each default', () => {
    it('replaces a default that throws', () => {
      expect(withNeverDefaults(cases.throwingDefaultAfterEveryCase, theDiscriminant)).toStrictEqual(cases.neverDefaultAfterEveryCase)
    })

    it('replaces a default block ending in a throw, the whole block', () => {
      expect(withNeverDefaults(cases.throwingDefaultInABlock, theDiscriminant)).toStrictEqual(cases.neverDefaultAfterEveryCase)
    })

    it('binds the value its own switch tests', () => {
      expect(withNeverDefaults(cases.throwingDefaultOnADiscriminant, theDiscriminant)).toContain('const unhandled: never = shape.kind\n')
    })

    it('binds, in its second form, the object holding the property its switch tests', () => {
      expect(withNeverDefaults(cases.throwingDefaultOnADiscriminant, theObjectOfAProperty)).toContain('const unhandled: never = shape\n')
    })

    it('binds, in its second form, the object holding the element its switch tests', () => {
      expect(withNeverDefaults(cases.throwingDefaultOnADiscriminantReadAsAnElement, theObjectOfAProperty)).toContain('const unhandled: never = shape\n')
    })

    it('binds, in its third form, the name its switch assigns to', () => {
      expect(withNeverDefaults(cases.throwingDefaultOnAnAssignment, theNameAssigned)).toContain('const unhandled: never = engine\n')
    })

    it('binds, in its third form, the name its switch assigns to with each logical assignment', () => {
      const logicalAssignments = [cases.throwingDefaultOnANullishAssignment, cases.throwingDefaultOnALogicalOrAssignment, cases.throwingDefaultOnALogicalAndAssignment]
      expect(logicalAssignments.map((text) => bindingsAtEachDefault(text, theNameAssigned))).toStrictEqual([['engine'], ['engine'], ['engine']])
    })

    it('binds, in its fourth form, the value under a non-null assertion', () => {
      expect(withNeverDefaults(cases.throwingDefaultOnANonNullAssertionOnAValueThatCannotBeNull, theValueUnwrapped)).toContain('const unhandled: never = engine\n')
    })

    it("binds, in its fourth form, a comma's last operand, through the parentheses around the comma", () => {
      expect(withNeverDefaults(cases.throwingDefaultOnACommaExpression, theValueUnwrapped)).toContain('const unhandled: never = engine\n')
    })

    it('binds, in its fifth form, the object under the non-null assertion holding the property its switch tests', () => {
      expect(withNeverDefaults(cases.throwingDefaultOnTheDiscriminantOfANonNullAssertedUnion, theObjectOfAPropertyUnwrapped)).toContain('const unhandled: never = shape\n')
    })

    it('binds, in its fourth and fifth forms, the value as written where nothing wraps it', () => {
      expect([theValueUnwrapped, theObjectOfAPropertyUnwrapped].map((binding) => bindingsAtEachDefault(cases.throwingDefaultAfterEveryCase, binding))).toStrictEqual([['engine'], ['engine']])
    })

    it('lists as candidates the value, then each name, this, property, element, non-null assertion and parenthesised expression in it, in the order written', () => {
      expect(candidateReferencesAtEachDefault(cases.throwingDefaultOnADoubleNonNullAssertionOnAParenthesisedOptionalPropertyOfThis)).toStrictEqual([
        ['(this.engine)!!', '(this.engine)!', '(this.engine)', 'this.engine', 'this'],
      ])
    })

    it('lists as candidates no name read after a dot, and nothing in a type', () => {
      const texts = [cases.throwingDefaultOnAPropertyOfACommaExpression, cases.throwingDefaultOnAnElementWithAnEnumMemberKey, cases.throwingDefaultOnACast]
      expect(texts.map(candidateReferencesAtEachDefault)).toStrictEqual([
        [["(note('reading'), config).engine", "(note('reading'), config)", 'note', 'config']],
        [['config[Key.Engine]', 'config', 'Key.Engine', 'Key']],
        [['raw as Engine', 'raw']],
      ])
    })

    it('binds, in the form for each candidate, the candidate at its place in the list, or the value itself past its end', () => {
      expect([0, 1, 2].map((index) => bindingsAtEachDefault(cases.throwingDefaultOnACast, theCandidateReferenceAt(index)))).toStrictEqual([['raw as Engine'], ['raw'], ['raw as Engine']])
    })

    it('ends, in its throwing form, in a throw after the binding', () => {
      const texts = [cases.throwingDefaultAtTheTopLevelOfAFile, cases.throwingDefaultInAClassStaticBlock, cases.throwingDefaultInASetter]
      expect(texts.map((text) => withNeverDefaults(text, theDiscriminant, 'throw'))).toStrictEqual([
        cases.neverBindingThenThrowAtTheTopLevelOfAFile,
        cases.neverBindingThenThrowInAClassStaticBlock,
        cases.neverBindingThenThrowInASetter,
      ])
    })

    it('holds, in its forms on a const, the value in a const declared before the switch, switches on the const, and binds it', () => {
      expect(withAConstSwitchedOn(cases.throwingDefaultOnACall, 'return')).toStrictEqual(cases.neverDefaultOnAConstHoldingACall)
    })

    it('ends, in its throwing form on a const, in a throw after binding the const', () => {
      expect(withAConstSwitchedOn(cases.throwingDefaultOnACallAtTheTopLevelOfAFile, 'throw')).toContain(
        ['const switchedOn = readEngine()', 'switch (switchedOn) {', "  case 'eslint':", ''].join('\n'),
      )
      expect(withAConstSwitchedOn(cases.throwingDefaultOnACallAtTheTopLevelOfAFile, 'throw')).toContain(
        ['  default: {', '    const unhandled: never = switchedOn', '    throw new Error(String(unhandled))', '  }', '}', ''].join('\n'),
      )
    })

    it('is written once where the switch tests no property and assigns nothing, with the message suggesting it', () => {
      expect(neverDefaultsOf(cases.throwingDefaultAfterEveryCase)).toStrictEqual([{ text: cases.neverDefaultAfterEveryCase, messages: [messageSuggesting('engine')] }])
    })

    it('names, for each form, the message suggesting it', () => {
      expect(neverDefaultsOf(cases.throwingDefaultOnADiscriminant).map(({ messages }) => messages)).toStrictEqual([[messageSuggesting('shape.kind')], [messageSuggesting('shape')]])
    })

    it('is written, beside the named forms, for each candidate they leave out', () => {
      const messagesOfEachBinding = neverDefaultsOf(cases.throwingDefaultOnADoubleNonNullAssertionOnAParenthesisedValueThatCanBeUndefined).map(({ messages }) => messages)
      expect(messagesOfEachBinding).toStrictEqual([[messageSuggesting('(engine)!!')], [messageSuggesting('engine')], [messageSuggesting('(engine)!')], [messageSuggesting('(engine)')]])
    })

    it('lists the forms in the order the rule prefers them, each with the message suggesting it', () => {
      const messagesOfEachForm = neverDefaultFormsOf(cases.throwingDefaultAfterEveryCase).map((form) => form.map(({ messages }) => messages))
      expect(messagesOfEachForm).toStrictEqual([
        [[messageSuggesting('engine')]],
        [[messageSuggestingTheBindingBeforeTheThrow('engine')]],
        [[messageSuggestingAConst('engine')]],
        [[messageSuggestingAConstBoundBeforeTheThrow('engine')]],
      ])
    })

    it('leaves a switch with no default as written', () => {
      expect(withNeverDefaults(cases.noDefaultAfterEveryCase, theDiscriminant)).toStrictEqual(cases.noDefaultAfterEveryCase)
    })
  })

  describe('the message', () => {
    it('reads in full, naming the never default to write in place of the throwing one', () => {
      expect(reportsOn(cases.throwingDefaultAfterEveryCase)).toStrictEqual([{ ruleId: RULE_ID, line: 9, message: messageSuggesting('engine') }])
    })

    it('reads in full where nothing can be returned, naming the value to bind before the throw', () => {
      expect(reportsOn(cases.throwingDefaultAtTheTopLevelOfAFile)).toStrictEqual([{ ruleId: RULE_ID, line: 16, message: messageSuggestingTheBindingBeforeTheThrow('engine') }])
    })

    it('reads in full where TypeScript narrows no part of the value to never, naming the value to hold in a const', () => {
      expect(reportsOn(cases.throwingDefaultOnACall)).toStrictEqual([{ ruleId: RULE_ID, line: 11, message: messageSuggestingAConst('engineOf(path)') }])
    })

    it('reads in full where TypeScript narrows no part of the value to never and nothing can be returned', () => {
      expect(reportsOn(cases.throwingDefaultOnACallAtTheTopLevelOfAFile)).toStrictEqual([{ ruleId: RULE_ID, line: 14, message: messageSuggestingAConstBoundBeforeTheThrow('readEngine()') }])
    })
  })

  // The rule shares its program with every other typed rule, so what it asks TypeScript must leave no error there.
  describe('the program it lints with', () => {
    it.each(CASES_DECLARING_A_NAME)('holds no type error after the rule lints %s, as before', (name) => {
      const text = CASE_TEXTS[name]
      expect({ asWritten: typeErrorsOfTheCase(text), afterTheRuleLints: typeErrorsAfterTheRuleLints(text) }).toStrictEqual({ asWritten: [], afterTheRuleLints: [] })
    })
  })

  describe('a project on disk', () => {
    it('reports, in a project holding one version of a package installed twice, the call to hold in a const', () => {
      const folder = folderHolding(projectHoldingAPackageInstalledTwice)
      const program = programOfTheProjectIn(folder, projectHoldingAPackageInstalledTwice)
      expect({ holdsARedirect: holdsARedirect(program), reports: reportsOnTheProjectIn(folder, projectHoldingAPackageInstalledTwice, program) }).toStrictEqual({
        holdsARedirect: true,
        reports: [{ ruleId: RULE_ID, line: 10, message: messageSuggestingAConst('readEngine()') }],
      })
    })

    it('leaves each file of the program under the name it held it by, in a composite project referencing a built one', () => {
      const folder = folderHolding(projectReferencingABuiltProject)
      const program = programOfTheProjectIn(folder, projectReferencingABuiltProject)
      const before = namesOfTheProjectsFilesIn(program, folder)
      const reports = reportsOnTheProjectIn(folder, projectReferencingABuiltProject, program)
      expect({ before, reports, after: namesOfTheProjectsFilesIn(program, folder) }).toStrictEqual({
        before: ['lib/dist/engine.d.ts', 'app/src/bin.ts'],
        reports: [{ ruleId: RULE_ID, line: 9, message: messageSuggestingAConst('readEngine()') }],
        after: ['lib/dist/engine.d.ts', 'app/src/bin.ts'],
      })
    })
  })

  describe('every case, typed and linted', () => {
    // Made before the tests, so each fails only on its own assertion.
    // eslint-disable-next-line functional/no-let -- TS2588 as a const: beforeAll makes the verdicts after the suite is collected, and theVerdicts reads them in each test; setUpRunsBeforeTheSuite, the helper that carries such a value, is in @agents-inc/lint-rules' tests, and that package builds this one in, so importing it here would be a cycle
    let made: CaseVerdicts | undefined

    beforeAll(() => {
      made = verdictsOfEveryCase()
    }, EVERY_CASE_TIMEOUT_MS)

    function theVerdicts(): CaseVerdicts {
      if (made === undefined) throw new Error('no verdicts were made before the tests of every case')
      return made
    }

    it('reports each case where a never default of a form the rule suggests compiles, and no other, every case compiling as written', () => {
      const { failingAsWritten, notLinted, reported, compilingWithANeverDefault } = theVerdicts()
      expect({ failingAsWritten, notLinted, reported }).toStrictEqual({ failingAsWritten: [], notLinted: [], reported: compilingWithANeverDefault })
    })

    it('suggests, in the message of each report, a never default that compiles, of the first form whose never default does', () => {
      expect(theVerdicts().reportedSuggestingNoNeverDefaultOfTheFirstFormThatCompiles).toStrictEqual([])
    })
  })
})
