import { foundOr } from '@workspace/rule-data/collections'
import ts from 'typescript'

// The files hold `.ts` imports, which TypeScript resolves only with this option set.
const COMPILER_OPTIONS: ts.CompilerOptions = { module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, allowImportingTsExtensions: true, noEmit: true }

/** A program of the files given, by absolute path, and no other file: no default library. */
export function programOfFiles(files: Readonly<Record<string, string>>): ts.Program {
  const host = ts.createCompilerHost(COMPILER_OPTIONS)
  function sourceFileOf(path: string, languageVersion: Readonly<ts.ScriptTarget | ts.CreateSourceFileOptions>): ts.SourceFile | undefined {
    const text = files[path]
    return text === undefined ? undefined : ts.createSourceFile(path, text, languageVersion)
  }
  const inMemory: ts.CompilerHost = {
    ...host,
    fileExists(path) {
      return Object.hasOwn(files, path)
    },
    directoryExists(path) {
      return Object.keys(files).some((file) => file.startsWith(`${path}/`))
    },
    readFile(path) {
      return files[path]
    },
    realpath(path) {
      return path
    },
    getSourceFile: sourceFileOf,
    getDefaultLibFileName() {
      return 'no-default-library.d.ts'
    },
  }
  return ts.createProgram({ rootNames: Object.keys(files), options: { ...COMPILER_OPTIONS, noLib: true }, host: inMemory })
}

/** The symbol a module exports under the name given: for a re-export, its alias. */
export function exportOf(program: ts.Program, path: string, name: string): ts.Symbol {
  const checker = program.getTypeChecker()
  const sourceFile = foundOr(program.getSourceFile(path), `the program holds no ${path}`)
  const moduleSymbol = foundOr(checker.getSymbolAtLocation(sourceFile), `${path} is no module`)
  return foundOr(
    checker.getExportsOfModule(moduleSymbol).find((exported) => exported.name === name),
    `${path} exports no ${name}`,
  )
}
