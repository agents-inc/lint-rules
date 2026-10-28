import { describe, expect, it } from 'vitest'
import { linesChanged, moduleText, wholeFileChanged } from '../../__tests__/factories/check-factories.ts'
import { keepsUnchangedLines } from './fix-guard.ts'

describe("the guard on an engine's fixes in one file", () => {
  it('passes any fix in a wholly changed file', () => {
    expect(keepsUnchangedLines(moduleText('export let a = 1', 'export let b = 2'), moduleText('export const b = 2'), wholeFileChanged())).toBe(
      true,
    )
  })

  it('passes a fix that modifies only a changed line', () => {
    expect(
      keepsUnchangedLines(
        moduleText('export const a = 1', 'export let b = 2', 'export const c = 3'),
        moduleText('export const a = 1', 'export const b = 2', 'export const c = 3'),
        linesChanged(2),
      ),
    ).toBe(true)
  })

  it('refuses a fix that modifies an unchanged line, beside a changed one it also fixes', () => {
    expect(
      keepsUnchangedLines(
        moduleText('export let a = 1', 'export let b = 2'),
        moduleText('export const a = 1', 'export const b = 2'),
        linesChanged(2),
      ),
    ).toBe(false)
  })

  it('refuses a fix that deletes an unchanged line', () => {
    expect(
      keepsUnchangedLines(moduleText('export const a = 1', 'debugger', 'export const c = 3'), moduleText('export const a = 1', 'export const c = 3'), linesChanged(1)),
    ).toBe(false)
  })

  it('refuses a fix that deletes one of two identical unchanged lines, as one collapsing blank lines does', () => {
    expect(
      keepsUnchangedLines(moduleText('export const a = 1', '', '', 'export let b = 2'), moduleText('export const a = 1', '', 'export const b = 2'), linesChanged(4)),
    ).toBe(false)
  })

  it('passes the same fix where the blank line it deletes changed, beside that one', () => {
    expect(
      keepsUnchangedLines(moduleText('export const a = 1', '', '', 'export let b = 2'), moduleText('export const a = 1', '', 'export const b = 2'), linesChanged(3, 4)),
    ).toBe(true)
  })

  it('passes a fix that deletes a changed line', () => {
    expect(
      keepsUnchangedLines(moduleText('export const a = 1', 'debugger', 'export const c = 3'), moduleText('export const a = 1', 'export const c = 3'), linesChanged(2)),
    ).toBe(true)
  })

  it('passes a line inserted between two unchanged lines', () => {
    expect(
      keepsUnchangedLines(
        moduleText('import { a } from "./a.ts"', 'export const b = a'),
        moduleText('import { a } from "./a.ts"', '', 'export const b = a'),
        linesChanged(),
      ),
    ).toBe(true)
  })

  it('passes a fix that only moves a changed line between the unchanged lines around it', () => {
    expect(
      keepsUnchangedLines(
        moduleText('export const UNITS = [', "  'MB',", "  'KB',", ']'),
        moduleText('export const UNITS = [', "  'KB',", "  'MB',", ']'),
        linesChanged(2, 3),
      ),
    ).toBe(true)
  })

  it('refuses a fix that moves an unchanged line', () => {
    expect(
      keepsUnchangedLines(
        moduleText("import { b } from './b.ts'", "import { c } from './c.ts'", "import { a } from './a.ts'"),
        moduleText("import { a } from './a.ts'", "import { b } from './b.ts'", "import { c } from './c.ts'"),
        linesChanged(2),
      ),
    ).toBe(false)
  })

  it('refuses a fix reported on a changed line that rewrites the unchanged lines after it', () => {
    expect(
      keepsUnchangedLines(moduleText('export type Ids = Array<', '  number', '>'), moduleText('export type Ids = number[]'), linesChanged(1)),
    ).toBe(false)
  })

  it('passes the same fix where every line it rewrites changed', () => {
    expect(
      keepsUnchangedLines(
        moduleText('export type Names = string[]', 'export type Ids = Array<', '  number', '>', 'debugger'),
        moduleText('export type Names = string[]', 'export type Ids = number[]', 'debugger'),
        linesChanged(2, 3, 4),
      ),
    ).toBe(true)
  })
})
