export const throwingDefaultAfterEveryCase = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultInABlock = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default: {
      const message = 'no such engine'
      throw new Error(message)
    }
  }
}
`

export const throwingDefaultOnADiscriminant = `type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; side: number }

export function areaOf(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2
    case 'square':
      return shape.side ** 2
    default:
      throw new Error('no such shape')
  }
}
`

// The union, not its property: TypeScript narrows `shape` to never at the default, where `shape.kind` is a property of
// never and fails to compile.
export const neverDefaultOnADiscriminant = `type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; side: number }

export function areaOf(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2
    case 'square':
      return shape.side ** 2
    default: {
      const unhandled: never = shape
      return unhandled
    }
  }
}
`

export const throwingDefaultOnAPropertyOfAnObject = `type Engine = 'eslint' | 'oxlint'

type Config = { engine: Engine; strict: boolean }

export function binOf(config: Config): string {
  switch (config.engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

// The object is no union, so TypeScript narrows the property it reads, not the object, to never at the default.
export const neverDefaultOnAPropertyOfAnObject = `type Engine = 'eslint' | 'oxlint'

type Config = { engine: Engine; strict: boolean }

export function binOf(config: Config): string {
  switch (config.engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default: {
      const unhandled: never = config.engine
      return unhandled
    }
  }
}
`

// Every member's size holds both values, so a size tells no member apart, and TypeScript narrows the size alone.
export const throwingDefaultOnAPropertyOfAUnionItDoesNotTellApart = `type Size = 'small' | 'large'

type Box = { size: Size; width: number } | { size: Size; height: number }

export function scaleOf(box: Box): number {
  switch (box.size) {
    case 'small':
      return 1
    case 'large':
      return 2
    default:
      throw new Error('no such size')
  }
}
`

export const neverDefaultOnAPropertyOfAUnionItDoesNotTellApart = `type Size = 'small' | 'large'

type Box = { size: Size; width: number } | { size: Size; height: number }

export function scaleOf(box: Box): number {
  switch (box.size) {
    case 'small':
      return 1
    case 'large':
      return 2
    default: {
      const unhandled: never = box.size
      return unhandled
    }
  }
}
`

// One member's size holds a value the other's does not, so the size tells the members apart, and TypeScript narrows
// the union to never at the default: `box.size` there is a property of never.
export const throwingDefaultOnAPropertyOfAUnionItPartlyTellsApart = `type Box = { size: 'small'; width: number } | { size: 'small' | 'large'; height: number }

export function scaleOf(box: Box): number {
  switch (box.size) {
    case 'small':
      return 1
    case 'large':
      return 2
    default:
      throw new Error('no such size')
  }
}
`

export const neverDefaultOnAPropertyOfAUnionItPartlyTellsApart = `type Box = { size: 'small'; width: number } | { size: 'small' | 'large'; height: number }

export function scaleOf(box: Box): number {
  switch (box.size) {
    case 'small':
      return 1
    case 'large':
      return 2
    default: {
      const unhandled: never = box
      return unhandled
    }
  }
}
`

export const throwingDefaultOnANestedProperty = `type Engine = 'eslint' | 'oxlint'

type Job = { config: { engine: Engine } }

export function binOf(job: Job): string {
  switch (job.config.engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const neverDefaultOnANestedProperty = `type Engine = 'eslint' | 'oxlint'

type Job = { config: { engine: Engine } }

export function binOf(job: Job): string {
  switch (job.config.engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default: {
      const unhandled: never = job.config.engine
      return unhandled
    }
  }
}
`

export const throwingDefaultOnTheDiscriminantOfANestedUnion = `type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; side: number }

type Drawing = { shape: Shape }

export function areaOf(drawing: Drawing): number {
  switch (drawing.shape.kind) {
    case 'circle':
      return Math.PI * drawing.shape.radius ** 2
    case 'square':
      return drawing.shape.side ** 2
    default:
      throw new Error('no such shape')
  }
}
`

// The union is the object holding the discriminant, not the outermost object: TypeScript narrows `drawing.shape` to
// never at the default and leaves `drawing` as it is.
export const neverDefaultOnTheDiscriminantOfANestedUnion = `type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; side: number }

type Drawing = { shape: Shape }

export function areaOf(drawing: Drawing): number {
  switch (drawing.shape.kind) {
    case 'circle':
      return Math.PI * drawing.shape.radius ** 2
    case 'square':
      return drawing.shape.side ** 2
    default: {
      const unhandled: never = drawing.shape
      return unhandled
    }
  }
}
`

export const throwingDefaultOnAnElementOfAnObject = `type Engine = 'eslint' | 'oxlint'

type Config = { engine: Engine; strict: boolean }

export function binOf(config: Config): string {
  switch (config['engine']) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const neverDefaultOnAnElementOfAnObject = `type Engine = 'eslint' | 'oxlint'

type Config = { engine: Engine; strict: boolean }

export function binOf(config: Config): string {
  switch (config['engine']) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default: {
      const unhandled: never = config['engine']
      return unhandled
    }
  }
}
`

// Both the union and the element compile in a never default here: an element read from never is never, with no error.
export const throwingDefaultOnADiscriminantReadAsAnElement = `type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; side: number }

export function areaOf(shape: Shape): number {
  switch (shape['kind']) {
    case 'circle':
      return Math.PI * shape.radius ** 2
    case 'square':
      return shape.side ** 2
    default:
      throw new Error('no such shape')
  }
}
`

export const neverDefaultOnADiscriminantReadAsAnElement = `type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; side: number }

export function areaOf(shape: Shape): number {
  switch (shape['kind']) {
    case 'circle':
      return Math.PI * shape.radius ** 2
    case 'square':
      return shape.side ** 2
    default: {
      const unhandled: never = shape
      return unhandled
    }
  }
}
`

export const throwingDefaultOnADiscriminantReadThroughAnOptionalChain = `type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; side: number }

export function areaOf(shape: Shape | undefined): number {
  switch (shape?.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2
    case 'square':
      return shape.side ** 2
    case undefined:
      return 0
    default:
      throw new Error('no such shape')
  }
}
`

// As for `shape.kind`: the union is narrowed to never at the default, and `shape?.kind` there fails to compile.
export const neverDefaultOnADiscriminantReadThroughAnOptionalChain = `type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; side: number }

export function areaOf(shape: Shape | undefined): number {
  switch (shape?.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2
    case 'square':
      return shape.side ** 2
    case undefined:
      return 0
    default: {
      const unhandled: never = shape
      return unhandled
    }
  }
}
`

export const throwingDefaultOnAnAssignment = `type Engine = 'eslint' | 'oxlint'

declare function readEngine(): Engine

export function binOf(): string {
  let engine: Engine
  switch (engine = readEngine()) {
    case 'eslint':
      return engine
    case 'oxlint':
      return engine
    default:
      throw new Error('no such engine')
  }
}
`

// TypeScript narrows the name assigned to, at the default; the assignment there would run again, at its declared type.
export const neverDefaultOnAnAssignment = `type Engine = 'eslint' | 'oxlint'

declare function readEngine(): Engine

export function binOf(): string {
  let engine: Engine
  switch (engine = readEngine()) {
    case 'eslint':
      return engine
    case 'oxlint':
      return engine
    default: {
      const unhandled: never = engine
      return unhandled
    }
  }
}
`

export const throwingDefaultAfterEveryEnumMember = `enum Severity {
  Warn = 1,
  Error = 2,
}

export function labelOf(severity: Severity): string {
  switch (severity) {
    case Severity.Warn:
      return 'warn'
    case Severity.Error:
      return 'error'
    default:
      throw new Error('no such severity')
  }
}
`

export const throwingDefaultAfterTrueAndFalse = `export function wordFor(on: boolean): string {
  switch (on) {
    case true:
      return 'on'
    case false:
      return 'off'
    default:
      throw new Error('neither')
  }
}
`

export const neverDefaultAfterEveryCase = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default: {
      const unhandled: never = engine
      return unhandled
    }
  }
}
`

// The never binding keeps TypeScript's error for a missing case; the throw only follows it.
export const neverBindingThenThrow = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default: {
      const unhandled: never = engine
      throw new Error(String(unhandled))
    }
  }
}
`

export const throwingDefaultAfterSomeCases = `type Engine = 'eslint' | 'oxlint' | 'biome'

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('not supported')
  }
}
`

export const throwingDefaultOnAString = `export function binOf(engine: string): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

// `case max` names every number at once, not one value, so the cases list no values of the type.
export const throwingDefaultAfterACaseOfAWholeType = `export function labelOf(limit: number, max: number): string {
  switch (limit) {
    case 0:
      return 'none'
    case max:
      return 'max'
    default:
      throw new Error('a limit between 0 and max')
  }
}
`

export const noDefaultAfterEveryCase = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
  }
}
`

export const returningDefaultAfterEveryCase = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string | null {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      return null
  }
}
`

// The last case runs the default's throw, so the default's body is reachable.
export const caseFallingIntoAThrowingDefault = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
    default:
      throw new Error('oxlint has no bin here')
  }
}
`

// The last case runs its own statement, then the default's throw: a never default there fails to compile.
export const caseWithStatementsFallingIntoAThrowingDefault = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      note('oxlint has no bin')
    // falls through
    default:
      throw new Error('no bin')
  }
}
`

// As above, the last case's statement in a block.
export const caseBlockFallingIntoAThrowingDefault = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint': {
      note('oxlint has no bin')
    }
    // falls through
    default:
      throw new Error('no bin')
  }
}
`

export const throwingDefaultAfterCasesThatBreak = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function noteOf(engine: Engine): void {
  switch (engine) {
    case 'eslint':
      note('eslint')
      break
    case 'oxlint':
      note('oxlint')
      break
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultAfterACaseBlockThatReturns = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint': {
      note('oxlint has a bin')
      return 'oxlint'
    }
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultAfterACaseThatThrows = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      throw new Error('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultAfterCasesThatContinue = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function noteEach(engines: readonly Engine[]): void {
  for (const engine of engines) {
    switch (engine) {
      case 'eslint':
        note('eslint')
        continue
      case 'oxlint':
        note('oxlint')
        continue
      default:
        throw new Error('no such engine')
    }
  }
}
`

// Nothing comes before the default, so no case falls into it.
export const throwingDefaultBeforeEveryCase = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch (engine) {
    default:
      throw new Error('no such engine')
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
  }
}
`

export const throwingDefaultAfterACaseWhoseIfAndElseBothReturn = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine, local: boolean): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      if (local) return './oxlint'
      else return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultAfterACaseWhoseIfAndElseBlocksBothReturn = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine, local: boolean): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      if (local) {
        return './oxlint'
      } else {
        return 'oxlint'
      }
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultAfterACaseThatReturnsFromATryWithAFinally = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      try {
        return 'oxlint'
      } finally {
        note('done')
      }
    default:
      throw new Error('no such engine')
  }
}
`

// TypeScript reads a call to a function declared to return never as leaving the case.
export const throwingDefaultAfterACaseThatCallsAFunctionReturningNever = `type Engine = 'eslint' | 'oxlint'

declare function fail(text: string): never

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      fail('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultAfterACaseThatReturnsFromANestedBlock = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      {
        {
          return 'oxlint'
        }
      }
    default:
      throw new Error('no such engine')
  }
}
`

// Without local, the last case runs on into the default: a never default there fails to compile.
export const caseFallingIntoAThrowingDefaultPastAnIfWithoutAnElse = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine, local: boolean): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      if (local) return './oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

// A catch that completes runs on into the default: a never default there fails to compile.
export const caseFallingIntoAThrowingDefaultFromACatch = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      try {
        return 'oxlint'
      } catch {
        note('failed')
      }
    default:
      throw new Error('no such engine')
  }
}
`

// TypeScript reads a call as leaving only where every name in it is declared with a type, and `fail` is
// inferred, so the case runs on into the default: a never default there fails to compile.
export const caseFallingIntoAThrowingDefaultPastACallToAnInferredNeverFunction = `type Engine = 'eslint' | 'oxlint'

const fail = (text: string): never => {
  throw new Error(text)
}

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      fail('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultAfterACaseThatCallsANeverFunctionDeclaredWithItsType = `type Engine = 'eslint' | 'oxlint'

declare const fail: (text: string) => never

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      fail('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultAfterACaseThatCallsANeverMethod = `type Engine = 'eslint' | 'oxlint'

declare const failures: { fail(text: string): never }

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      failures.fail('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultAfterACaseThatCallsAnImportedNeverFunction = `type Engine = 'eslint' | 'oxlint'

declare namespace Failures {
  function fail(text: string): never
}
import fail = Failures.fail

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      fail('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

// TypeScript reads the call by the overload it resolves to, here the second.
export const throwingDefaultAfterACaseThatCallsAnOverloadReturningNever = `type Engine = 'eslint' | 'oxlint'

declare function fail(code: number): string
declare function fail(text: string): never

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      fail('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

// Nothing after the never call runs, the loop included.
export const throwingDefaultAfterACaseThatCallsANeverFunctionBeforeALoop = `type Engine = 'eslint' | 'oxlint'

declare function fail(text: string): never
declare function note(text: string): void

export function binOf(engine: Engine, local: boolean): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      fail('oxlint has no bin')
      while (local) note('waiting')
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultAfterACaseThatLoopsForever = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      while (true) note('waiting')
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultAfterACaseWhoseTryAndCatchBothReturn = `type Engine = 'eslint' | 'oxlint'

declare function binFrom(text: string): string

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      try {
        return binFrom('oxlint')
      } catch {
        return 'oxlint'
      }
    default:
      throw new Error('no such engine')
  }
}
`

// A function with no return type written returns as far as TypeScript reads a call to it.
export const caseFallingIntoAThrowingDefaultPastACallWithNoReturnTypeWritten = `type Engine = 'eslint' | 'oxlint'

function lengthOf(text: string) {
  return text.length
}

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      lengthOf('oxlint')
    default:
      throw new Error('no such engine')
  }
}
`

// Without local, the never call does not run, and the case runs on into the default.
export const caseFallingIntoAThrowingDefaultPastANeverCallInOneBranch = `type Engine = 'eslint' | 'oxlint'

declare function fail(text: string): never

export function binOf(engine: Engine, local: boolean): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      if (local) fail('local oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

// ESLint reads \`while (1)\` as endless; TypeScript does not, so a never default there fails to compile.
export const caseFallingIntoAThrowingDefaultPastALoopTestingOne = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      while (1) note('waiting')
    default:
      throw new Error('no such engine')
  }
}
`

export const caseFallingIntoAThrowingDefaultPastACallback = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      ;[engine].forEach((name) => note(name))
    default:
      throw new Error('no such engine')
  }
}
`

// TypeScript reads a call as leaving only where it is the whole statement, and the parentheses wrap it in another
// expression, so the case runs on into the default: a never default there fails to compile.
export const caseFallingIntoAThrowingDefaultPastAParenthesisedNeverCall = `type Engine = 'eslint' | 'oxlint'

declare function fail(text: string): never

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      (fail('oxlint has no bin'))
    default:
      throw new Error('no such engine')
  }
}
`

// TypeScript reads a loop as endless only where its test is a bare true, not one in parentheses, so the case runs on
// into the default: a never default there fails to compile.
export const caseFallingIntoAThrowingDefaultPastAWhileTestingAParenthesisedTrue = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      while ((true)) note('waiting')
    default:
      throw new Error('no such engine')
  }
}
`

export const caseFallingIntoAThrowingDefaultPastAForTestingAParenthesisedTrue = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      for (; (true); ) note('waiting')
    default:
      throw new Error('no such engine')
  }
}
`

export const caseFallingIntoAThrowingDefaultPastADoWhileTestingAParenthesisedTrue = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      do {
        note('waiting')
      } while ((true))
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultAfterACaseThatLoopsForeverInAFor = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      for (; true; ) note('waiting')
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultAfterACaseThatLoopsForeverInADoWhile = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      do {
        note('waiting')
      } while (true)
    default:
      throw new Error('no such engine')
  }
}
`

// The catch runs on, but into the return after it, so the case does not fall into the default.
export const throwingDefaultAfterACaseThatReturnsAfterATryWhoseCatchCompletes = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      try {
        return 'oxlint'
      } catch {
        note('failed')
      }
      return 'none'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultAfterACaseThatReturnsAfterALoopTestingOne = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine, local: boolean): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      while (1) {
        if (local) break
        note('waiting')
      }
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

// The loop is the callback's, so where it ends says nothing about where the case ends.
export const throwingDefaultAfterACaseThatReturnsPastACallbackLoopingOnOne = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint': {
      const spin = () => {
        while (1) note('waiting')
      }
      spin()
      return 'oxlint'
    }
    default:
      throw new Error('no such engine')
  }
}
`

export const caseFallingIntoAThrowingDefaultPastACallbackLoopingOnOne = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint': {
      const spin = () => {
        while (1) note('waiting')
      }
      spin()
    }
    default:
      throw new Error('no such engine')
  }
}
`

// The try is the callback's, so where its catch goes says nothing about where the case ends.
export const throwingDefaultAfterACaseThatReturnsPastACallbackWithATry = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint': {
      const read = () => {
        try {
          return 'oxlint'
        } catch {
          return 'none'
        }
      }
      return read()
    }
    default:
      throw new Error('no such engine')
  }
}
`

export const caseFallingIntoAThrowingDefaultPastACallbackWithATry = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint': {
      const read = () => {
        try {
          return 'oxlint'
        } catch {
          return 'none'
        }
      }
      note(read())
    }
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultAfterACaseThatThrowsAfterALoopTestingOne = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine, local: boolean): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      while (1) {
        if (local) break
        note('waiting')
      }
      throw new Error('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultAfterACaseThatBreaksAfterALoopTestingOne = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function noteOf(engine: Engine, local: boolean): void {
  switch (engine) {
    case 'eslint':
      note('eslint')
      break
    case 'oxlint':
      while (1) {
        if (local) break
        note('waiting')
      }
      break
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultAfterACaseThatContinuesAfterALoopTestingOne = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function noteEach(engines: readonly Engine[], local: boolean): void {
  for (const engine of engines) {
    switch (engine) {
      case 'eslint':
        note('eslint')
        continue
      case 'oxlint':
        while (1) {
          if (local) break
          note('waiting')
        }
        continue
      default:
        throw new Error('no such engine')
    }
  }
}
`

// The case ends in an if and else that both return, so only where the callback's loop sits decides the verdict.
export const throwingDefaultAfterACaseWhoseIfAndElseReturnPastACallbackLoopingOnOne = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine, local: boolean): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint': {
      const spin = () => {
        while (1) note('waiting')
      }
      spin()
      if (local) return './oxlint'
      else return 'oxlint'
    }
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultAfterACaseWhoseIfAndElseReturnPastACallbackWithATry = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine, local: boolean): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint': {
      const read = () => {
        try {
          return 'oxlint'
        } catch {
          return 'none'
        }
      }
      if (local) return read()
      else return 'oxlint'
    }
    default:
      throw new Error('no such engine')
  }
}
`

// Three statements, so the one that ends the case is the last and not the second.
export const throwingDefaultAfterACaseThatReturnsAfterACallAndALoopTestingOne = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine, local: boolean): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      note('starting')
      while (1) {
        if (local) break
        note('waiting')
      }
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

// The function is a statement of the case itself, so the case is the node right outside it.
export const throwingDefaultAfterACaseWhoseIfAndElseReturnPastAFunctionDeclaredInIt = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine, local: boolean): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      function spin(): void {
        while (1) note('waiting')
      }
      spin()
      if (local) return './oxlint'
      else return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

// The block holding the loop is the first of two statements, so the case ends at the return after it.
export const throwingDefaultAfterACaseThatReturnsAfterABlockHoldingALoopTestingOne = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine, local: boolean): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      {
        while (1) {
          if (local) break
        }
      }
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

// The loop is the method's, so where it ends says nothing about where the case ends.
export const throwingDefaultAfterACaseWhoseIfAndElseReturnPastAMethodLoopingOnOne = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine, local: boolean): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint': {
      const spinner = {
        spin() {
          while (1) note('waiting')
        },
      }
      if (local) return String(spinner)
      else return 'oxlint'
    }
    default:
      throw new Error('no such engine')
  }
}
`

export const caseFallingIntoAThrowingDefaultPastAMethodLoopingOnOne = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint': {
      const spinner = {
        spin() {
          while (1) note('waiting')
        },
      }
      spinner.spin()
    }
    default:
      throw new Error('no such engine')
  }
}
`

// A static block runs on a code path of its own, as a function does, so where its loop ends says nothing about where
// the case ends.
export const throwingDefaultAfterACaseWhoseIfAndElseReturnPastAStaticBlockLoopingOnOne = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine, local: boolean): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint': {
      class Spinner {
        static {
          while (1) note('waiting')
        }
      }
      if (local) return String(Spinner)
      else return 'oxlint'
    }
    default:
      throw new Error('no such engine')
  }
}
`

export const caseFallingIntoAThrowingDefaultPastAStaticBlockLoopingOnOne = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint': {
      class Spinner {
        static {
          while (1) note('waiting')
        }
      }
      note(String(Spinner))
    }
    default:
      throw new Error('no such engine')
  }
}
`

// ESLint enters a catch only from what in its try can throw, so it reads this switch as never run; TypeScript enters
// it from the try's start and narrows the value at the default to never, so a never default there compiles.
export const throwingDefaultAfterEveryCaseInACatchESLintReadsAsNeverRun = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  try {
    return 'none'
  } catch {
    switch (engine) {
      case 'eslint':
        return 'eslint'
      case 'oxlint':
        return 'oxlint'
      default:
        throw new Error('no such engine')
    }
  }
}
`

// As above, where TypeScript reads the last case running on into the default: a never default there fails to compile.
export const caseFallingIntoAThrowingDefaultInACatchESLintReadsAsNeverRun = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  try {
    return 'none'
  } catch {
    switch (engine) {
      case 'eslint':
        return 'eslint'
      case 'oxlint':
        note('oxlint has no bin')
      default:
        throw new Error('no such engine')
    }
  }
}
`

// ESLint reads code after \`while (1)\` as never run; TypeScript reads it as run, and the last case as running on into
// the default: a never default there fails to compile.
export const caseFallingIntoAThrowingDefaultInASwitchAfterALoopTestingOne = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  while (1) note('waiting')
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      note('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

export const caseFallingIntoAThrowingDefaultInASwitchAfterAWhileTestingAParenthesisedTrue = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  while ((true)) note('waiting')
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      note('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

// In code it reads as never run, TypeScript takes the value at the type it is declared with, so a never default there
// fails to compile whichever cases leave.
export const caseFallingIntoAThrowingDefaultInASwitchAfterAReturn = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  return 'none'
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      note('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

export const caseFallingIntoAThrowingDefaultInASwitchAfterANeverCallInACase = `type Engine = 'eslint' | 'oxlint'

declare function fail(text: string): never
declare function note(text: string): void

export function binOf(engine: Engine, local: boolean): string {
  switch (local) {
    case true:
      fail('local oxlint has no bin')
      switch (engine) {
        case 'eslint':
          return 'eslint'
        case 'oxlint':
          note('oxlint has no bin')
        default:
          throw new Error('no such engine')
      }
  }
  return 'none'
}
`

export const caseFallingIntoAThrowingDefaultInASwitchAfterALoopTestingOneInACase = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine, local: boolean): string {
  switch (local) {
    case true:
      while (1) note('waiting')
      switch (engine) {
        case 'eslint':
          return 'eslint'
        case 'oxlint':
          note('oxlint has no bin')
        default:
          throw new Error('no such engine')
      }
  }
  return 'none'
}
`

export const throwingDefaultAfterEveryCaseInASwitchAfterAReturn = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  return 'none'
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultAfterEveryCaseInASwitchAfterANeverCall = `type Engine = 'eslint' | 'oxlint'

declare function fail(text: string): never

export function binOf(engine: Engine): string {
  fail('no bin')
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultAfterEveryCaseInASwitchAfterANeverCallInACase = `type Engine = 'eslint' | 'oxlint'

declare function fail(text: string): never

export function binOf(engine: Engine, local: boolean): string {
  switch (local) {
    case true:
      fail('local oxlint has no bin')
      switch (engine) {
        case 'eslint':
          return 'eslint'
        case 'oxlint':
          return 'oxlint'
        default:
          throw new Error('no such engine')
      }
  }
  return 'none'
}
`

export const throwingDefaultAfterEveryCaseInASwitchAfterALoopThatRunsForever = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  while (true) note('waiting')
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultAfterEveryCaseInASwitchAfterANeverCallInABranch = `type Engine = 'eslint' | 'oxlint'

declare function fail(text: string): never

export function binOf(engine: Engine, local: boolean): string {
  if (local) {
    fail('local oxlint has no bin')
    switch (engine) {
      case 'eslint':
        return 'eslint'
      case 'oxlint':
        return 'oxlint'
      default:
        throw new Error('no such engine')
    }
  }
  return 'none'
}
`

export const caseFallingIntoAThrowingDefaultInASwitchAfterANeverCall = `type Engine = 'eslint' | 'oxlint'

declare function fail(text: string): never
declare function note(text: string): void

export function binOf(engine: Engine): string {
  fail('no bin')
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      note('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

// TypeScript does not read \`while (1)\` as endless, so it reads the switch after it as run and narrows the value at the
// default to never: a never default there compiles.
export const throwingDefaultAfterEveryCaseInASwitchAfterALoopTestingOne = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  while (1) note('waiting')
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnAnElementWithAConstKey = `type Engine = 'eslint' | 'oxlint'

type Config = { engine: Engine }

const KEY = 'engine'

export function binOf(config: Config): string {
  switch (config[KEY]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const neverDefaultOnAnElementWithAConstKey = `type Engine = 'eslint' | 'oxlint'

type Config = { engine: Engine }

const KEY = 'engine'

export function binOf(config: Config): string {
  switch (config[KEY]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default: {
      const unhandled: never = config[KEY]
      return unhandled
    }
  }
}
`

// TypeScript narrows an element read with a `const`, a template or a unique symbol key as it narrows a property; in
// code it reads as never run it takes the element at its declared type, so a never default there fails to compile.
export const throwingDefaultOnAnElementWithAConstKeyInASwitchAfterAReturn = `type Engine = 'eslint' | 'oxlint'

type Config = { engine: Engine }

const KEY = 'engine'

export function binOf(config: Config): string {
  return 'none'
  switch (config[KEY]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const caseFallingIntoAThrowingDefaultOnAnElementWithAConstKeyInASwitchAfterALoopTestingOne = `type Engine = 'eslint' | 'oxlint'

type Config = { engine: Engine }

const KEY = 'engine'

declare function note(text: string): void

export function binOf(config: Config): string {
  while (1) note('waiting')
  switch (config[KEY]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      note('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnAnElementWithATemplateKey = `type Engine = 'eslint' | 'oxlint'

type Config = { engine: Engine }

export function binOf(config: Config): string {
  switch (config[\`engine\`]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const neverDefaultOnAnElementWithATemplateKey = `type Engine = 'eslint' | 'oxlint'

type Config = { engine: Engine }

export function binOf(config: Config): string {
  switch (config[\`engine\`]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default: {
      const unhandled: never = config[\`engine\`]
      return unhandled
    }
  }
}
`

export const throwingDefaultOnAnElementWithATemplateKeyInASwitchAfterAReturn = `type Engine = 'eslint' | 'oxlint'

type Config = { engine: Engine }

export function binOf(config: Config): string {
  return 'none'
  switch (config[\`engine\`]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const caseFallingIntoAThrowingDefaultOnAnElementWithATemplateKeyInASwitchAfterALoopTestingOne = `type Engine = 'eslint' | 'oxlint'

type Config = { engine: Engine }

declare function note(text: string): void

export function binOf(config: Config): string {
  while (1) note('waiting')
  switch (config[\`engine\`]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      note('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnAnElementWithAUniqueSymbolKey = `type Engine = 'eslint' | 'oxlint'

const ENGINE: unique symbol = Symbol('engine')

type Config = { [ENGINE]: Engine }

export function binOf(config: Config): string {
  switch (config[ENGINE]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const neverDefaultOnAnElementWithAUniqueSymbolKey = `type Engine = 'eslint' | 'oxlint'

const ENGINE: unique symbol = Symbol('engine')

type Config = { [ENGINE]: Engine }

export function binOf(config: Config): string {
  switch (config[ENGINE]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default: {
      const unhandled: never = config[ENGINE]
      return unhandled
    }
  }
}
`

export const throwingDefaultOnAnElementWithAUniqueSymbolKeyInASwitchAfterAReturn = `type Engine = 'eslint' | 'oxlint'

const ENGINE: unique symbol = Symbol('engine')

type Config = { [ENGINE]: Engine }

export function binOf(config: Config): string {
  return 'none'
  switch (config[ENGINE]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const caseFallingIntoAThrowingDefaultOnAnElementWithAUniqueSymbolKeyInASwitchAfterALoopTestingOne = `type Engine = 'eslint' | 'oxlint'

const ENGINE: unique symbol = Symbol('engine')

type Config = { [ENGINE]: Engine }

declare function note(text: string): void

export function binOf(config: Config): string {
  while (1) note('waiting')
  switch (config[ENGINE]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      note('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

// An accessor: a class field read through `super` fails to compile (TS2855).
export const throwingDefaultOnAPropertyOfSuper = `type Engine = 'eslint' | 'oxlint'

class Settings {
  get engine(): Engine {
    return 'eslint'
  }
}

export class Linter extends Settings {
  binOf(): string {
    switch (super.engine) {
      case 'eslint':
        return 'eslint'
      case 'oxlint':
        return 'oxlint'
      default:
        throw new Error('no such engine')
    }
  }
}
`

export const neverDefaultOnAPropertyOfSuper = `type Engine = 'eslint' | 'oxlint'

class Settings {
  get engine(): Engine {
    return 'eslint'
  }
}

export class Linter extends Settings {
  binOf(): string {
    switch (super.engine) {
      case 'eslint':
        return 'eslint'
      case 'oxlint':
        return 'oxlint'
      default: {
        const unhandled: never = super.engine
        return unhandled
      }
    }
  }
}
`

export const throwingDefaultOnAPropertyOfSuperInASwitchAfterAReturn = `type Engine = 'eslint' | 'oxlint'

class Settings {
  get engine(): Engine {
    return 'eslint'
  }
}

export class Linter extends Settings {
  binOf(): string {
    return 'none'
    switch (super.engine) {
      case 'eslint':
        return 'eslint'
      case 'oxlint':
        return 'oxlint'
      default:
        throw new Error('no such engine')
    }
  }
}
`

export const caseFallingIntoAThrowingDefaultOnAPropertyOfSuperInASwitchAfterALoopTestingOne = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

class Settings {
  get engine(): Engine {
    return 'eslint'
  }
}

export class Linter extends Settings {
  binOf(): string {
    while (1) note('waiting')
    switch (super.engine) {
      case 'eslint':
        return 'eslint'
      case 'oxlint':
        note('oxlint has no bin')
      default:
        throw new Error('no such engine')
    }
  }
}
`

// TypeScript narrows the value under `!` where it cannot be null: a never default binding `engine` or `engine!`
// compiles.
export const throwingDefaultOnANonNullAssertionOnAValueThatCannotBeNull = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch (engine!) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const neverDefaultOnANonNullAssertionOnAValueThatCannotBeNull = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch (engine!) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default: {
      const unhandled: never = engine
      return unhandled
    }
  }
}
`

export const throwingDefaultOnANonNullAssertionOnAValueThatCannotBeNullInASwitchAfterAReturn = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  return 'none'
  switch (engine!) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const caseFallingIntoAThrowingDefaultOnANonNullAssertionOnAValueThatCannotBeNullInASwitchAfterALoopTestingOne = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  while (1) note('waiting')
  switch (engine!) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      note('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

// TypeScript narrows the union under `!` by its discriminant: a never default binding `shape` or `shape!` compiles, and
// one binding `shape!.kind`, a property of never, does not.
export const throwingDefaultOnTheDiscriminantOfANonNullAssertedUnion = `type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; side: number }

export function areaOf(shape: Shape): number {
  switch (shape!.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2
    case 'square':
      return shape.side ** 2
    default:
      throw new Error('no such shape')
  }
}
`

export const neverDefaultOnTheDiscriminantOfANonNullAssertedUnion = `type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; side: number }

export function areaOf(shape: Shape): number {
  switch (shape!.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2
    case 'square':
      return shape.side ** 2
    default: {
      const unhandled: never = shape
      return unhandled
    }
  }
}
`

// Cases return constants: `shape` may still be `undefined` in them (TS18048 on `shape.radius`), while at the default
// TypeScript narrows it to never all the same.
export const throwingDefaultOnTheDiscriminantOfANonNullAssertedUnionThatCanBeUndefined = `type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; side: number }

export function areaOf(shape: Shape | undefined): number {
  switch (shape!.kind) {
    case 'circle':
      return 1
    case 'square':
      return 2
    default:
      throw new Error('no such shape')
  }
}
`

export const neverDefaultOnTheDiscriminantOfANonNullAssertedUnionThatCanBeUndefined = `type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; side: number }

export function areaOf(shape: Shape | undefined): number {
  switch (shape!.kind) {
    case 'circle':
      return 1
    case 'square':
      return 2
    default: {
      const unhandled: never = shape
      return unhandled
    }
  }
}
`

// Cases return constants: in code it reads as never run TypeScript narrows nothing, so `shape.radius` would not
// compile.
export const throwingDefaultOnTheDiscriminantOfANonNullAssertedUnionInASwitchAfterAReturn = `type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; side: number }

export function areaOf(shape: Shape): number {
  return 0
  switch (shape!.kind) {
    case 'circle':
      return 1
    case 'square':
      return 2
    default:
      throw new Error('no such shape')
  }
}
`

export const caseFallingIntoAThrowingDefaultOnTheDiscriminantOfANonNullAssertedUnionInASwitchAfterALoopTestingOne = `type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; side: number }

declare function note(text: string): void

export function areaOf(shape: Shape): number {
  while (1) note('waiting')
  switch (shape!.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2
    case 'square':
      note('a square')
    default:
      throw new Error('no such shape')
  }
}
`

// TypeScript narrows a comma's last operand: a never default binding `engine`, or the whole parenthesised comma,
// compiles; the comma without its parentheses does not.
export const throwingDefaultOnACommaExpression = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  switch ((note('choosing a bin'), engine)) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const neverDefaultOnACommaExpression = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  switch ((note('choosing a bin'), engine)) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default: {
      const unhandled: never = engine
      return unhandled
    }
  }
}
`

export const throwingDefaultOnACommaExpressionInASwitchAfterAReturn = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  return 'none'
  switch ((note('choosing a bin'), engine)) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const caseFallingIntoAThrowingDefaultOnACommaExpressionInASwitchAfterALoopTestingOne = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  while (1) note('waiting')
  switch ((note('choosing a bin'), engine)) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      note('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

// TypeScript narrows a value typed by a type parameter through its constraint where the value is read against a
// declared type, as `const unhandled: never` reads it.
export const throwingDefaultOnAGenericValue = `type Engine = 'eslint' | 'oxlint'

export function binOf<E extends Engine>(engine: E): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const neverDefaultOnAGenericValue = `type Engine = 'eslint' | 'oxlint'

export function binOf<E extends Engine>(engine: E): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default: {
      const unhandled: never = engine
      return unhandled
    }
  }
}
`

export const caseFallingIntoAThrowingDefaultOnAGenericValue = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf<E extends Engine>(engine: E): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      note('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnAGenericValueUsedAsAKey = `type Engine = 'eslint' | 'oxlint'

export function binOf<E extends Engine>(engine: E, bins: Readonly<Record<E, string>>): string {
  switch (engine) {
    case 'eslint':
      return bins[engine]
    case 'oxlint':
      return bins[engine]
    default:
      throw new Error('no such engine')
  }
}
`

export const neverDefaultOnAGenericValueUsedAsAKey = `type Engine = 'eslint' | 'oxlint'

export function binOf<E extends Engine>(engine: E, bins: Readonly<Record<E, string>>): string {
  switch (engine) {
    case 'eslint':
      return bins[engine]
    case 'oxlint':
      return bins[engine]
    default: {
      const unhandled: never = engine
      return unhandled
    }
  }
}
`

export const throwingDefaultOnAGenericPropertyOfThis = `type Engine = 'eslint' | 'oxlint'

export class Linter<E extends Engine> {
  constructor(readonly engine: E) {}

  binOf(): string {
    switch (this.engine) {
      case 'eslint':
        return 'eslint'
      case 'oxlint':
        return 'oxlint'
      default:
        throw new Error('no such engine')
    }
  }
}
`

export const neverDefaultOnAGenericPropertyOfThis = `type Engine = 'eslint' | 'oxlint'

export class Linter<E extends Engine> {
  constructor(readonly engine: E) {}

  binOf(): string {
    switch (this.engine) {
      case 'eslint':
        return 'eslint'
      case 'oxlint':
        return 'oxlint'
      default: {
        const unhandled: never = this.engine
        return unhandled
      }
    }
  }
}
`

// As for `shape.kind` on the union itself: `shape` is narrowed to never, and `shape.kind` would be a property of never.
export const throwingDefaultOnTheDiscriminantOfAGenericUnion = `type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; side: number }

export function areaOf<S extends Shape>(shape: S): number {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2
    case 'square':
      return shape.side ** 2
    default:
      throw new Error('no such shape')
  }
}
`

export const neverDefaultOnTheDiscriminantOfAGenericUnion = `type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; side: number }

export function areaOf<S extends Shape>(shape: S): number {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2
    case 'square':
      return shape.side ** 2
    default: {
      const unhandled: never = shape
      return unhandled
    }
  }
}
`

// The never default goes in place of the whole default, so the assignment in it does not run before the binding.
export const throwingDefaultOpeningWithAClassWhoseHeritageAssignsTheValue = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default: {
      class NoSuchEngine extends (engine = 'eslint', Error) {}
      throw new NoSuchEngine('no such engine')
    }
  }
}
`

export const throwingDefaultOpeningWithAnEnumWhoseInitializerAssignsTheValue = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default: {
      enum Reason {
        NoSuchEngine = (engine = 'eslint', 1),
      }
      throw new Error(String(Reason.NoSuchEngine))
    }
  }
}
`

// Each member is a string intersected with the brand, not a single value; TypeScript narrows it by the cases all the
// same.
export const throwingDefaultAfterEveryCaseOfABrandedUnion = `type Brand = { readonly brand: 'Engine' }

type Engine = ('eslint' | 'oxlint') & Brand

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const neverDefaultAfterEveryCaseOfABrandedUnion = `type Brand = { readonly brand: 'Engine' }

type Engine = ('eslint' | 'oxlint') & Brand

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default: {
      const unhandled: never = engine
      return unhandled
    }
  }
}
`

export const throwingDefaultAfterSomeCasesOfABrandedUnion = `type Brand = { readonly brand: 'Engine' }

type Engine = ('eslint' | 'oxlint' | 'biome') & Brand

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

// Typed with `exactOptionalPropertyTypes`, as the repo is: the property's `undefined` is not the same type as the one
// `case undefined` names, and TypeScript narrows both away.
export const throwingDefaultOnAnOptionalPropertyAfterEveryCaseAndUndefined = `type Engine = 'eslint' | 'oxlint'

type Config = { engine?: Engine }

export function binOf(config: Config): string {
  switch (config.engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    case undefined:
      return 'none'
    default:
      throw new Error('no such engine')
  }
}
`

export const neverDefaultOnAnOptionalPropertyAfterEveryCaseAndUndefined = `type Engine = 'eslint' | 'oxlint'

type Config = { engine?: Engine }

export function binOf(config: Config): string {
  switch (config.engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    case undefined:
      return 'none'
    default: {
      const unhandled: never = config.engine
      return unhandled
    }
  }
}
`

export const throwingDefaultOnAnOptionalPropertyAfterEveryCaseButUndefined = `type Engine = 'eslint' | 'oxlint'

type Config = { engine?: Engine }

export function binOf(config: Config): string {
  switch (config.engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no engine')
  }
}
`

// No never default compiles here (`holder`, `holder?.shape` and `holder?.shape.kind` all fail): the rule stays
// silent, and asking TypeScript must leave no error behind in the program it shares.
export const throwingDefaultOnTheDiscriminantOfANestedUnionReadThroughAnOptionalChain = `type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; side: number }

type Holder = { shape: Shape }

export function areaOf(holder: Holder | undefined): number {
  switch (holder?.shape.kind) {
    case 'circle':
      return Math.PI * holder.shape.radius ** 2
    case 'square':
      return holder.shape.side ** 2
    case undefined:
      return 0
    default:
      throw new Error('no such shape')
  }
}
`

export const caseFallingIntoAThrowingDefaultOnAnElementOfAnObjectInASwitchAfterALoopTestingOne = `type Engine = 'eslint' | 'oxlint'

type Config = { engine: Engine }

declare function note(text: string): void

export function binOf(config: Config): string {
  while (1) note('waiting')
  switch (config['engine']) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      note('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnAnElementOfATuple = `type Engine = 'eslint' | 'oxlint'

export function binOf(pair: readonly [Engine, number]): string {
  switch (pair[0]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const caseFallingIntoAThrowingDefaultOnAnElementOfATuple = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(pair: readonly [Engine, number]): string {
  switch (pair[0]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      note('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

export const caseFallingIntoAThrowingDefaultOnAnElementOfATupleInASwitchAfterALoopTestingOne = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(pair: readonly [Engine, number]): string {
  while (1) note('waiting')
  switch (pair[0]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      note('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnAPropertyOfThis = `type Engine = 'eslint' | 'oxlint'

export class Linter {
  engine: Engine = 'eslint'

  binOf(): string {
    switch (this.engine) {
      case 'eslint':
        return 'eslint'
      case 'oxlint':
        return 'oxlint'
      default:
        throw new Error('no such engine')
    }
  }
}
`

export const caseFallingIntoAThrowingDefaultOnAPropertyOfThis = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export class Linter {
  engine: Engine = 'eslint'

  binOf(): string {
    switch (this.engine) {
      case 'eslint':
        return 'eslint'
      case 'oxlint':
        note('oxlint has no bin')
      default:
        throw new Error('no such engine')
    }
  }
}
`

export const caseFallingIntoAThrowingDefaultOnAPropertyOfThisInASwitchAfterALoopTestingOne = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export class Linter {
  engine: Engine = 'eslint'

  binOf(): string {
    while (1) note('waiting')
    switch (this.engine) {
      case 'eslint':
        return 'eslint'
      case 'oxlint':
        note('oxlint has no bin')
      default:
        throw new Error('no such engine')
    }
  }
}
`

export const throwingDefaultOnTheDiscriminantOfThis = `type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; side: number }

export function areaOf(this: Shape): number {
  switch (this.kind) {
    case 'circle':
      return Math.PI * this.radius ** 2
    case 'square':
      return this.side ** 2
    default:
      throw new Error('no such shape')
  }
}
`

export const neverDefaultOnTheDiscriminantOfThis = `type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; side: number }

export function areaOf(this: Shape): number {
  switch (this.kind) {
    case 'circle':
      return Math.PI * this.radius ** 2
    case 'square':
      return this.side ** 2
    default: {
      const unhandled: never = this
      return unhandled
    }
  }
}
`

// Each part of the property takes the default's point in the flow, so `config` is read past the `return` that
// narrows it.
export const throwingDefaultOnAPropertyOfAValueNarrowedBeforeTheSwitch = `type Engine = 'eslint' | 'oxlint'

type Config = { engine: Engine }

export function binOf(config: Config | undefined): string {
  if (config === undefined) return 'none'
  switch (config.engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const caseFallingIntoAThrowingDefaultOnAPropertyOfAValueNarrowedBeforeTheSwitch = `type Engine = 'eslint' | 'oxlint'

type Config = { engine: Engine }

declare function note(text: string): void

export function binOf(config: Config | undefined): string {
  if (config === undefined) return 'none'
  switch (config.engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      note('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOpeningWithAFunctionDeclaration = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default: {
      function reason(): string {
        return 'no such engine'
      }
      throw new Error(reason())
    }
  }
}
`

// TypeScript records no point in the code's flow on an empty statement, a block or a declaration.
export const throwingDefaultOpeningWithAnEmptyStatement = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      ;
      throw new Error('no such engine')
  }
}
`

// The first statement TypeScript records the flow at assigns the value, so the value is read where that statement
// starts, before it runs.
export const throwingDefaultOpeningWithAConstWhoseInitializerAssignsTheValue = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default: {
      const reason = (engine = 'eslint')
      throw new Error(reason)
    }
  }
}
`

export const throwingDefaultOpeningWithALetWhoseInitializerAssignsTheValue = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default: {
      let reason = (engine = 'eslint')
      throw new Error(reason)
    }
  }
}
`

// TypeScript narrows the name a logical assignment sets, as it does for `=`.
export const throwingDefaultOnANullishAssignment = `type Engine = 'eslint' | 'oxlint'

declare function readEngine(): Engine

export function binOf(start: Engine | undefined): string {
  let engine = start
  switch (engine ??= readEngine()) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const caseFallingIntoAThrowingDefaultOnANullishAssignment = `type Engine = 'eslint' | 'oxlint'

declare function readEngine(): Engine
declare function note(text: string): void

export function binOf(start: Engine | undefined): string {
  let engine = start
  switch (engine ??= readEngine()) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      note('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnALogicalOrAssignment = `type Engine = 'eslint' | 'oxlint'

declare function readEngine(): Engine

export function binOf(start: Engine | undefined): string {
  let engine = start
  switch (engine ||= readEngine()) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnALogicalAndAssignment = `type Engine = 'eslint' | 'oxlint'

declare function readEngine(): Engine

export function binOf(start: Engine | undefined): string {
  let engine = start
  switch (engine &&= readEngine()) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    case undefined:
      return 'none'
    default:
      throw new Error('no such engine')
  }
}
`

// `engine` can be undefined, so no never default binding `engine!!`, `engine!` or `engine` compiles here; one binding a
// const that holds `engine!!` does, once the switch is on that const.
export const throwingDefaultOnADoubleNonNullAssertionOnAValueThatCanBeUndefined = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine | undefined): string {
  switch (engine!!) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const caseFallingIntoAThrowingDefaultOnADoubleNonNullAssertionOnAValueThatCanBeUndefined = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine | undefined): string {
  switch (engine!!) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      note('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnATripleNonNullAssertionOnAValueThatCanBeUndefined = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine | undefined): string {
  switch (engine!!!) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const caseFallingIntoAThrowingDefaultOnATripleNonNullAssertionOnAValueThatCanBeUndefined = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine | undefined): string {
  switch (engine!!!) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      note('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

// TypeScript records where a `debugger` statement starts in the code's flow on the statement alone: it holds no other
// node.
export const throwingDefaultOpeningWithADebuggerStatement = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default: {
      debugger
      throw new Error('no such engine')
    }
  }
}
`

export const throwingDefaultOpeningWithADebuggerStatementInASwitchAfterAReturn = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  return 'none'
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default: {
      debugger
      throw new Error('no such engine')
    }
  }
}
`

// TypeScript narrows the last of the three operands, not the second.
export const throwingDefaultOnACommaOfThreeOperands = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  switch ((note('choosing'), note('a bin'), engine)) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnACommaOfThreeOperandsInASwitchAfterAReturn = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine): string {
  return 'none'
  switch ((note('choosing'), note('a bin'), engine)) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

// The key is an alias of a constant holding one name, which TypeScript reads through the alias.
export const throwingDefaultOnAnElementWithAnAliasedConstKey = `type Engine = 'eslint' | 'oxlint'

namespace Keys {
  export const ENGINE = 'engine'
}

import ENGINE = Keys.ENGINE

type Config = { engine: Engine }

export function binOf(config: Config): string {
  switch (config[ENGINE]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnAnElementWithAnAliasedConstKeyInASwitchAfterAReturn = `type Engine = 'eslint' | 'oxlint'

namespace Keys {
  export const ENGINE = 'engine'
}

import ENGINE = Keys.ENGINE

type Config = { engine: Engine }

export function binOf(config: Config): string {
  return 'none'
  switch (config[ENGINE]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

// TypeScript narrows an element read with an enum member, a namespace's constant, a parameter or a `let` never
// reassigned as it narrows a property. In code it reads as never run, or where it reads a case as running on into the
// default, no never default binding the element compiles.
export const throwingDefaultOnAnElementWithAnEnumMemberKey = `type Engine = 'eslint' | 'oxlint'

type Config = { engine: Engine }

enum Key {
  Engine = 'engine',
}

export function binOf(config: Config): string {
  switch (config[Key.Engine]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnAnElementWithAnEnumMemberKeyInASwitchAfterAReturn = `type Engine = 'eslint' | 'oxlint'

type Config = { engine: Engine }

enum Key {
  Engine = 'engine',
}

export function binOf(config: Config): string {
  return 'none'
  switch (config[Key.Engine]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const caseFallingIntoAThrowingDefaultOnAnElementWithAnEnumMemberKeyInASwitchAfterALoopTestingOne = `type Engine = 'eslint' | 'oxlint'

type Config = { engine: Engine }

enum Key {
  Engine = 'engine',
}

declare function note(text: string): void

export function binOf(config: Config): string {
  while (1) note('waiting')
  switch (config[Key.Engine]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      note('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnAnElementWithANamespaceConstKey = `type Engine = 'eslint' | 'oxlint'

type Config = { engine: Engine }

namespace Keys {
  export const ENGINE = 'engine'
}

export function binOf(config: Config): string {
  switch (config[Keys.ENGINE]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnAnElementWithANamespaceConstKeyInASwitchAfterAReturn = `type Engine = 'eslint' | 'oxlint'

type Config = { engine: Engine }

namespace Keys {
  export const ENGINE = 'engine'
}

export function binOf(config: Config): string {
  return 'none'
  switch (config[Keys.ENGINE]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const caseFallingIntoAThrowingDefaultOnAnElementWithANamespaceConstKeyInASwitchAfterALoopTestingOne = `type Engine = 'eslint' | 'oxlint'

type Config = { engine: Engine }

namespace Keys {
  export const ENGINE = 'engine'
}

declare function note(text: string): void

export function binOf(config: Config): string {
  while (1) note('waiting')
  switch (config[Keys.ENGINE]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      note('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnAnElementWithAParameterKey = `type Engine = 'eslint' | 'oxlint'

type Config = { engine: Engine }

export function binOf(config: Config, key: 'engine'): string {
  switch (config[key]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnAnElementWithAParameterKeyInASwitchAfterAReturn = `type Engine = 'eslint' | 'oxlint'

type Config = { engine: Engine }

export function binOf(config: Config, key: 'engine'): string {
  return 'none'
  switch (config[key]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const caseFallingIntoAThrowingDefaultOnAnElementWithAParameterKeyInASwitchAfterALoopTestingOne = `type Engine = 'eslint' | 'oxlint'

type Config = { engine: Engine }

declare function note(text: string): void

export function binOf(config: Config, key: 'engine'): string {
  while (1) note('waiting')
  switch (config[key]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      note('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnAnElementWithALetKeyNeverReassigned = `type Engine = 'eslint' | 'oxlint'

type Config = { engine: Engine }

export function binOf(config: Config): string {
  let key: 'engine' = 'engine'
  switch (config[key]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnAnElementWithALetKeyNeverReassignedInASwitchAfterAReturn = `type Engine = 'eslint' | 'oxlint'

type Config = { engine: Engine }

export function binOf(config: Config): string {
  let key: 'engine' = 'engine'
  return 'none'
  switch (config[key]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const caseFallingIntoAThrowingDefaultOnAnElementWithALetKeyNeverReassignedInASwitchAfterALoopTestingOne = `type Engine = 'eslint' | 'oxlint'

type Config = { engine: Engine }

declare function note(text: string): void

export function binOf(config: Config): string {
  let key: 'engine' = 'engine'
  while (1) note('waiting')
  switch (config[key]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      note('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

// The element can be undefined, which a case names; TypeScript narrows an element read with a parameter never
// reassigned, whatever the key's type.
export const throwingDefaultOnAnElementOfARecordReadWithAStringKey = `type Engine = 'eslint' | 'oxlint'

export function binOf(table: Record<string, Engine>, key: string): string {
  switch (table[key]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    case undefined:
      return 'none'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnAnElementOfARecordReadWithAStringKeyInASwitchAfterAReturn = `type Engine = 'eslint' | 'oxlint'

export function binOf(table: Record<string, Engine>, key: string): string {
  return 'none'
  switch (table[key]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    case undefined:
      return 'none'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnAPropertyOfACommaExpression = `type Engine = 'eslint' | 'oxlint'

type Config = { engine: Engine }

declare function note(text: string): void

export function binOf(config: Config): string {
  switch ((note('reading'), config).engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnAPropertyOfACommaExpressionInASwitchAfterAReturn = `type Engine = 'eslint' | 'oxlint'

type Config = { engine: Engine }

declare function note(text: string): void

export function binOf(config: Config): string {
  return 'none'
  switch ((note('reading'), config).engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnANonNullAssertionOnAParenthesisedOptionalChain = `type Engine = 'eslint' | 'oxlint'

type Holder = { engine: Engine }

export function binOf(holder: Holder | undefined): string {
  switch ((holder?.engine)!) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnANonNullAssertionOnAParenthesisedOptionalChainInASwitchAfterAReturn = `type Engine = 'eslint' | 'oxlint'

type Holder = { engine: Engine }

export function binOf(holder: Holder | undefined): string {
  return 'none'
  switch ((holder?.engine)!) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

// On a value that can be undefined, \`(engine)!\` is never at the default where \`engine!\` is not: TypeScript reads
// the parentheses, which ESTree drops. In code it reads as never run, or where it reads a case as running on into the
// default, neither compiles.
export const throwingDefaultOnADoubleNonNullAssertionOnAParenthesisedValueThatCanBeUndefined = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine | undefined): string {
  switch ((engine)!!) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnADoubleNonNullAssertionOnAParenthesisedValueThatCanBeUndefinedInASwitchAfterAReturn = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine | undefined): string {
  return 'none'
  switch ((engine)!!) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const caseFallingIntoAThrowingDefaultOnADoubleNonNullAssertionOnAParenthesisedValueThatCanBeUndefinedInASwitchAfterALoopTestingOne = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine | undefined): string {
  while (1) note('waiting')
  switch ((engine)!!) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      note('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnANonNullAssertionOnAParenthesisedNonNullAssertionOnAValueThatCanBeUndefined = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine | undefined): string {
  switch (((engine)!)!) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnANonNullAssertionOnAParenthesisedNonNullAssertionOnAValueThatCanBeUndefinedInASwitchAfterAReturn = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine | undefined): string {
  return 'none'
  switch (((engine)!)!) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const caseFallingIntoAThrowingDefaultOnANonNullAssertionOnAParenthesisedNonNullAssertionOnAValueThatCanBeUndefinedInASwitchAfterALoopTestingOne = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export function binOf(engine: Engine | undefined): string {
  while (1) note('waiting')
  switch (((engine)!)!) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      note('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnADoubleNonNullAssertionOnAParenthesisedOptionalProperty = `type Engine = 'eslint' | 'oxlint'

type Config = { engine?: Engine }

export function binOf(config: Config): string {
  switch ((config.engine)!!) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnADoubleNonNullAssertionOnAParenthesisedOptionalPropertyInASwitchAfterAReturn = `type Engine = 'eslint' | 'oxlint'

type Config = { engine?: Engine }

export function binOf(config: Config): string {
  return 'none'
  switch ((config.engine)!!) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const caseFallingIntoAThrowingDefaultOnADoubleNonNullAssertionOnAParenthesisedOptionalPropertyInASwitchAfterALoopTestingOne = `type Engine = 'eslint' | 'oxlint'

type Config = { engine?: Engine }

declare function note(text: string): void

export function binOf(config: Config): string {
  while (1) note('waiting')
  switch ((config.engine)!!) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      note('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnADoubleNonNullAssertionOnAParenthesisedOptionalPropertyOfThis = `type Engine = 'eslint' | 'oxlint'

export class Runner {
  engine?: Engine

  binOf(): string {
    switch ((this.engine)!!) {
      case 'eslint':
        return 'eslint'
      case 'oxlint':
        return 'oxlint'
      default:
        throw new Error('no such engine')
    }
  }
}
`

export const throwingDefaultOnADoubleNonNullAssertionOnAParenthesisedOptionalPropertyOfThisInASwitchAfterAReturn = `type Engine = 'eslint' | 'oxlint'

export class Runner {
  engine?: Engine

  binOf(): string {
    return 'none'
    switch ((this.engine)!!) {
      case 'eslint':
        return 'eslint'
      case 'oxlint':
        return 'oxlint'
      default:
        throw new Error('no such engine')
    }
  }
}
`

export const caseFallingIntoAThrowingDefaultOnADoubleNonNullAssertionOnAParenthesisedOptionalPropertyOfThisInASwitchAfterALoopTestingOne = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export class Runner {
  engine?: Engine

  binOf(): string {
    while (1) note('waiting')
    switch ((this.engine)!!) {
      case 'eslint':
        return 'eslint'
      case 'oxlint':
        note('oxlint has no bin')
      default:
        throw new Error('no such engine')
    }
  }
}
`

export const throwingDefaultOnADoubleNonNullAssertionOnAParenthesisedOptionalChain = `type Engine = 'eslint' | 'oxlint'

type Holder = { engine: Engine }

export function binOf(holder: Holder | undefined): string {
  switch ((holder?.engine)!!) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnADoubleNonNullAssertionOnAParenthesisedOptionalChainInASwitchAfterAReturn = `type Engine = 'eslint' | 'oxlint'

type Holder = { engine: Engine }

export function binOf(holder: Holder | undefined): string {
  return 'none'
  switch ((holder?.engine)!!) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const caseFallingIntoAThrowingDefaultOnADoubleNonNullAssertionOnAParenthesisedOptionalChainInASwitchAfterALoopTestingOne = `type Engine = 'eslint' | 'oxlint'

type Holder = { engine: Engine }

declare function note(text: string): void

export function binOf(holder: Holder | undefined): string {
  while (1) note('waiting')
  switch ((holder?.engine)!!) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      note('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

// A switch on \`typeof value\` narrows \`value\` by each type a case names: where \`value\` is a union of those types it
// is never at the default; where it is \`unknown\` it is not, nor is any other part of the switch's value.
export const throwingDefaultOnTheTypeOfAUnion = `export function kindOf(value: string | number): string {
  switch (typeof value) {
    case 'string':
      return 'text'
    case 'number':
      return 'count'
    case 'bigint':
    case 'boolean':
    case 'symbol':
    case 'undefined':
    case 'object':
    case 'function':
      return 'other'
    default:
      throw new Error('no such type')
  }
}
`

export const throwingDefaultOnTheTypeOfAUnionInASwitchAfterAReturn = `export function kindOf(value: string | number): string {
  return 'none'
  switch (typeof value) {
    case 'string':
      return 'text'
    case 'number':
      return 'count'
    case 'bigint':
    case 'boolean':
    case 'symbol':
    case 'undefined':
    case 'object':
    case 'function':
      return 'other'
    default:
      throw new Error('no such type')
  }
}
`

export const throwingDefaultOnTheTypeOfAnUnknownValue = `export function kindOf(value: unknown): string {
  switch (typeof value) {
    case 'string':
    case 'number':
    case 'bigint':
    case 'boolean':
    case 'symbol':
    case 'undefined':
    case 'object':
    case 'function':
      return 'known'
    default:
      throw new Error('no such type')
  }
}
`

// TypeScript narrows no part of a call, a cast or a \`??\` to never at the default, but it narrows a const holding the
// value: a never default compiles once the switch is on that const. Where a case runs on into the default, or in code
// TypeScript reads as never run, it does not.
export const throwingDefaultOnACall = `type Engine = 'eslint' | 'oxlint'

declare function engineOf(path: string): Engine

export function binOf(path: string): string {
  switch (engineOf(path)) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const neverDefaultOnAConstHoldingACall = `type Engine = 'eslint' | 'oxlint'

declare function engineOf(path: string): Engine

export function binOf(path: string): string {
  const switchedOn = engineOf(path)
  switch (switchedOn) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default: {
      const unhandled: never = switchedOn
      return unhandled
    }
  }
}
`

export const caseFallingIntoAThrowingDefaultOnACall = `type Engine = 'eslint' | 'oxlint'

declare function engineOf(path: string): Engine
declare function note(text: string): void

export function binOf(path: string): string {
  switch (engineOf(path)) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      note('oxlint has no bin')
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnACallInASwitchAfterAReturn = `type Engine = 'eslint' | 'oxlint'

declare function engineOf(path: string): Engine

export function binOf(path: string): string {
  return 'none'
  switch (engineOf(path)) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnACast = `type Engine = 'eslint' | 'oxlint'

export function binOf(raw: string): string {
  switch (raw as Engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnANullishCoalescing = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine | undefined): string {
  switch (engine ?? 'eslint') {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

// TypeScript narrows \`engine\` to undefined at the default, and neither it nor \`engine!\` is never there.
export const throwingDefaultOnANonNullAssertionOnAValueThatCanBeUndefined = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine | undefined): string {
  switch (engine!) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnAnElementWithALetKeyReassigned = `type Engine = 'eslint' | 'oxlint'

type Config = { engine: Engine }

export function binOf(config: Config): string {
  let key: 'engine' = 'engine'
  key = 'engine'
  switch (config[key]) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

// \`return\` does not compile at a file's top level, in a class static block or in a setter; binding the value to never
// before the throw still makes a missing case a type error.
export const throwingDefaultAtTheTopLevelOfAFile = `type Engine = 'eslint' | 'oxlint'

declare function readEngine(): Engine

const engine = readEngine()

let bin = ''

switch (engine) {
  case 'eslint':
    bin = 'eslint'
    break
  case 'oxlint':
    bin = 'oxlint'
    break
  default:
    throw new Error('no such engine')
}

export { bin }
`

export const neverBindingThenThrowAtTheTopLevelOfAFile = `type Engine = 'eslint' | 'oxlint'

declare function readEngine(): Engine

const engine = readEngine()

let bin = ''

switch (engine) {
  case 'eslint':
    bin = 'eslint'
    break
  case 'oxlint':
    bin = 'oxlint'
    break
  default: {
    const unhandled: never = engine
    throw new Error(String(unhandled))
  }
}

export { bin }
`

export const throwingDefaultOnACallAtTheTopLevelOfAFile = `type Engine = 'eslint' | 'oxlint'

declare function readEngine(): Engine

let bin = ''

switch (readEngine()) {
  case 'eslint':
    bin = 'eslint'
    break
  case 'oxlint':
    bin = 'oxlint'
    break
  default:
    throw new Error('no such engine')
}

export { bin }
`

export const throwingDefaultInAClassStaticBlock = `type Engine = 'eslint' | 'oxlint'

declare function readEngine(): Engine

export class Bins {
  static bin = ''

  static {
    const engine = readEngine()
    switch (engine) {
      case 'eslint':
        Bins.bin = 'eslint'
        break
      case 'oxlint':
        Bins.bin = 'oxlint'
        break
      default:
        throw new Error('no such engine')
    }
  }
}
`

export const neverBindingThenThrowInAClassStaticBlock = `type Engine = 'eslint' | 'oxlint'

declare function readEngine(): Engine

export class Bins {
  static bin = ''

  static {
    const engine = readEngine()
    switch (engine) {
      case 'eslint':
        Bins.bin = 'eslint'
        break
      case 'oxlint':
        Bins.bin = 'oxlint'
        break
      default: {
        const unhandled: never = engine
        throw new Error(String(unhandled))
      }
    }
  }
}
`

// A function in a static block returns as any function does.
export const throwingDefaultInAFunctionInAClassStaticBlock = `type Engine = 'eslint' | 'oxlint'

export class Bins {
  static binOf: (engine: Engine) => string

  static {
    Bins.binOf = (engine) => {
      switch (engine) {
        case 'eslint':
          return 'eslint'
        case 'oxlint':
          return 'oxlint'
        default:
          throw new Error('no such engine')
      }
    }
  }
}
`

export const throwingDefaultInASetter = `type Engine = 'eslint' | 'oxlint'

export class Runner {
  #bin = ''

  get bin(): string {
    return this.#bin
  }

  set engine(engine: Engine) {
    switch (engine) {
      case 'eslint':
        this.#bin = 'eslint'
        break
      case 'oxlint':
        this.#bin = 'oxlint'
        break
      default:
        throw new Error('no such engine')
    }
  }
}
`

export const neverBindingThenThrowInASetter = `type Engine = 'eslint' | 'oxlint'

export class Runner {
  #bin = ''

  get bin(): string {
    return this.#bin
  }

  set engine(engine: Engine) {
    switch (engine) {
      case 'eslint':
        this.#bin = 'eslint'
        break
      case 'oxlint':
        this.#bin = 'oxlint'
        break
      default: {
        const unhandled: never = engine
        throw new Error(String(unhandled))
      }
    }
  }
}
`

export const caseFallingIntoAThrowingDefaultInASetter = `type Engine = 'eslint' | 'oxlint'

declare function note(text: string): void

export class Runner {
  #bin = ''

  get bin(): string {
    return this.#bin
  }

  set engine(engine: Engine) {
    switch (engine) {
      case 'eslint':
        this.#bin = 'eslint'
        break
      case 'oxlint':
        note('oxlint has no bin')
      default:
        throw new Error('no such engine')
    }
  }
}
`

// Enough cases that a walk back through them recursing once for each case runs out of stack.
const KEYS_BEFORE_THE_LAST = 6_000

const keysBeforeTheLast = Array.from({ length: KEYS_BEFORE_THE_LAST }, (_, index) => `k${index}`)

const unionOfKeysBeforeTheLast = keysBeforeTheLast.map((key) => `'${key}'`).join(' | ')

// One line, so the lines after it stay where they are whatever the count.
const casesReturningTheirKey = keysBeforeTheLast.map((key) => `case '${key}': return '${key}'`).join('; ')

// The last case runs on into the default, past every case before it: a never default there fails to compile.
export const caseFallingIntoAThrowingDefaultAfterThousandsOfCases = `type Key = ${unionOfKeysBeforeTheLast} | 'last'

declare function note(text: string): void

export function nameOf(key: Key): string {
  switch (key) {
    ${casesReturningTheirKey}
    case 'last':
      note('last has no name')
    default:
      throw new Error('no such key')
  }
}
`

// Nothing after the never call runs, the switch of thousands of cases included: the walk back from the end of the
// case crosses every one of those cases before it reaches the call.
export const throwingDefaultAfterACaseThatCallsANeverFunctionBeforeThousandsOfCases = `type Engine = 'eslint' | 'oxlint'

declare function fail(text: string): never

export function binOf(engine: Engine, key: string): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      fail('oxlint has no bin')
      switch (key) { ${casesReturningTheirKey} }
    default:
      throw new Error('no such engine')
  }
}
`

// Two statements, the first a block: the default ends in the throw after the block, not in the block's last statement.
export const throwingDefaultOfABlockThenAThrow = `type Engine = 'eslint' | 'oxlint'

declare function note(message: string): void

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      {
        note('no such engine')
      }
      throw new Error('no such engine')
  }
}
`

export const neverBindingAfterAnotherDeclaratorThenThrow = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default: {
      const message = 'no such engine',
        unhandled: never = engine
      throw new Error(\`\${message}: \${String(unhandled)}\`)
    }
  }
}
`

export const throwingDefaultOnACallOfParametersNamedSwitchedOn = `type Engine = 'eslint' | 'oxlint'

declare function engineAt(index: number): Engine

export function binOf(switchedOn0: number, switchedOn1: number): string {
  switch (engineAt(switchedOn0 + switchedOn1)) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnAPropertyOfACallTakingAnArrow = `type Engine = 'eslint' | 'oxlint'

declare function pick(choose: () => Engine): { engine: Engine }

export function binOf(engine: Engine): string {
  switch (pick(() => engine).engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnAPropertyOfACallWithAnObjectLiteral = `type Engine = 'eslint' | 'oxlint'

declare function wrap<T>(value: T): T

export function binOf(engine: Engine): string {
  switch (wrap({ engine }).engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnAPropertyOfACallWithATypeArgument = `type Engine = 'eslint' | 'oxlint'

declare function wrap<T>(value: T): T

export function binOf(config: { engine: Engine }): string {
  switch (wrap<{ engine: Engine }>(config).engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

// Each of these five values declares a name of its own, `chosen`, which nothing at the default declares.
export const throwingDefaultOnACallTakingAnArrowWithAParameter = `type Engine = 'eslint' | 'oxlint'

declare function apply<T>(make: (value: T) => T, value: T): T

export function binOf(engine: Engine): string {
  switch (apply((chosen: Engine) => chosen, engine)) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnACallTakingAFunctionWithAParameter = `type Engine = 'eslint' | 'oxlint'

declare function apply<T>(make: (value: T) => T, value: T): T

export function binOf(engine: Engine): string {
  switch (apply(function (chosen: Engine) { return chosen }, engine)) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnAPropertyOfAnObjectLiteralWithAKey = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch ({ chosen: engine }.chosen) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnAPropertyOfAnInstanceOfAClassExpression = `type Engine = 'eslint' | 'oxlint'

export function binOf(): string {
  switch (new (class { chosen: Engine = 'eslint' })().chosen) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultOnAPropertyOfAnInstanceOfAClassExpressionWithAParameterProperty = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch (new (class { constructor(public chosen: Engine) {} })(engine).chosen) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

// The default, unbraced, declares the name its switch tests in the switch's own scope. The never default written in its
// place declares nothing, so there the name is the parameter, which TypeScript narrows to never.
export const throwingDefaultDeclaringTheNameItsSwitchTests = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      const engine = 'no such engine'
      throw new Error(engine)
  }
}
`

export const throwingDefaultDeclaringTheNameItsSwitchTestsWithALet = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      let engine = 'no such engine'
      engine += '!'
      throw new Error(engine)
  }
}
`

export const throwingDefaultDeclaringAFunctionOfTheNameItsSwitchTests = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      function engine(): string {
        return 'no such engine'
      }
      throw new Error(engine())
  }
}
`

export const throwingDefaultDeclaringAClassOfTheNameItsSwitchTests = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      class engine {}
      throw new Error(engine.name)
  }
}
`

export const throwingDefaultDeclaringTheObjectOfThePropertyItsSwitchTests = `type Engine = 'eslint' | 'oxlint'

export function binOf(config: { engine: Engine }): string {
  switch (config.engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      const config = 'no such engine'
      throw new Error(config)
  }
}
`

export const throwingDefaultOnACallDeclaringANameTheCallReads = `type Engine = 'eslint' | 'oxlint'

declare function engineOf(path: string): Engine

export function binOf(path: string): string {
  switch (engineOf(path)) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      const path = 'no such engine'
      throw new Error(path)
  }
}
`

export const throwingDefaultDeclaringTheNameItsSwitchTestsInASwitchAfterAReturn = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  return 'eslint'
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      const engine = 'no such engine'
      throw new Error(engine)
  }
}
`

export const caseFallingIntoAThrowingDefaultDeclaringTheNameItsSwitchTests = `type Engine = 'eslint' | 'oxlint'

declare function note(message: string): void

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      note('oxlint has no bin')
    default:
      const engine = 'no such engine'
      throw new Error(engine)
  }
}
`

export const throwingDefaultDeclaringAnotherName = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default:
      const reason = 'no such engine'
      throw new Error(reason)
  }
}
`

// Braced, the default declares the name in a scope of its own, which the switch's value is not read in.
export const throwingDefaultBlockDeclaringTheNameItsSwitchTests = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    case 'oxlint':
      return 'oxlint'
    default: {
      const engine = 'no such engine'
      throw new Error(engine)
    }
  }
}
`

// Another case declares the name its switch reads, in the switch's own scope, so at the default the name is that
// case's const rather than the value the switch narrowed: binding it does not compile, a const holding the value does.
export const throwingDefaultAfterACaseDeclaringTheNameItsSwitchTests = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      const engine = 'eslint'
      return engine
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`

export const throwingDefaultBeforeACaseDeclaringTheNameItsSwitchTests = `type Engine = 'eslint' | 'oxlint'

export function binOf(engine: Engine): string {
  switch (engine) {
    case 'eslint':
      return 'eslint'
    default:
      throw new Error('no such engine')
    case 'oxlint':
      const engine = 'oxlint'
      return engine
  }
}
`

export const throwingDefaultAfterACaseDeclaringTheObjectOfThePropertyTheSwitchTests = `type Engine = 'eslint' | 'oxlint'

export function binOf(config: { engine: Engine }): string {
  switch (config.engine) {
    case 'eslint':
      const config = 'eslint'
      return config
    case 'oxlint':
      return 'oxlint'
    default:
      throw new Error('no such engine')
  }
}
`
