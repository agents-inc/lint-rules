// Stryker's command line reads --testFiles in four spellings: `--testFiles <list>`, `--testFiles=<list>`, `-t <list>`
// and `-t<list>`, where all that is attached to `-t` is the list, `=` included.

const TEST_FILES = '--testFiles'
const TEST_FILES_ASSIGNED = `${TEST_FILES}=`
const TEST_FILES_SHORT = '-t'
const LIST_SEPARATOR = ','

/** Each entry of every --testFiles list, empty entries dropped, as Stryker drops them. */
export function testFilesGiven(strykerArguments: readonly string[]): string[] {
  return testFilesLists(strykerArguments).flatMap(entriesOf)
}

/** Each --testFiles list, as given, that holds no entry: Stryker reads it as no filter, so every test runs. */
export function testFilesListsWithNoEntry(strykerArguments: readonly string[]): string[] {
  return testFilesLists(strykerArguments).filter((list) => entriesOf(list).length === 0)
}

function testFilesLists(strykerArguments: readonly string[]): string[] {
  return strykerArguments.flatMap((argument, index) => testFilesListAt(argument, strykerArguments[index + 1]))
}

function testFilesListAt(argument: string, nextArgument: string | undefined): string[] {
  // Stryker refuses a --testFiles that ends its arguments itself, so there is no list to read.
  if (argument === TEST_FILES || argument === TEST_FILES_SHORT) return nextArgument === undefined ? [] : [nextArgument]
  if (argument.startsWith(TEST_FILES_ASSIGNED)) return [argument.slice(TEST_FILES_ASSIGNED.length)]
  if (argument.startsWith(TEST_FILES_SHORT)) return [argument.slice(TEST_FILES_SHORT.length)]
  return []
}

function entriesOf(list: string): string[] {
  return list.split(LIST_SEPARATOR).filter((entry) => entry !== '')
}
