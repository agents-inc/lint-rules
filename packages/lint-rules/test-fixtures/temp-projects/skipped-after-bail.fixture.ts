import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { setUpTempProjects } from '../../src/__tests__/temp-projects.ts'

// Run with `--bail=1`, as Stryker runs a mutant: the first failure stops the run.

describe('a describe whose test fails', () => {
  it('fails', () => {
    expect(true).toBe(false)
  })
})

describe('a describe the run skips once the failure stops it', () => {
  const project = setUpTempProjects().create({ files: { 'package.json': '{}\n' } })

  it(`is skipped, after ${project} was made`, () => {
    expect(existsSync(project)).toBe(true)
  })
})
