import { describe, expect, it } from 'vitest'
import { buildFileOverridesModule, entryWithFiles, fileOverridesModuleText, positionAtTopLevel, positionInEntry } from './file-overrides-module-factories.ts'

const MODULE = buildFileOverridesModule({
  declarations: ["const LEGACY_GLOBS = ['legacy/**'] as const"],
  entries: [entryWithFiles("['x.ts']"), entryWithFiles("['/x.ts']")],
  topLevel: ["ignores: ['/a.js']"],
})

const MODULE_GIVING_EACH_TOP_LEVEL_KEY = buildFileOverridesModule({
  declarations: ["const LIBS = { ui: ['react'] } as const", "const RULES = { 'no-debugger': 'off' } as const"],
  tsconfigRootDir: "'.'",
  agentRulesets: '{ libs: LIBS }',
  editorRulesets: "{ runtimes: ['node'] }",
  entries: [entryWithFiles("['x.ts']")],
  topLevel: ["ignores: ['/a.js']", 'rules: RULES'],
})

describe('fileOverridesModuleText', () => {
  it('writes each top-level key given on a line of its own, in place of the ones it writes by default', () => {
    expect(fileOverridesModuleText(MODULE_GIVING_EACH_TOP_LEVEL_KEY).split('\n')).toStrictEqual([
      "import { defineLintRules } from '@agents-inc/lint-rules'",
      '',
      "const LIBS = { ui: ['react'] } as const",
      "const RULES = { 'no-debugger': 'off' } as const",
      'export const { eslint, oxlint } = defineLintRules({',
      "  tsconfigRootDir: '.',",
      '  agentRulesets: { libs: LIBS },',
      "  editorRulesets: { runtimes: ['node'] },",
      '  fileOverrides: [',
      "    { files: ['x.ts'], rules: { 'no-debugger': 'off' } },",
      '  ],',
      "  ignores: ['/a.js'],",
      '  rules: RULES,',
      '}).editorRulesets',
      '',
    ])
  })

  it('writes the root as import.meta.dirname, an agent set checking correctness and an empty editor set where none is given', () => {
    expect(fileOverridesModuleText(buildFileOverridesModule()).split('\n')).toStrictEqual([
      "import { defineLintRules } from '@agents-inc/lint-rules'",
      '',
      'export const { eslint, oxlint } = defineLintRules({',
      '  tsconfigRootDir: import.meta.dirname,',
      "  agentRulesets: { quality: ['correctness'] },",
      '  editorRulesets: {},',
      '  fileOverrides: [',
      '  ],',
      '}).editorRulesets',
      '',
    ])
  })
})

describe('positionAtTopLevel', () => {
  it('gives the line and column, counted from 1, where the text starts in the line giving each top-level key', () => {
    expect([
      positionAtTopLevel(MODULE_GIVING_EACH_TOP_LEVEL_KEY, 'tsconfigRootDir', "'.'"),
      positionAtTopLevel(MODULE_GIVING_EACH_TOP_LEVEL_KEY, 'agentRulesets', 'libs'),
      positionAtTopLevel(MODULE_GIVING_EACH_TOP_LEVEL_KEY, 'editorRulesets', 'editorRulesets'),
      positionAtTopLevel(MODULE_GIVING_EACH_TOP_LEVEL_KEY, 'rules', 'rules'),
    ]).toStrictEqual([
      { line: 6, column: 20 },
      { line: 7, column: 20 },
      { line: 8, column: 3 },
      { line: 13, column: 3 },
    ])
  })

  it('throws where the line giving the key does not hold the text, and gives the place in one that does', () => {
    expect(positionAtTopLevel(MODULE, 'ignores', "'/a.js'")).toStrictEqual({ line: 12, column: 13 })
    expect(() => positionAtTopLevel(MODULE, 'ignores', 'rules')).toThrow(new Error("the top-level ignores does not hold rules: ignores: ['/a.js'],"))
  })

  it('throws where no top-level line gives the key, though an entry does', () => {
    expect(() => positionAtTopLevel(MODULE, 'files', 'files')).toThrow(new Error('the module gives no top-level files'))
  })
})

describe('positionInEntry', () => {
  it('gives the line and column, counted from 1, where the text starts in the module text', () => {
    const { line, column } = positionInEntry(MODULE, 1, "'/x.ts'")
    const lineText = fileOverridesModuleText(MODULE).split('\n')[line - 1]

    expect({ line, column, from: lineText === undefined ? undefined : lineText.slice(column - 1) }).toStrictEqual({
      line: 10,
      column: 15,
      from: "'/x.ts'], rules: { 'no-debugger': 'off' } },",
    })
  })

  it('throws where the entry does not hold the text, and gives the place in an entry that does', () => {
    expect(positionInEntry(MODULE, 0, 'files')).toStrictEqual({ line: 9, column: 7 })
    expect(() => positionInEntry(MODULE, 0, "'/x.ts'")).toThrow(new Error(`entry 0 does not hold '/x.ts': ${entryWithFiles("['x.ts']")}`))
  })

  it('throws where the module has no such entry', () => {
    expect(() => positionInEntry(MODULE, 2, 'files')).toThrow(new Error('the module has no entry 2'))
  })
})
