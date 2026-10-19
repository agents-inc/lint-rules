import { noteLine } from '../command-lines.ts'

const COMMAND = 'init'

export type PackageManagerCommands = { readonly install: string; readonly runner: string }

export type EntryWritten = { readonly kind: 'added'; readonly range: string } | { readonly kind: 'kept' }

export function initStdoutLines(entry: EntryWritten, packageName: string, configFile: string, { install, runner }: PackageManagerCommands): string[] {
  const wrote =
    entry.kind === 'added'
      ? `${COMMAND}: wrote ${configFile} and added ${packageName} ${entry.range} to devDependencies in package.json.`
      : `${COMMAND}: wrote ${configFile} and kept the existing ${packageName} entry in package.json.`
  return [
    wrote,
    `Next: run "${install}".`,
    "Then add these lines to your agents' instructions:",
    '',
    `After changing code, run \`${runner} agents-inc-lint check\` with no arguments. Exit 0: done. Exit 1: fix every finding in code you wrote, then run it again; when only findings in code you did not write remain, you are done. Exit 2: stop and report its output. Never add a suppression comment, and never edit ${configFile}.`,
  ]
}

/** init still writes outside git, and says check will need it. */
export function outsideGitNote(folder: string): string {
  return noteLine(COMMAND, `${folder} is not in a git repository, and check needs one.`)
}

export const GIT_COULD_NOT_RUN_NOTE = noteLine(COMMAND, 'git could not be run, and check needs it.')

/** The file reads import.meta.dirname, which TypeScript types only with @types/node. */
export function typesNodeNote(configFile: string): string {
  return noteLine(
    COMMAND,
    `${configFile} reads import.meta.dirname, which TypeScript knows only from @types/node. If your tsconfig includes the file, add @types/node to devDependencies.`,
  )
}

export function configExists(configFile: string, folder: string): string {
  return `${COMMAND}: ${configFile} already exists in ${folder}; nothing was changed. Delete it to start again.`
}

export function noPackageJson(folder: string): string {
  return `there is no package.json in ${folder}. Run init in the folder of the package to lint.`
}

export function notAnObject(path: string, field: string): string {
  return `${path}: ${field} is not a JSON object`
}

export function nothingWritten(reason: string): string {
  return `${reason}. Nothing was changed.`
}
