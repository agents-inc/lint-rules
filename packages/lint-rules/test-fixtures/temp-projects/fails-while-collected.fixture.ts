import { setUpTempProjects } from '../../src/__tests__/temp-projects.ts'

const project = setUpTempProjects().create({ files: { 'package.json': '{}\n' } })

throw new Error(`this file fails while it is collected, after making ${project}`)
