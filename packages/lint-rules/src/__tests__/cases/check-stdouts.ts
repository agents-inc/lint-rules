// What check prints to stdout, for the tests of the reader in check-output.ts.

export const CHECK_STDOUT_WITH_EVERY_KIND_OF_LINE = `check: autofixed src/a.ts, src/with space.ts; read them again before editing them.
src/with space.ts:2 no-debugger — \`debugger\` statement is not allowed
src/broken.ts:4 parse error — Parsing error: Variable declaration expected.
src/allowed.ts:3 unused suppression — suppresses no-console, which reported nothing here — twice
src/empty.test.ts:0 sonarjs/no-empty-test-file — Add some tests to this file or delete it.
src/cart.ts:30 no-console (warning) — Unexpected console statement.
+3 more findings in 2 files. Fix the ones above, then run check again to see them.
check: 7 errors and 1 warning in 5 of 6 changed files. Fix what is in code you wrote, then run check again. Do not read the lint configuration or this package's source; each line says what to fix.
`

export const CHECK_STDOUT_WITHOUT_AUTOFIXED_LINE = `+3 more findings in 2 files. Fix the ones above, then run check again to see them.
check: no findings in 2 changed files.
`

export const CHECK_STDOUT_WITH_A_MALFORMED_AUTOFIXED_LINE = `check: autofixed src/a.ts.
check: no findings in 1 changed file.
`
