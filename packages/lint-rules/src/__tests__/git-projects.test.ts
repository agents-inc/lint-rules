import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { satisfies } from 'semver'
import { describe, expect, it } from 'vitest'
import { idOfAnEndedProcess, nodeBelowTheFloor, tempConfigNameOf, tempConfigPatternOf, tempConfigsIn } from './cli-runs.ts'
import { exportedConstant, moduleText } from './factories/check-factories.ts'
import { watchFolder } from './folder-watch.ts'
import { createGitProject, gitStatusOf } from './git-projects.ts'
import { setUpTempProjects } from './temp-projects.ts'

const tempProjects = setUpTempProjects()
const A_FILE = { 'src/a.ts': moduleText(exportedConstant('a')) }

describe('createGitProject', () => {
  it.each([
    { repo: 'committed', status: [] },
    { repo: 'no commits', status: ['?? src/a.ts'] },
  ] as const)('makes a repo whose status is as $repo leaves it', ({ repo, status }) => {
    expect(gitStatusOf(createGitProject(tempProjects, { repo, files: A_FILE }))).toStrictEqual(status)
  })

  it('makes no repo where none is asked for: git refuses the folder', () => {
    const project = createGitProject(tempProjects, { repo: 'not a repo', files: A_FILE })

    expect(() => project.git('status')).toThrowError(/not a git repository/u)
  })

  it('reads a file the run should have written as null where it is missing, and as its text where it is there', () => {
    const project = createGitProject(tempProjects, { repo: 'not a repo', files: A_FILE })

    expect([project.readIfWritten('src/missing.ts'), project.readIfWritten('src/a.ts')]).toStrictEqual([null, A_FILE['src/a.ts']])
  })
})

describe('watchFolder', () => {
  it('sees every name made in the folder before the call, once each, and not one made in a subfolder', async () => {
    const dir = tempProjects.create({ files: { 'sub/keep.ts': '' } })
    const watched = watchFolder(dir)
    writeFileSync(join(dir, 'first.json'), '{}')
    writeFileSync(join(dir, 'first.json'), '{}\n')
    writeFileSync(join(dir, 'sub', 'nested.json'), '{}')
    writeFileSync(join(dir, 'second.json'), '{}')
    const seen = await watched.namesSeen()
    watched.close()

    expect(seen.filter((name) => name !== 'sub')).toStrictEqual(['first.json', 'second.json'])
  })

  it('resolves once a name matching the pattern appears', async () => {
    const dir = tempProjects.create({})
    const watched = watchFolder(dir)
    const appeared = watched.appeared(tempConfigPatternOf(42))
    writeFileSync(join(dir, tempConfigNameOf(42, 'abc')), '{}')
    const name = await appeared
    watched.close()

    expect(name).toBe('.agents-inc-check-42-abc.json')
  })
})

describe("the names of check's temporary configs", () => {
  it('match the pattern of their own process, and not that of another whose ID they start with', () => {
    const pattern = tempConfigPatternOf(42)

    expect(['.agents-inc-check-42-x.json', '.agents-inc-check-421-x.json', '.agents-inc-check-42-.json', '.agents-inc-check-42-x.jsonc'].filter((name) => pattern.test(name))).toStrictEqual([
      '.agents-inc-check-42-x.json',
    ])
  })

  it('are listed from the folder, sorted, and nothing else is', () => {
    const dir = tempProjects.create({ files: { [tempConfigNameOf(7, 'b')]: '{}', [tempConfigNameOf(7, 'a')]: '{}', '.oxlintrc.json': '{}' } })

    expect(tempConfigsIn(dir)).toStrictEqual(['.agents-inc-check-7-a.json', '.agents-inc-check-7-b.json'])
  })
})

describe('the processes the tests point check at', () => {
  it('gives the ID of a process that has ended: no signal reaches it', () => {
    expect(() => process.kill(idOfAnEndedProcess(), 0)).toThrowError(/ESRCH/u)
  })

  it('finds, where PATH has one, a Node older than 22.18', () => {
    const oldNode = nodeBelowTheFloor()

    expect(oldNode === undefined || satisfies(oldNode.version, '<22.18.0')).toBe(true)
  })
})
