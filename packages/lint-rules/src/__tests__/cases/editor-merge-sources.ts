// Sources for the merge specs: each draws the one rule its name says, with the options noted, and
// nothing else a spec turns on.

/** `@typescript-eslint/array-type`: reported under `array-simple`, as shipped, and not under `generic`. */
export const genericArrayOfASimpleType = `export const list: Array<string> = []
`

/** `@typescript-eslint/array-type`: reported under `generic`, and not under `array-simple`, as shipped. */
export const simpleTypeArrayInBrackets = `export const list: string[] = []
`

/** `eqeqeq`: reported under `always`, as shipped, and under `smart` too. */
export const looseNumberCheck = `export function isOne(value: unknown): boolean {
  return value == 1
}
`

/** `eqeqeq`: reported under `always`, as shipped, and not under `smart`. */
export const looseNullCheck = `export function isMissing(value: unknown): boolean {
  return value == null
}
`

/** `react/jsx-curly-brace-presence`: reported under `{ props: 'never' }`, as shipped. */
export const stringLiteralInBracesAsAProp = `export const HomeLink = () => <a href={'/home'}>home</a>
`

/** Draws no rule: a team's reporting rule, which reports every file, shows up on it alone. */
export const cleanModule = `export const total = 1
`

/** Suppresses a rule only oxlint has; ESLint looks the name up wherever it reads directives. */
export const suppressionOfAnOxcRule = `// eslint-disable-next-line oxc/approx-constant
export const pi = 3.141592653589793
`

/** `@eslint-react/dom-no-dangerously-set-innerhtml`. */
export const innerHtmlSetDangerously = `export const Html = ({ html }: { readonly html: string }) => <div dangerouslySetInnerHTML={{ __html: html }} />
`

/** `@eslint-react/dom-no-missing-button-type`. */
export const buttonWithoutAType = `export const Save = () => <button>save</button>
`

/** `jsx-no-comment-textnodes`, a rule name both eslint-plugin-react and @eslint-react have: each reports it. */
export const commentAsJsxText = `export const Note = () => <div>// note</div>
`

/** `prefer-destructuring`, and typescript-eslint's typed extension of it: a property read into a variable of its own name. */
export const propertyReadIntoAVariable = `export function totalOf(order: { readonly total: number }): number {
  const total = order.total
  return total
}
`

/** `no-throw-literal`: a string thrown, in a JS file. */
export const thrownStringLiteral = `throw 'not an error'
`
