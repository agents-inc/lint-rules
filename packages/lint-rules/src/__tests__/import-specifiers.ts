import ts from 'typescript'

const RELATIVE = /^\.\.?\//u

/** Each relative module specifier the source imports or re-exports from, in order, as TypeScript reads it. */
export function relativeImportSpecifiersIn(source: string, file: string): string[] {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false)
  return sourceFile.statements.flatMap((statement) => {
    const specifier = moduleSpecifierOf(statement)
    return specifier !== null && RELATIVE.test(specifier) ? [specifier] : []
  })
}

/** The module an import or re-export names: null for any other statement, and for a re-export naming none. */
function moduleSpecifierOf(statement: ts.Statement): string | null {
  if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) return null
  const { moduleSpecifier } = statement
  return moduleSpecifier !== undefined && ts.isStringLiteral(moduleSpecifier) ? moduleSpecifier.text : null
}
