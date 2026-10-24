import ts from 'typescript'

type RewrittenFile = {
  readonly program: ts.Program
  readonly sourceFile: ts.SourceFile
}

function isASourceFile(value: unknown): value is ts.SourceFile {
  return typeof value === 'object' && value !== null && 'kind' in value && value.kind === ts.SyntaxKind.SourceFile
}

// TypeScript reads a package installed twice from one copy and holds a redirect to it for the other, which it keeps off
// its public types; a host hands it the file the redirect stands for.
function fileTheRedirectStandsFor(sourceFile: Readonly<ts.SourceFile>): ts.SourceFile | null {
  const redirect: unknown = 'redirectInfo' in sourceFile ? sourceFile.redirectInfo : undefined
  if (typeof redirect !== 'object' || redirect === null || !('unredirected' in redirect)) return null
  return isASourceFile(redirect.unredirected) ? redirect.unredirected : null
}

function fileAsAHostReadsIt(sourceFile: Readonly<ts.SourceFile>): ts.SourceFile {
  return fileTheRedirectStandsFor(sourceFile) ?? sourceFile
}

// A host reading the file from `text`, each other file as the program holds it, and one it does not from disk.
function hostReadingTheFileFrom(text: string, fileName: string, program: Readonly<ts.Program>): ts.CompilerHost {
  const host = ts.createCompilerHost(program.getCompilerOptions())
  return {
    ...host,
    getSourceFile(path, languageVersionOrOptions, onError, shouldCreateNewSourceFile) {
      if (path === fileName) return ts.createSourceFile(path, text, languageVersionOrOptions, true)
      const held = program.getSourceFile(path)
      return held === undefined ? host.getSourceFile(path, languageVersionOrOptions, onError, shouldCreateNewSourceFile) : fileAsAHostReadsIt(held)
    },
  }
}

/**
 * The program given, but with one file read from `text`. TypeScript reuses each other file the program holds, parsed and
 * bound; the program it returns types what it is asked with a checker of its own, so nothing asked of it reaches the
 * program given.
 */
export function programWithTheFileRewritten(program: Readonly<ts.Program>, fileName: string, text: string): RewrittenFile {
  const projectReferences = program.getProjectReferences()
  const rewritten = ts.createProgram({
    rootNames: program.getRootFileNames(),
    options: program.getCompilerOptions(),
    ...(projectReferences !== undefined && { projectReferences }),
    oldProgram: program,
    host: hostReadingTheFileFrom(text, fileName, program),
  })
  const sourceFile = rewritten.getSourceFile(fileName)
  if (sourceFile === undefined) throw new Error(`the rewritten program holds no ${fileName}`)
  return { program: rewritten, sourceFile }
}
