// Run by project-service-verdicts.ts, a process per tsconfigRootDir: a file typescript-eslint's project service
// has opened keeps the project it found, whatever a later tsconfigRootDir gives (measured, typescript-eslint
// 8.71.1). Prints, as JSON, each file given that the service finds no project for.

import { ESLint } from 'eslint'
import tseslint from 'typescript-eslint'
import { projectPathOf } from './project-paths.ts'

const NOT_FOUND_BY_THE_PROJECT_SERVICE = 'was not found by the project service'
const TS_FILES = '**/*.{ts,mts,cts,tsx}'

const [tsconfigRootDir, ...files] = process.argv.slice(2)
if (tsconfigRootDir === undefined) throw new Error('usage: project-service-verdicts-process.ts <tsconfigRootDir> <file>...')

// No directive is read, so a fixture's `/* eslint-env */` comment is no fatal message of its own.
const eslint = new ESLint({
  cwd: tsconfigRootDir,
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: [TS_FILES],
      languageOptions: { parser: tseslint.parser, parserOptions: { projectService: true, tsconfigRootDir } },
      linterOptions: { noInlineConfig: true },
    },
  ],
})
const results = await eslint.lintFiles(files)

// The parser asks the project service for the file's project before it reads the file, so a syntax
// error of the file's own (a fixture of a rule that reports one) comes only once a project was found.
const foundByNoProject = results
  .filter(({ messages }) => messages.some((message) => message.fatal === true && message.message.includes(NOT_FOUND_BY_THE_PROJECT_SERVICE)))
  .map(({ filePath }) => projectPathOf(filePath, tsconfigRootDir))
process.stdout.write(JSON.stringify(foundByNoProject))
