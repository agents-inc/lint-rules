import { describe, expect, it } from 'vitest'

import { extensionIdsTurnedOnBy, typescriptEslintExtensions } from './typescript-eslint-extensions.ts'

function extensionNamed(id: string) {
  const extension = typescriptEslintExtensions().find((candidate) => candidate.id === id)
  if (extension === undefined) throw new Error(`typescript-eslint has no extension rule ${id}`)
  return extension
}

describe('typescriptEslintExtensions', () => {
  it('names the core rule each extension extends, and holds no rule only typescript-eslint has', () => {
    const ids = typescriptEslintExtensions().map(({ id }) => id)

    expect({
      noUnusedVars: extensionNamed('@typescript-eslint/no-unused-vars').coreRule,
      noShadow: extensionNamed('@typescript-eslint/no-shadow').coreRule,
      arrayType: ids.includes('@typescript-eslint/array-type'),
      noExplicitAny: ids.includes('@typescript-eslint/no-explicit-any'),
    }).toStrictEqual({ noUnusedVars: 'no-unused-vars', noShadow: 'no-shadow', arrayType: false, noExplicitAny: false })
  })

  it('names the core rule an extension of another name extends', () => {
    expect(extensionNamed('@typescript-eslint/only-throw-error').coreRule).toBe('no-throw-literal')
  })

  it('marks an extension deprecated in favour of its core rule, and not one that is current', () => {
    expect({
      noLoopFunc: extensionNamed('@typescript-eslint/no-loop-func').replacedByCoreRule,
      noLossOfPrecision: extensionNamed('@typescript-eslint/no-loss-of-precision').replacedByCoreRule,
      noUnusedVars: extensionNamed('@typescript-eslint/no-unused-vars').replacedByCoreRule,
    }).toStrictEqual({ noLoopFunc: true, noLossOfPrecision: true, noUnusedVars: false })
  })
})

describe('extensionIdsTurnedOnBy', () => {
  it('names an extension the config turns on, and none it leaves off or does not set', () => {
    const recommended = extensionIdsTurnedOnBy('recommended')

    expect({
      noUnusedVars: recommended.includes('@typescript-eslint/no-unused-vars'),
      noUselessConstructor: recommended.includes('@typescript-eslint/no-useless-constructor'),
      noShadow: recommended.includes('@typescript-eslint/no-shadow'),
    }).toStrictEqual({ noUnusedVars: true, noUselessConstructor: false, noShadow: false })
  })

  it('reads the strict config as its own export name', () => {
    expect(extensionIdsTurnedOnBy('strict').includes('@typescript-eslint/no-useless-constructor')).toBe(true)
  })
})
