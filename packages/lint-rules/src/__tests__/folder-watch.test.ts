import { readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { escapeForPattern, watchFolder } from './folder-watch.ts'
import { setUpTempProjects } from './temp-projects.ts'

// The watch the signal specs wait on: an answer it got wrong would signal check at the wrong moment, or never.
// git-projects.test.ts holds the first cases: a name seen once each, a subfolder's left out, one appearing after the call.

const tempProjects = setUpTempProjects()
const EARLY_NAME = 'early.json'
const MATCHING_NAME = 'match.json'
const OTHER_NAME = 'other.json'
const EVERY_CHARACTER_A_PATTERN_READS = '.*+?^${}()|[]\\'

describe('watchFolder', () => {
  it('resolves with a matching name that appeared before the call, with no change made after it', async () => {
    const dir = tempProjects.create({})
    const watched = watchFolder(dir)
    writeFileSync(join(dir, EARLY_NAME), '{}')
    await watched.namesSeen()
    const aLaterChangeSeen = watched.namesSeen().then(() => 'a change made after the call was seen first')
    const first = await Promise.race([watched.appeared(/^early\.json$/u), aLaterChangeSeen])
    await aLaterChangeSeen
    watched.close()

    expect(first).toBe(EARLY_NAME)
  })

  it('resolves with the name matching the pattern, not with one that appeared before it', async () => {
    const dir = tempProjects.create({})
    const watched = watchFolder(dir)
    const appeared = watched.appeared(/^match\.json$/u)
    writeFileSync(join(dir, OTHER_NAME), '{}')
    writeFileSync(join(dir, MATCHING_NAME), '{}')
    const name = await appeared
    watched.close()

    expect(name).toBe(MATCHING_NAME)
  })

  it('leaves the folder holding only what was written there: no file the watch wrote to see its changes', async () => {
    const dir = tempProjects.create({})
    const watched = watchFolder(dir)
    writeFileSync(join(dir, OTHER_NAME), '{}')
    const seen = await watched.namesSeen()
    watched.close()

    expect({ seen, inTheFolder: readdirSync(dir) }).toStrictEqual({ seen: [OTHER_NAME], inTheFolder: [OTHER_NAME] })
  })

  it('leaves out of the names seen the files an earlier call wrote to see its changes', async () => {
    const dir = tempProjects.create({})
    const watched = watchFolder(dir)
    writeFileSync(join(dir, EARLY_NAME), '{}')
    await watched.namesSeen()
    writeFileSync(join(dir, OTHER_NAME), '{}')
    const seen = await watched.namesSeen()
    watched.close()

    expect(seen).toStrictEqual([EARLY_NAME, OTHER_NAME])
  })
})

describe('escapeForPattern', () => {
  it('gives a pattern matching the text, each character a pattern reads as syntax included', () => {
    expect(new RegExp(`^${escapeForPattern(EVERY_CHARACTER_A_PATTERN_READS)}$`, 'u').test(EVERY_CHARACTER_A_PATTERN_READS)).toBe(true)
  })

  it('gives a pattern a dot in the text matches only a dot in, and not another character', () => {
    const pattern = new RegExp(`^${escapeForPattern(EARLY_NAME)}$`, 'u')

    expect({ itself: pattern.test(EARLY_NAME), another: pattern.test('early-json') }).toStrictEqual({ itself: true, another: false })
  })
})
