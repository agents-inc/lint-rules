import type { RuleCase } from './changed-settings.ts'

// Each rule on the gate's fixture and its corrected form, and, where the shipped options decide an outcome, on a file
// they leave alone that other options report. perfectionist/sort-objects is left to its case in accepted-tsq.ts.

/** Each shipped regexp rule ESLint runs, run as the catalog ships it. */
export const PROOF_REGEXP_CASES: readonly RuleCase[] = [
  {
    rule: 'regexp/confusing-quantifier',
    silentIn: [
      {
        path: 'src/confusing-quantifier-corrected.ts',
        source: `export const r338 = /(?:a?b?)*/;
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/confusing-quantifier.ts',
        source: `export const r338 = /(?:a?b?)+/;
`,
      },
    ],
  },
  {
    rule: 'regexp/grapheme-string-literal',
    silentIn: [
      {
        path: 'src/grapheme-string-literal-corrected.ts',
        source: `export const r339 = /[\\q{a|b|c}]/v;
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/grapheme-string-literal.ts',
        source: `export const r339 = /[\\q{abc}]/v;
`,
      },
    ],
  },
  {
    rule: 'regexp/letter-case',
    silentIn: [
      {
        path: 'src/letter-case-corrected.ts',
        source: `export const hex = /\\xab/u
`,
      },
      {
        path: 'src/letter-case-allowed-by-the-shipped-options.ts',
        source: `export const upper = /[A-Z]/iu
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/letter-case.ts',
        source: `export const hex = /\\xAB/u
`,
      },
    ],
  },
  {
    rule: 'regexp/match-any',
    silentIn: [
      {
        path: 'src/match-any-corrected.ts',
        source: `export const r340 = /[\\s\\S]/;
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/match-any.ts',
        source: `export const r340 = /[^]/;
`,
      },
    ],
  },
  {
    rule: 'regexp/negation',
    silentIn: [
      {
        path: 'src/negation-corrected.ts',
        source: `export const r341 = /\\D/;
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/negation.ts',
        source: `export const r341 = /[^\\d]/;
`,
      },
    ],
  },
  {
    rule: 'regexp/no-contradiction-with-assertion',
    silentIn: [
      {
        path: 'src/no-contradiction-with-assertion-corrected.ts',
        source: `const a = /a\\b-/.test("x");
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-contradiction-with-assertion.ts',
        source: `const a = /a\\b(?:a|-)/.test("x");
`,
      },
    ],
  },
  {
    rule: 'regexp/no-dupe-characters-character-class',
    silentIn: [
      {
        path: 'src/no-dupe-characters-character-class-corrected.ts',
        source: `export const r343 = /[ab]/;
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-dupe-characters-character-class.ts',
        source: `export const r343 = /[aa]/;
`,
      },
    ],
  },
  {
    rule: 'regexp/no-dupe-disjunctions',
    silentIn: [
      {
        path: 'src/no-dupe-disjunctions-corrected.ts',
        source: `export const r344 = /a|b/;
`,
      },
      {
        path: 'src/no-dupe-disjunctions-allowed-by-the-shipped-options.ts',
        source: `export const r = /(?:ab+|a+b)*c/;
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-dupe-disjunctions.ts',
        source: `export const r344 = /a|a/;
`,
      },
    ],
  },
  {
    rule: 'regexp/no-empty-alternative',
    silentIn: [
      {
        path: 'src/no-empty-alternative-corrected.ts',
        source: `export const r345 = /(?:a)?/;
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-empty-alternative.ts',
        source: `export const r345 = /(?:a|)/;
`,
      },
    ],
  },
  {
    rule: 'regexp/no-empty-group',
    silentIn: [
      {
        path: 'src/no-empty-group-corrected.ts',
        source: `export const r346 = /ab/;
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-empty-group.ts',
        source: `export const r346 = /a(?:)b/;
`,
      },
    ],
  },
  {
    rule: 'regexp/no-empty-lookarounds-assertion',
    silentIn: [
      {
        path: 'src/no-empty-lookarounds-assertion-corrected.ts',
        source: `export const r347 = /a(?=b)/;
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-empty-lookarounds-assertion.ts',
        source: `export const r347 = /a(?=)b/;
`,
      },
    ],
  },
  {
    rule: 'regexp/no-empty-string-literal',
    silentIn: [
      {
        path: 'src/no-empty-string-literal-corrected.ts',
        source: `export const r348 = /[\\q{ab}]/v;
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-empty-string-literal.ts',
        source: `export const r348 = /[\\q{}]/v;
`,
      },
    ],
  },
  {
    rule: 'regexp/no-escape-backspace',
    silentIn: [
      {
        path: 'src/no-escape-backspace-corrected.ts',
        source: `export const r349 = /[\\u0008]/;
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-escape-backspace.ts',
        source: `export const r349 = /[\\b]/;
`,
      },
    ],
  },
  {
    rule: 'regexp/no-extra-lookaround-assertions',
    silentIn: [
      {
        path: 'src/no-extra-lookaround-assertions-corrected.ts',
        source: `export const r350 = /(?=ab)/;
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-extra-lookaround-assertions.ts',
        source: `export const r350 = /(?=a(?=b))/;
`,
      },
    ],
  },
  {
    rule: 'regexp/no-invisible-character',
    silentIn: [
      {
        path: 'src/no-invisible-character-corrected.ts',
        source: `export const r351 = /\\xa0/;
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-invisible-character.ts',
        source: `export const r351 = /\u{a0}/;
`,
      },
    ],
  },
  {
    rule: 'regexp/no-lazy-ends',
    silentIn: [
      {
        path: 'src/no-lazy-ends-corrected.ts',
        source: `export const r352 = /a+/.test("aa");
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-lazy-ends.ts',
        source: `export const r352 = /a+?/.test("aa");
`,
      },
    ],
  },
  {
    rule: 'regexp/no-misleading-capturing-group',
    silentIn: [
      {
        path: 'src/no-misleading-capturing-group-corrected.ts',
        source: `export const r354 = /a+(b*)/;
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-misleading-capturing-group.ts',
        source: `export const r354 = /a+(a*)/;
`,
      },
    ],
  },
  {
    rule: 'regexp/no-missing-g-flag',
    silentIn: [
      {
        path: 'src/no-missing-g-flag-corrected.ts',
        source: `export const r355 = 'x'.matchAll(/a/g);
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-missing-g-flag.ts',
        source: `export const r355 = 'x'.matchAll(/a/);
`,
      },
    ],
  },
  {
    rule: 'regexp/no-obscure-range',
    silentIn: [
      {
        path: 'src/no-obscure-range-corrected.ts',
        source: `export const r357 = /[A-Z_]/;
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-obscure-range.ts',
        source: `export const r357 = /[A-_]/;
`,
      },
    ],
  },
  {
    rule: 'regexp/no-optional-assertion',
    silentIn: [
      {
        path: 'src/no-optional-assertion-corrected.ts',
        source: `export const r358 = /a(?:\\b|b)/;
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-optional-assertion.ts',
        source: `export const r358 = /a(?:\\b|b)?/;
`,
      },
    ],
  },
  {
    rule: 'regexp/no-potentially-useless-backreference',
    silentIn: [
      {
        path: 'src/no-potentially-useless-backreference-corrected.ts',
        source: `export const r359 = /(a)\\1/;
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-potentially-useless-backreference.ts',
        source: `export const r359 = /(?:(a)|b)\\1/;
`,
      },
    ],
  },
  {
    rule: 'regexp/no-super-linear-backtracking',
    silentIn: [
      {
        path: 'src/no-super-linear-backtracking-corrected.ts',
        source: `export const re = /a+$/
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-super-linear-backtracking.ts',
        source: `export const re = /(a+)+$/
`,
      },
    ],
  },
  {
    rule: 'regexp/no-trivially-nested-quantifier',
    silentIn: [
      {
        path: 'src/no-trivially-nested-quantifier-corrected.ts',
        source: `export const r = /a{6}/u
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-trivially-nested-quantifier.ts',
        source: `export const r = /(?:a{2}){3}/u
`,
      },
    ],
  },
  {
    rule: 'regexp/no-unused-capturing-group',
    silentIn: [
      {
        path: 'src/no-unused-capturing-group-corrected.ts',
        source: `export const r360 = 'x'.replace(/a/, 'b');
`,
      },
      {
        path: 'src/no-unused-capturing-group-allowed-by-the-shipped-options.ts',
        source: `export const r = 'x'.replace(/(?<letter>a)/, 'b');
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-unused-capturing-group.ts',
        source: `export const r360 = 'x'.replace(/(a)/, 'b');
`,
      },
    ],
  },
  {
    rule: 'regexp/no-useless-assertions',
    silentIn: [
      {
        path: 'src/no-useless-assertions-corrected.ts',
        source: `export const r361 = /(?!a)\\w/;
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-useless-assertions.ts',
        source: `export const r361 = /(?!a)b/;
`,
      },
    ],
  },
  {
    rule: 'regexp/no-useless-character-class',
    silentIn: [
      {
        path: 'src/no-useless-character-class-corrected.ts',
        source: `export const r362 = /a/;
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-useless-character-class.ts',
        source: `export const r362 = /[a]/;
`,
      },
    ],
  },
  {
    rule: 'regexp/no-useless-dollar-replacements',
    silentIn: [
      {
        path: 'src/no-useless-dollar-replacements-corrected.ts',
        source: `export const r363 = 'x'.replace(/(a)/, '$1');
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-useless-dollar-replacements.ts',
        source: `export const r363 = 'x'.replace(/a/, '$1');
`,
      },
    ],
  },
  {
    rule: 'regexp/no-useless-flag',
    silentIn: [
      {
        path: 'src/no-useless-flag-corrected.ts',
        source: `export const re = /^abc/m
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-useless-flag.ts',
        source: `export const re = /abc/m
`,
      },
    ],
  },
  {
    rule: 'regexp/no-useless-lazy',
    silentIn: [
      {
        path: 'src/no-useless-lazy-corrected.ts',
        source: `export const re = /a{1}/
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-useless-lazy.ts',
        source: `export const re = /a{1}?/
`,
      },
    ],
  },
  {
    rule: 'regexp/no-useless-non-capturing-group',
    silentIn: [
      {
        path: 'src/no-useless-non-capturing-group-corrected.ts',
        source: `export const re = /ab/
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-useless-non-capturing-group.ts',
        source: `export const re = /(?:a)b/
`,
      },
    ],
  },
  {
    rule: 'regexp/no-useless-quantifier',
    silentIn: [
      {
        path: 'src/no-useless-quantifier-corrected.ts',
        source: `export const re = /ab{2}c/
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-useless-quantifier.ts',
        source: `export const re = /ab{1}c/
`,
      },
    ],
  },
  {
    rule: 'regexp/no-useless-range',
    silentIn: [
      {
        path: 'src/no-useless-range-corrected.ts',
        source: `export const re = /[a-c]/
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-useless-range.ts',
        source: `export const re = /[a-a]/
`,
      },
    ],
  },
  {
    rule: 'regexp/no-useless-set-operand',
    silentIn: [
      {
        path: 'src/no-useless-set-operand-corrected.ts',
        source: `export const re = /[\\w--\\d]/v
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-useless-set-operand.ts',
        source: `export const re = /[\\w--\\s]/v
`,
      },
    ],
  },
  {
    rule: 'regexp/no-useless-string-literal',
    silentIn: [
      {
        path: 'src/no-useless-string-literal-corrected.ts',
        source: `export const re = /[\\q{ab}]/v
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-useless-string-literal.ts',
        source: `export const re = /[\\q{a}]/v
`,
      },
    ],
  },
  {
    rule: 'regexp/no-zero-quantifier',
    silentIn: [
      {
        path: 'src/no-zero-quantifier-corrected.ts',
        source: `export const re = /ac/
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-zero-quantifier.ts',
        source: `export const re = /ab{0}c/
`,
      },
    ],
  },
  {
    rule: 'regexp/optimal-lookaround-quantifier',
    silentIn: [
      {
        path: 'src/optimal-lookaround-quantifier-corrected.ts',
        source: `export const r = /(?=a)ab/u
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/optimal-lookaround-quantifier.ts',
        source: `export const r = /(?=ab*)ab/u
`,
      },
    ],
  },
  {
    rule: 'regexp/optimal-quantifier-concatenation',
    silentIn: [
      {
        path: 'src/optimal-quantifier-concatenation-corrected.ts',
        source: `export const r = /\\w+\\d/u
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/optimal-quantifier-concatenation.ts',
        source: `export const r = /\\w+\\d+/u
`,
      },
    ],
  },
  {
    rule: 'regexp/prefer-d',
    silentIn: [
      {
        path: 'src/prefer-d-corrected.ts',
        source: `export const re = /\\d/
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/prefer-d.ts',
        source: `export const re = /[0-9]/
`,
      },
    ],
  },
  {
    rule: 'regexp/prefer-escape-replacement-dollar-char',
    silentIn: [
      {
        path: 'src/prefer-escape-replacement-dollar-char-corrected.ts',
        source: `export const out = 'abc'.replace(/b/, '$$')
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/prefer-escape-replacement-dollar-char.ts',
        source: `export const out = 'abc'.replace(/b/, '$')
`,
      },
    ],
  },
  {
    rule: 'regexp/prefer-lookaround',
    silentIn: [
      {
        path: 'src/prefer-lookaround-corrected.ts',
        source: `export const out = 'abc'.replace(/a(?=b)/g, 'X')
`,
      },
      {
        path: 'src/prefer-lookaround-allowed-by-the-shipped-options.ts',
        source: `export const out = 'abc'.replace(/(a)b/g, '$1X')
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/prefer-lookaround.ts',
        source: `export const out = 'abc'.replace(/a(b)/g, 'X$1')
`,
      },
    ],
  },
  {
    rule: 'regexp/prefer-named-backreference',
    silentIn: [
      {
        path: 'src/prefer-named-backreference-corrected.ts',
        source: `export const re = /(?<foo>a)\\k<foo>/
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/prefer-named-backreference.ts',
        source: `export const re = /(?<foo>a)\\1/
`,
      },
    ],
  },
  {
    rule: 'regexp/prefer-named-replacement',
    silentIn: [
      {
        path: 'src/prefer-named-replacement-corrected.ts',
        source: `export const out = 'abc'.replace(/(?<foo>a)/, '$<foo>')
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/prefer-named-replacement.ts',
        source: `export const out = 'abc'.replace(/(?<foo>a)/, '$1')
`,
      },
    ],
  },
  {
    rule: 'regexp/prefer-plus-quantifier',
    silentIn: [
      {
        path: 'src/prefer-plus-quantifier-corrected.ts',
        source: `export const re = /a+/
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/prefer-plus-quantifier.ts',
        source: `export const re = /a{1,}/
`,
      },
    ],
  },
  {
    rule: 'regexp/prefer-predefined-assertion',
    silentIn: [
      {
        path: 'src/prefer-predefined-assertion-corrected.ts',
        source: `export const re = /a$/
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/prefer-predefined-assertion.ts',
        source: `export const re = /a(?![\\s\\S])/
`,
      },
    ],
  },
  {
    rule: 'regexp/prefer-quantifier',
    silentIn: [
      {
        path: 'src/prefer-quantifier-corrected.ts',
        source: `export const re = /\\d{3}/
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/prefer-quantifier.ts',
        source: `export const re = /\\d\\d\\d/
`,
      },
    ],
  },
  {
    rule: 'regexp/prefer-question-quantifier',
    silentIn: [
      {
        path: 'src/prefer-question-quantifier-corrected.ts',
        source: `export const re = /a?/
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/prefer-question-quantifier.ts',
        source: `export const re = /a{0,1}/
`,
      },
    ],
  },
  {
    rule: 'regexp/prefer-range',
    silentIn: [
      {
        path: 'src/prefer-range-corrected.ts',
        source: `export const re = /[a-f]/
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/prefer-range.ts',
        source: `export const re = /[abcdef]/
`,
      },
    ],
  },
  {
    rule: 'regexp/prefer-result-array-groups',
    silentIn: [
      {
        path: 'src/prefer-result-array-groups-corrected.ts',
        source: `const m = /(?<foo>a)/.exec('a')
export const v = m ? m.groups?.foo : ''
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/prefer-result-array-groups.ts',
        source: `const m = /(?<foo>a)/.exec('a')
export const v = m ? m[1] : ''
`,
      },
    ],
  },
  {
    rule: 'regexp/prefer-set-operation',
    silentIn: [
      {
        path: 'src/prefer-set-operation-corrected.ts',
        source: `export const re = /[\\w--\\d]/v
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/prefer-set-operation.ts',
        source: `export const re = /(?!\\d)\\w/v
`,
      },
    ],
  },
  {
    rule: 'regexp/prefer-star-quantifier',
    silentIn: [
      {
        path: 'src/prefer-star-quantifier-corrected.ts',
        source: `export const re = /a*/
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/prefer-star-quantifier.ts',
        source: `export const re = /a{0,}/
`,
      },
    ],
  },
  {
    rule: 'regexp/prefer-unicode-codepoint-escapes',
    silentIn: [
      {
        path: 'src/prefer-unicode-codepoint-escapes-corrected.ts',
        source: `export const re = /\\u{1F600}/u
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/prefer-unicode-codepoint-escapes.ts',
        source: `export const re = /\\uD83D\\uDE00/u
`,
      },
    ],
  },
  {
    rule: 'regexp/prefer-w',
    silentIn: [
      {
        path: 'src/prefer-w-corrected.ts',
        source: `export const re = /\\w/
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/prefer-w.ts',
        source: `export const re = /[a-zA-Z0-9_]/
`,
      },
    ],
  },
  {
    rule: 'regexp/simplify-set-operations',
    silentIn: [
      {
        path: 'src/simplify-set-operations-corrected.ts',
        source: `export const re = /[^ab]/v
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/simplify-set-operations.ts',
        source: `export const re = /[[^a]&&[^b]]/v
`,
      },
    ],
  },
  {
    rule: 'regexp/sort-alternatives',
    silentIn: [
      {
        path: 'src/sort-alternatives-corrected.ts',
        source: `export const re = /^(?:a|b)$/
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/sort-alternatives.ts',
        source: `export const re = /^(?:b|a)$/
`,
      },
    ],
  },
  {
    rule: 'regexp/sort-flags',
    silentIn: [
      {
        path: 'src/sort-flags-corrected.ts',
        source: `export const re = /a/im
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/sort-flags.ts',
        source: `export const re = /a/mi
`,
      },
    ],
  },
  {
    rule: 'regexp/unicode-escape',
    silentIn: [
      {
        path: 'src/unicode-escape-corrected.ts',
        source: `export const re = /\\u{41}/u
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/unicode-escape.ts',
        source: `export const re = /\\u0041/u
`,
      },
    ],
  },
  {
    rule: 'regexp/unicode-property',
    silentIn: [
      {
        path: 'src/unicode-property-corrected.ts',
        source: `const re = /\\p{Script=Latin}/u
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/unicode-property.ts',
        source: `const re = /\\p{Script=Latn}/u
`,
      },
    ],
  },
  {
    rule: 'regexp/use-ignore-case',
    silentIn: [
      {
        path: 'src/use-ignore-case-corrected.ts',
        source: `const re = /ab/i
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/use-ignore-case.ts',
        source: `const re = /[aA][bB]/
`,
      },
    ],
  },
]

/** Each shipped perfectionist rule ESLint runs, run as the catalog ships it. */
export const PROOF_PERFECTIONIST_CASES: readonly RuleCase[] = [
  {
    rule: 'perfectionist/sort-array-includes',
    silentIn: [
      {
        path: 'src/sort-array-includes-corrected.ts',
        source: `export const has = (x: string) => ['a', 'b'].includes(x)
`,
      },
      {
        path: 'src/sort-array-includes-allowed-by-the-shipped-options.ts',
        source: `export const has = (x: string) =>
  [
    'b',

    'a',
  ].includes(x)
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/sort-array-includes.ts',
        source: `export const has = (x: string) => ['b', 'a'].includes(x)
`,
      },
    ],
  },
  {
    rule: 'perfectionist/sort-arrays',
    silentIn: [
      {
        path: 'src/sort-arrays-corrected.ts',
        source: `export const FLAGS = ['ADMIN', 'READ', 'WRITE']
`,
      },
      {
        path: 'src/sort-arrays-allowed-by-the-shipped-options.ts',
        source: `export const words = ['write', 'read', 'admin']
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/sort-arrays.ts',
        source: `export const FLAGS = ['WRITE', 'READ', 'ADMIN']
`,
      },
    ],
  },
  {
    rule: 'perfectionist/sort-classes',
    silentIn: [
      {
        path: 'src/sort-classes-corrected.ts',
        source: `export class C {
  a() {}
  b() {}
}
`,
      },
      {
        path: 'src/sort-classes-allowed-by-the-shipped-options.ts',
        source: `export class C {
  b() {}

  a() {}
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/sort-classes.ts',
        source: `export class C {
  b() {}
  a() {}
}
`,
      },
    ],
  },
  {
    rule: 'perfectionist/sort-decorators',
    silentIn: [
      {
        path: 'src/sort-decorators-corrected.ts',
        source: `class A {
  @a() @b() m() {}
}
`,
      },
      {
        path: 'src/sort-decorators-allowed-by-the-shipped-options.ts',
        source: `class A {
  @b()

  @a()
  m() {}
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/sort-decorators.ts',
        source: `class A {
  @b() @a() m() {}
}
`,
      },
    ],
  },
  {
    rule: 'perfectionist/sort-enums',
    silentIn: [
      {
        path: 'src/sort-enums-corrected.ts',
        source: `enum E { Alpha = 'a', Beta = 'b' }
`,
      },
      {
        path: 'src/sort-enums-allowed-by-the-shipped-options.ts',
        source: `enum E {
  Beta = 'b',

  Alpha = 'a',
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/sort-enums.ts',
        source: `enum E { Beta = 'b', Alpha = 'a' }
`,
      },
    ],
  },
  {
    rule: 'perfectionist/sort-export-attributes',
    silentIn: [
      {
        path: 'src/sort-export-attributes-corrected.ts',
        source: `export { x } from './m' with { a: 'b', type: 'json' }
`,
      },
      {
        path: 'src/sort-export-attributes-allowed-by-the-shipped-options.ts',
        source: `export { x } from './m' with {
  type: 'json',

  a: 'b',
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/sort-export-attributes.ts',
        source: `export { x } from './m' with { type: 'json', a: 'b' }
`,
      },
    ],
  },
  {
    rule: 'perfectionist/sort-exports',
    silentIn: [
      {
        path: 'src/sort-exports-corrected.ts',
        source: `export * from './a'
export * from './b'
`,
      },
      {
        path: 'src/sort-exports-allowed-by-the-shipped-options.ts',
        source: `export * from './b'

export * from './a'
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/sort-exports.ts',
        source: `export * from './b'
export * from './a'
`,
      },
    ],
  },
  {
    rule: 'perfectionist/sort-heritage-clauses',
    silentIn: [
      {
        path: 'src/sort-heritage-clauses-corrected.ts',
        source: `interface I extends A, B {}
`,
      },
      {
        path: 'src/sort-heritage-clauses-allowed-by-the-shipped-options.ts',
        source: `interface I extends
  B,

  A {}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/sort-heritage-clauses.ts',
        source: `interface I extends B, A {}
`,
      },
    ],
  },
  {
    rule: 'perfectionist/sort-import-attributes',
    silentIn: [
      {
        path: 'src/sort-import-attributes-corrected.ts',
        source: `import x from './m' with { a: 'b', type: 'json' }
console.log(x)
`,
      },
      {
        path: 'src/sort-import-attributes-allowed-by-the-shipped-options.ts',
        source: `import x from './m' with {
  type: 'json',

  a: 'b',
}
console.log(x)
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/sort-import-attributes.ts',
        source: `import x from './m' with { type: 'json', a: 'b' }
console.log(x)
`,
      },
    ],
  },
  {
    rule: 'perfectionist/sort-interfaces',
    silentIn: [
      {
        path: 'src/sort-interfaces-corrected.ts',
        source: `interface I { a: string; b: string }
`,
      },
      {
        path: 'src/sort-interfaces-allowed-by-the-shipped-options.ts',
        source: `interface I {
  b: string

  a: string
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/sort-interfaces.ts',
        source: `interface I { b: string; a: string }
`,
      },
    ],
  },
  {
    rule: 'perfectionist/sort-intersection-types',
    silentIn: [
      {
        path: 'src/sort-intersection-types-corrected.ts',
        source: `type T = A & B
`,
      },
      {
        path: 'src/sort-intersection-types-allowed-by-the-shipped-options.ts',
        source: `type T =
  & B

  & A
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/sort-intersection-types.ts',
        source: `type T = B & A
`,
      },
    ],
  },
  {
    rule: 'perfectionist/sort-jsx-props',
    silentIn: [
      {
        path: 'src/sort-jsx-props-corrected.tsx',
        source: `const x = <div a="2" b="1" />
`,
      },
      {
        path: 'src/sort-jsx-props-allowed-by-the-shipped-options.tsx',
        source: `const x = (
  <div
    b="1"

    a="2"
  />
)
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/sort-jsx-props.tsx',
        source: `const x = <div b="1" a="2" />
`,
      },
    ],
  },
  {
    rule: 'perfectionist/sort-maps',
    silentIn: [
      {
        path: 'src/sort-maps-corrected.ts',
        source: `const m = new Map([['a', 2], ['b', 1]])
`,
      },
      {
        path: 'src/sort-maps-allowed-by-the-shipped-options.ts',
        source: `const m = new Map([
  ['b', 1],

  ['a', 2],
])
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/sort-maps.ts',
        source: `const m = new Map([['b', 1], ['a', 2]])
`,
      },
    ],
  },
  {
    rule: 'perfectionist/sort-modules',
    silentIn: [
      {
        path: 'src/sort-modules-corrected.ts',
        source: `function a() {}
function b() {}
`,
      },
      {
        path: 'src/sort-modules-allowed-by-the-shipped-options.ts',
        source: `function b() {}

function a() {}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/sort-modules.ts',
        source: `function b() {}
function a() {}
`,
      },
    ],
  },
  {
    rule: 'perfectionist/sort-named-exports',
    silentIn: [
      {
        path: 'src/sort-named-exports-corrected.ts',
        source: `export { a, b } from './m'
`,
      },
      {
        path: 'src/sort-named-exports-allowed-by-the-shipped-options.ts',
        source: `export {
  b,

  a,
} from './m'
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/sort-named-exports.ts',
        source: `export { b, a } from './m'
`,
      },
    ],
  },
  {
    rule: 'perfectionist/sort-named-imports',
    silentIn: [
      {
        path: 'src/sort-named-imports-corrected.ts',
        source: `import { a, b } from './m'
console.log(b, a)
`,
      },
      {
        path: 'src/sort-named-imports-allowed-by-the-shipped-options.ts',
        source: `import {
  b,

  a,
} from './m'
console.log(b, a)
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/sort-named-imports.ts',
        source: `import { b, a } from './m'
console.log(b, a)
`,
      },
    ],
  },
  {
    rule: 'perfectionist/sort-object-types',
    silentIn: [
      {
        path: 'src/sort-object-types-corrected.ts',
        source: `type T = { a: string; b: string }
`,
      },
      {
        path: 'src/sort-object-types-allowed-by-the-shipped-options.ts',
        source: `type T = {
  b: string

  a: string
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/sort-object-types.ts',
        source: `type T = { b: string; a: string }
`,
      },
    ],
  },
  {
    rule: 'perfectionist/sort-sets',
    silentIn: [
      {
        path: 'src/sort-sets-corrected.ts',
        source: `const s = new Set(['a', 'b'])
`,
      },
      {
        path: 'src/sort-sets-allowed-by-the-shipped-options.ts',
        source: `const s = new Set([
  'b',

  'a',
])
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/sort-sets.ts',
        source: `const s = new Set(['b', 'a'])
`,
      },
    ],
  },
  {
    rule: 'perfectionist/sort-switch-case',
    silentIn: [
      {
        path: 'src/sort-switch-case-corrected.ts',
        source: `switch (x) { case 'a': break; case 'b': break }
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/sort-switch-case.ts',
        source: `switch (x) { case 'b': break; case 'a': break }
`,
      },
    ],
  },
  {
    rule: 'perfectionist/sort-union-types',
    silentIn: [
      {
        path: 'src/sort-union-types-corrected.ts',
        source: `type U = A | B
`,
      },
      {
        path: 'src/sort-union-types-allowed-by-the-shipped-options.ts',
        source: `type U = string | { a: 1 } | null
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/sort-union-types.ts',
        source: `type U = B | A
`,
      },
    ],
  },
  {
    rule: 'perfectionist/sort-variable-declarations',
    silentIn: [
      {
        path: 'src/sort-variable-declarations-corrected.ts',
        source: `const a = 2, b = 1
`,
      },
      {
        path: 'src/sort-variable-declarations-allowed-by-the-shipped-options.ts',
        source: `const b = 1,

  a = 2
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/sort-variable-declarations.ts',
        source: `const b = 1, a = 2
`,
      },
    ],
  },
]
