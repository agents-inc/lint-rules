import { existsSync } from 'node:fs'
import { expect, it } from 'vitest'
import { setUpTempProjects } from '../../src/__tests__/temp-projects.ts'

// Run with `-t 'is kept'`, which none of its tests matches.

const project = setUpTempProjects().create({ files: { 'package.json': '{}\n' } })

it(`is left out, after ${project} was made`, () => {
  expect(existsSync(project)).toBe(true)
})
