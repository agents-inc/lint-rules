/** One way of giving Stryker's `--testFiles` its comma-separated list. */
export type TestFilesSpelling = { readonly spelling: string; readonly given: (list: string) => readonly string[] }

/** Each spelling Stryker's CLI reads as `--testFiles`, `-t` with the list attached among them. */
export const TEST_FILES_SPELLINGS: readonly TestFilesSpelling[] = [
  {
    spelling: '--testFiles <list>',
    given(list) {
      return ['--testFiles', list]
    },
  },
  {
    spelling: '--testFiles=<list>',
    given(list) {
      return [`--testFiles=${list}`]
    },
  },
  {
    spelling: '-t <list>',
    given(list) {
      return ['-t', list]
    },
  },
  {
    spelling: '-t<list>',
    given(list) {
      return [`-t${list}`]
    },
  },
]
