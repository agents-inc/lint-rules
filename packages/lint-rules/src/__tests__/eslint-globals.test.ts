import { describe, expect, it } from 'vitest'
import { namesDefinedIn } from './eslint-globals.ts'

describe('namesDefinedIn', () => {
  it('keeps each name set to any setting but off, in the order given', () => {
    const globals = { writableName: 'writable', readonlyName: 'readonly', trueName: true, falseName: false }

    expect(namesDefinedIn(globals, ['trueName', 'readonlyName', 'falseName', 'writableName'])).toStrictEqual([
      'trueName',
      'readonlyName',
      'falseName',
      'writableName',
    ])
  })

  it('leaves out a name set to off, beside one set to readonly', () => {
    expect(namesDefinedIn({ removed: 'off', kept: 'readonly' }, ['removed', 'kept'])).toStrictEqual(['kept'])
  })

  it('leaves out a name the globals do not set, and one only an object inherits', () => {
    expect(namesDefinedIn({ kept: 'readonly' }, ['missing', 'toString', 'kept'])).toStrictEqual(['kept'])
  })
})
