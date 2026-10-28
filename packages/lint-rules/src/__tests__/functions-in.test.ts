import { describe, expect, it } from 'vitest'
import { buildReportingPlugin } from './factories/catalog-factories.ts'
import { pathsOfFunctionsIn } from './functions-in.ts'

// The walk the "parts are data" spec reads: one that missed a function would pass a part holding a plugin.
describe('pathsOfFunctionsIn', () => {
  it('finds a function nested in objects and arrays, by its path', () => {
    expect(pathsOfFunctionsIn({ a: 1, b: [{ c() { return 1 } }, 'x'], d: { e: null } })).toStrictEqual(['$.b[0].c'])
  })

  it('finds every rule of a plugin object, which is what a part must not hold', () => {
    expect(pathsOfFunctionsIn({ plugins: { team: buildReportingPlugin(['one']) } })).toStrictEqual([
      '$.plugins.team.rules.one.create',
    ])
  })

  it('finds none in plain data: rule entries, globs and env names', () => {
    expect(
      pathsOfFunctionsIn({ rules: { eqeqeq: ['error', 'always'] }, files: ['**/*.ts'], env: ['node'], off: undefined }),
    ).toStrictEqual([])
  })

  it('walks a value met twice once', () => {
    const shared = { run() { return 1 } }

    expect(pathsOfFunctionsIn({ first: shared, second: shared })).toStrictEqual(['$.first.run'])
  })
})
