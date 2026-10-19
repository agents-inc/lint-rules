// Modules whose names lead through re-exports, each keyed by its path in an in-memory program.

/** `passedOn` leads through one re-export to the constant `old`. */
export const A_CHAIN_THAT_ENDS: Readonly<Record<string, string>> = {
  '/project/old.ts': 'export const old = 1\n',
  '/project/passed-on.ts': "export { old as passedOn } from './old.ts'\n",
}

/** `looped` re-exports itself. */
export const A_FILE_RE_EXPORTING_ITSELF: Readonly<Record<string, string>> = {
  '/project/cycle.ts': "export { looped } from './cycle.ts'\n",
}

/** `first` and `second` re-export each other; `leadingIn` re-exports `first`, so it leads into that loop. */
export const TWO_FILES_RE_EXPORTING_EACH_OTHER: Readonly<Record<string, string>> = {
  '/project/first.ts': "export { second as first } from './second.ts'\n",
  '/project/second.ts': "export { first as second } from './first.ts'\n",
  '/project/leading-in.ts': "export { first as leadingIn } from './first.ts'\n",
}
