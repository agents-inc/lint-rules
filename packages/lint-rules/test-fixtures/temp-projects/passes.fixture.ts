import { existsSync } from 'node:fs'
import { expect, it } from 'vitest'
import { setUpTempProjects } from '../../src/__tests__/temp-projects.ts'

const tempProjects = setUpTempProjects()
const projectMadeWhileCollected = tempProjects.create({ files: { 'package.json': '{}\n' } })

it(`finds ${projectMadeWhileCollected}, made while the file was collected, and one it makes itself`, () => {
  const projectMadeByTheTest = tempProjects.create({})
  expect([projectMadeWhileCollected, projectMadeByTheTest].map((dir) => existsSync(dir))).toStrictEqual([true, true])
})
