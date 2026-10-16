import { existsSync } from 'node:fs'
import { expect, it } from 'vitest'
import { setUpTempProjects } from '../../src/__tests__/temp-projects.ts'

const project = setUpTempProjects().create({ files: { 'package.json': '{}\n' } })

it(`fails, finding ${project}, which it expects gone`, () => {
  expect(existsSync(project)).toBe(false)
})
