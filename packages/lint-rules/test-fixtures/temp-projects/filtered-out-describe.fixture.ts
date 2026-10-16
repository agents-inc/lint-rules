import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { setUpTempProjects } from '../../src/__tests__/temp-projects.ts'

// Run with `-t 'is kept'`, as Stryker runs a mutant's tests by name.

describe('a describe the name filter keeps', () => {
  it('is kept', () => {
    expect(true).toBe(true)
  })
})

describe('a describe the name filter leaves out', () => {
  const project = setUpTempProjects().create({ files: { 'package.json': '{}\n' } })

  it(`is left out, after ${project} was made`, () => {
    expect(existsSync(project)).toBe(true)
  })
})
