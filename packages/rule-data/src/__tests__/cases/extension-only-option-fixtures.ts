// Code each option only typescript-eslint's version of a twin pair takes changes the report on
// (oxlint-refused-options.integration.test.ts): typescript-eslint's version reports it one way with
// the option and another without, and oxlint's copy of the core rule owes the same change wherever
// data/oxlint-refused-options.json does not list the option's key (D11: a decided setting is never
// silently dropped). Each line that draws a finding is noted beside the fixture.

/** What a fixture's report is: the lines the rule reports, or the file's text after each engine's safe fixes. */
export type ReportKind = 'findings' | 'fixed text'

export type ExtensionOnlyOptionFixture = {
  /** The core rule, by its ID, typescript-eslint's version of which takes the option. */
  readonly coreRule: string
  /** The option, by its path from the options' root, as optionsOnlyTheFirstSchemaTakes names it. */
  readonly option: string
  /** The key of the options object the option is given under, as the data lists it. */
  readonly key: string
  /** The rule's options without the option, and with it. */
  readonly without: readonly unknown[]
  readonly with: readonly unknown[]
  /** A TS file's source, whose report the option changes in typescript-eslint. */
  readonly source: string
  readonly reportOf: ReportKind
}

/** A file the fixtures' sources import from. */
export const IMPORTED_FILE = { name: 'one.ts', source: 'export const one = 1\n' } as const

export const EXTENSION_ONLY_OPTION_FIXTURES: readonly ExtensionOnlyOptionFixture[] = [
  // Each method uses no `this` (3, 6); the option leaves alone the one in the class implementing an interface (3).
  {
    coreRule: 'class-methods-use-this',
    option: '.ignoreClassesThatImplementAnInterface',
    key: 'ignoreClassesThatImplementAnInterface',
    without: [],
    with: [{ ignoreClassesThatImplementAnInterface: true }],
    source: `interface Shape { area(): number }
export class Square implements Shape {
  area(): number { return 1 }
}
export class Loose {
  area(): number { return 1 }
}
`,
    reportOf: 'findings',
  },
  // Each method uses no `this` (3, 4); 'public-fields' leaves alone the public one of a class implementing an interface (3).
  {
    coreRule: 'class-methods-use-this',
    option: '.ignoreClassesThatImplementAnInterface',
    key: 'ignoreClassesThatImplementAnInterface',
    without: [],
    with: [{ ignoreClassesThatImplementAnInterface: 'public-fields' }],
    source: `interface Shape { area(): number }
export class Square implements Shape {
  area(): number { return 1 }
  private side(): number { return 1 }
}
`,
    reportOf: 'findings',
  },
  // An empty private constructor (2) and an empty protected one (5).
  {
    coreRule: 'no-empty-function',
    option: '.allow[]="private-constructors"',
    key: 'allow',
    without: [],
    with: [{ allow: ['private-constructors'] }],
    source: `export class Hidden {
  private constructor() {}
}
export class Shielded {
  protected constructor() {}
}
`,
    reportOf: 'findings',
  },
  {
    coreRule: 'no-empty-function',
    option: '.allow[]="protected-constructors"',
    key: 'allow',
    without: [],
    with: [{ allow: ['protected-constructors'] }],
    source: `export class Hidden {
  private constructor() {}
}
export class Shielded {
  protected constructor() {}
}
`,
    reportOf: 'findings',
  },
  // An interface declared twice (2), which typescript-eslint's default leaves alone as a declaration merge.
  {
    coreRule: 'no-redeclare',
    option: '.ignoreDeclarationMerge',
    key: 'ignoreDeclarationMerge',
    without: [],
    with: [{ ignoreDeclarationMerge: false }],
    source: `interface Shape { a: string }
interface Shape { b: string }
export type { Shape }
`,
    reportOf: 'findings',
  },
  // An unused import (1), which the option has a safe fix remove: without it, removing it is a suggestion.
  {
    coreRule: 'no-unused-vars',
    option: '.enableAutofixRemoval',
    key: 'enableAutofixRemoval',
    without: [],
    with: [{ enableAutofixRemoval: { imports: true } }],
    source: `import { one } from './one'
export const two = 2
`,
    reportOf: 'fixed text',
  },
  // A property read into a variable with a type annotation (2), which the option has destructured.
  {
    coreRule: 'prefer-destructuring',
    option: '.enforceForDeclarationWithTypeAnnotation',
    key: 'enforceForDeclarationWithTypeAnnotation',
    without: [{ VariableDeclarator: { object: true } }],
    with: [{ VariableDeclarator: { object: true } }, { enforceForDeclarationWithTypeAnnotation: true }],
    source: `declare const shape: { side: number }
export const side: number = shape.side
`,
    reportOf: 'findings',
  },
]
