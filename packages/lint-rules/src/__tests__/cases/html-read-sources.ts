// An `.innerHTML` read: unicorn/prefer-dom-node-html-methods would report it and fix it to `.getHTML()`
// (measured: unicorn 78.0.0), a method jsdom 30.1.3 lacks, so a jsdom test reading markup so fails once fixed.

/** A read of an element's markup. */
export const AN_HTML_READ = 'export const markupOf = (element: Element) => element.innerHTML'

/** A source file, which a jsdom test may import. */
export const HTML_READ_SOURCE_FILE = 'src/markup.ts'

/** A file of each form the test-file globs name: a test, a component spec, one under `__tests__`, and a type test. */
export const HTML_READ_TEST_FILES: readonly string[] = ['src/markup.test.ts', 'src/markup.spec.tsx', 'src/__tests__/markup.ts', 'src/markup.test-d.ts']
