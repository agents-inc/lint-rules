// JSON with comments and trailing commas, as a team's .oxlintrc.json may hold it (oxlint 1.87 reads each), with
// the value it holds.

export type JsoncText = { readonly how: string; readonly text: string; readonly holds: unknown }

export const JSONC_TEXTS_AND_WHAT_THEY_HOLD: readonly JsoncText[] = [
  { how: 'JSON with no comment or trailing comma as JSON', text: '{ "rules": { "eqeqeq": ["error", "always"] } }', holds: { rules: { eqeqeq: ['error', 'always'] } } },
  { how: 'a string holding comment marks, a comma and a bracket whole', text: '{ "a": "x // y /* z */ ,] }" }', holds: { a: 'x // y /* z */ ,] }' } },
  { how: 'a string holding an escaped quote, an escaped backslash and a comment mark whole', text: '{ "a": "say \\"hi\\" \\\\ // kept" }', holds: { a: 'say "hi" \\ // kept' } },
  { how: 'a line comment on its own line and after a value as nothing', text: '{\n  // the rules\n  "a": 1 // one\n}', holds: { a: 1 } },
  { how: 'a block comment inline and over several lines as nothing', text: '{ /* inline */ "a": /* before */ 1,\n /*\n  over\n  lines\n */ "b": 2 }', holds: { a: 1, b: 2 } },
  { how: 'a trailing comma before a closing bracket and before a closing brace as nothing', text: '{ "a": [1, 2,], "b": 3, }', holds: { a: [1, 2], b: 3 } },
  { how: 'a trailing comma before whitespace, a line comment and a block comment as nothing', text: '{ "a": 1, // the last\n  /* end */\n}', holds: { a: 1 } },
  { how: 'a trailing comma before a block comment holding stars as nothing', text: '{ "a": 1, /** the last, * starred */ }', holds: { a: 1 } },
  { how: 'a comma before a block comment and a value as a comma', text: '[1, /* two */ 2]', holds: [1, 2] },
  { how: 'a comma before a line comment and a value as a comma', text: '[1, // two\n 2]', holds: [1, 2] },
  { how: 'a comma before a string holding a bracket as a comma', text: '["a", "]"]', holds: ['a', ']'] },
]

export const JSONC_TEXTS_OXLINT_READS_WITH_A_COMMENT_AFTER_A_COMMA: readonly JsoncText[] = [
  { how: 'a line comment after it holds a closing bracket', text: '[1, // see [x]\n 2]', holds: [1, 2] },
  { how: 'a line comment after it holds a closing brace', text: '{ "a": 1, // was {b}\n "c": 2 }', holds: { a: 1, c: 2 } },
  { how: 'a block comment after it closes before the value, and another before the bracket', text: '[1, /* a */ 2 /* b */]', holds: [1, 2] },
]

/** JSON that is not whole once its comments go. */
export const JSONC_TEXT_UNCLOSED = '{ "a": 1 // no closing brace\n'

// Each took a second or more to read while a comment after a comma could be split many ways (measured, Node 22.23).
export const JSONC_TEXTS_A_BACKTRACKING_READ_TOOK_SECONDS_ON: readonly JsoncText[] = [
  { how: 'a comment of 42 slashes after a comma', text: `{ "a": 1, ${'/'.repeat(42)}\n "b": 2 }`, holds: { a: 1, b: 2 } },
  { how: 'a line comment of 50,000 spaces after a comma', text: `[1, //${' '.repeat(50_000)}x\n 2]`, holds: [1, 2] },
]
