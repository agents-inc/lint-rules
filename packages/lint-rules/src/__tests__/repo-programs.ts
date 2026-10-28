import { globSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compareCodeUnits } from '@workspace/rule-data/collections'
import ts from 'typescript'
import { slashSeparated } from '../core/slash-separated.ts'

const REPO_ROOT = fileURLToPath(new URL('../../../..', import.meta.url))
// What `bun run typecheck` reads: each package's tsconfig, and the one scripts/ has.
const TSCONFIGS = ['packages/*/tsconfig.json', 'scripts/tsconfig.json']
const LINE_BREAK = '\n'
const TOP_LEVEL = '(top level)'

/** A file of the repo's own, by path from the repo's root, with the program a tsconfig reading it makes. */
type RepoSourceFile = { readonly path: string; readonly sourceFile: ts.SourceFile; readonly checker: ts.TypeChecker }

/** Each TS file of the repo's own that a tsconfig takes in, or one of those imports, once: by path, sorted. */
export function repoSourceFiles(): RepoSourceFile[] {
  const programs = globSync(TSCONFIGS, { cwd: REPO_ROOT }).toSorted().map((tsconfig) => programOfTsconfig(join(REPO_ROOT, tsconfig)))
  return eachOnceByPath(programs.flatMap(repoSourceFilesIn))
}

function repoSourceFilesIn(program: ts.Program): RepoSourceFile[] {
  const checker = program.getTypeChecker()
  return program
    .getSourceFiles()
    .filter((sourceFile) => isOurs(program, sourceFile))
    .map((sourceFile) => ({ path: slashSeparated(relative(REPO_ROOT, sourceFile.fileName)), sourceFile, checker }))
}

// A file several programs hold is read the same through any of them.
function eachOnceByPath(files: readonly RepoSourceFile[]): RepoSourceFile[] {
  return new Map(files.map((file) => [file.path, file])).values().toArray().toSorted((one, other) => compareCodeUnits(one.path, other.path))
}

function programOfTsconfig(tsconfigPath: string): ts.Program {
  const read = ts.readConfigFile(tsconfigPath, (path) => ts.sys.readFile(path))
  if (read.error !== undefined) throw new Error(`${tsconfigPath}: ${ts.flattenDiagnosticMessageText(read.error.messageText, LINE_BREAK)}`)
  const { fileNames, options } = ts.parseJsonConfigFileContent(read.config, ts.sys, dirname(tsconfigPath))
  return ts.createProgram(fileNames, options)
}

/** A file of the repo's own source: under its root, and not an installed package's. */
export function isRepoSource(file: string): boolean {
  return !relative(REPO_ROOT, file).startsWith('..') && !file.includes('/node_modules/')
}

function isOurs(program: ts.Program, sourceFile: Readonly<ts.SourceFile>): boolean {
  return !sourceFile.isDeclarationFile && !program.isSourceFileFromExternalLibrary(sourceFile) && isRepoSource(sourceFile.fileName)
}

/** The node's children, in source order. */
export function childNodesOf(node: ts.Node): ts.Node[] {
  const children: ts.Node[] = []
  ts.forEachChild(node, (child) => {
    // eslint-disable-next-line functional/immutable-data -- ts.forEachChild hands each child to the callback and returns only the first truthy value it gives back, and TypeScript has no public call listing a node's children without its tokens: the list is gathered here
    children.push(child)
  })
  return children
}

/** The node and everything under it. */
export function nodesUnder(node: ts.Node): ts.Node[] {
  return [node, ...childNodesOf(node).flatMap(nodesUnder)]
}

/** The name of the nearest named function the node is in, read past the callbacks around it: `(top level)` for none. */
export function enclosingFunctionNameOf(node: ts.Node): string {
  const { parent } = node
  const name = functionNameOf(parent)
  if (name !== null) return name
  return ts.isSourceFile(parent) ? TOP_LEVEL : enclosingFunctionNameOf(parent)
}

function functionNameOf(node: ts.Node): string | null {
  if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name !== undefined) return node.name.getText()
  if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && ts.isVariableDeclaration(node.parent)) return node.parent.name.getText()
  return null
}
