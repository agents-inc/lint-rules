// Sources for the merge specs: each draws the one rule its name says, with the options noted, and
// nothing else a spec turns on.

/** `@typescript-eslint/no-this-alias`: reported as shipped, and not where `self` is an allowed name. */
export const thisAliasedAsSelf = `export function countOf(this: { readonly count: number }): number {
  const self = this
  return self.count
}
`

/** `@typescript-eslint/no-this-alias`: reported where destructuring `this` is not allowed, and not as shipped. */
export const thisDestructured = `export function countOf(this: { readonly count: number }): number {
  const { count } = this
  return count
}
`

/** `@typescript-eslint/no-inferrable-types`: an annotation its literal initializer implies, reported as shipped. */
export const annotationTheInitializerImplies = `export const count: number = 1
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

/** Suppresses oxlint's name of unicorn's no-for-each, which the unicorn we install lacks. */
export const suppressionOfOxlintsUnicornName = `// eslint-disable-next-line unicorn/no-array-for-each
export const total = 1
`

/** `@eslint-react/dom-no-dangerously-set-innerhtml`. */
export const innerHtmlSetDangerously = `export const Html = ({ html }: { readonly html: string }) => <div dangerouslySetInnerHTML={{ __html: html }} />
`

/** `@eslint-react/dom-no-missing-button-type`. */
export const buttonWithoutAType = `export const Save = () => <button>save</button>
`

/** `jsx-no-useless-fragment`, a rule name both eslint-plugin-react and @eslint-react have: each reports it. */
export const uselessFragment = `export const One = () => <><div /></>
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
