import { describe, expect, it } from 'vitest'

import {
  acronymHookModule,
  constantOnlyModule,
  defaultExportedHookFunctionModule,
  defaultExportedHookModule,
  floatingPanelHookModule,
  functionNamedLikeAHookPastItsStartModule,
  hookBarrel,
  hookBesideClassModule,
  hookBesideDottedNamespaceModule,
  hookBesideDestructuredConstModule,
  hookBesideDottedNamespaceUnderALowercaseNameModule,
  hookBesideEnumModule,
  hookBesideImportAliasModule,
  hookBesideInlineTypeSpecifierModule,
  hookBesideInterfaceModule,
  hookBesideNamespaceModule,
  hookBesideScreamingCaseEnumModule,
  hookBesideStringNamedModule,
  hookBesideTypeOnlyReexportModule,
  hookExportedAsAConstModule,
  hookExportedBySpecifierModule,
  hookExportedUnderAStringNameModule,
  hookOnlyModule,
  twoHookModule,
  twoHooksOfOneLengthModule,
} from '../__tests__/cases/hook-file-naming.ts'
import { buildInvalidCase, buildValidCase } from '../__tests__/factories/rule-case-factories.ts'
import { houseRuleTester } from '../__tests__/house-rule-tester.ts'
import { lintWithHouseRule } from '../__tests__/house-linter.ts'
import { housePlugin } from '../index.ts'

const CAMEL_CASE = [{ filenameCase: 'camelCase' }] as const
const KEBAB_CASE = [{ filenameCase: 'kebab-case' }] as const

houseRuleTester.run('hook-file-naming', housePlugin.rules['hook-file-naming'], {
  valid: [
    buildValidCase('stays silent on a hooks-only module whose file is named for its hook', hookOnlyModule, {
      filename: 'useThing.ts',
      options: CAMEL_CASE,
    }),
    buildValidCase(
      'stays silent on a module default-exporting a hook, whose file is named for it',
      defaultExportedHookModule,
      { filename: 'useKeyPress.ts', options: CAMEL_CASE },
    ),
    buildValidCase(
      'stays silent on a hooks-only module named for its hook in kebab-case, the default',
      floatingPanelHookModule,
      { filename: 'use-floating-panel.ts' },
    ),
    buildValidCase(
      'stays silent on a module default-exporting a hook function, named for it in kebab-case',
      defaultExportedHookFunctionModule,
      { filename: 'use-floating-panel.ts' },
    ),
    buildValidCase(
      'stays silent on a module default-exporting a hook by name, named for it in kebab-case',
      defaultExportedHookModule,
      { filename: 'use-key-press.ts' },
    ),
    buildValidCase(
      'stays silent on a module named in kebab-case for one of its hooks other than the longest',
      twoHookModule,
      { filename: 'use-panel.ts' },
    ),
    buildValidCase(
      'stays silent on a hook whose name holds an acronym, named with the acronym as one kebab-case word',
      acronymHookModule,
      { filename: 'use-html-parser.ts' },
    ),
    buildValidCase('stays silent on an index.ts barrel re-exporting hooks, under the default', hookBarrel, {
      filename: 'index.ts',
    }),
    buildValidCase('stays silent on an index.ts barrel re-exporting hooks, under camelCase', hookBarrel, {
      filename: 'index.ts',
      options: CAMEL_CASE,
    }),
    buildValidCase(
      'stays silent on a hooks-only module named for its hook in camelCase, when filenameCase is camelCase',
      floatingPanelHookModule,
      { filename: 'useFloatingPanel.ts', options: CAMEL_CASE },
    ),
    buildValidCase('stays silent on a module exporting a hook beside a class named like a component', hookBesideClassModule, {
      filename: 'status.ts',
    }),
    buildValidCase(
      'stays silent on a module exporting a hook beside an enum named like a component, as beside a class',
      hookBesideEnumModule,
      { filename: 'status.ts' },
    ),
    buildValidCase(
      'stays silent on a module exporting a hook beside a namespace named like a component, as beside a class',
      hookBesideNamespaceModule,
      { filename: 'status.ts' },
    ),
    buildValidCase(
      'stays silent on a module exporting a hook beside a dotted namespace, counted under its first name',
      hookBesideDottedNamespaceModule,
      { filename: 'status.ts' },
    ),
    buildValidCase('stays silent on code ESLint was handed without a path, which it names <input>', hookOnlyModule, {
      filename: '<input>',
    }),
    buildValidCase('stays silent on code read from stdin, which ESLint names <text>', hookOnlyModule, { filename: '<text>' }),
    buildValidCase('stays silent on a hooks-only module named for its hook inside folders', hookOnlyModule, {
      filename: 'src/hooks/use-thing.ts',
    }),
    buildValidCase('stays silent on a hooks-only module named for its hook inside folders written with backslashes', hookOnlyModule, {
      filename: 'src\\hooks\\use-thing.ts',
    }),
    buildValidCase('stays silent on a module that exports neither a hook nor a component', constantOnlyModule, {
      filename: 'status.ts',
    }),
  buildValidCase(
    'stays silent on a module exporting a function whose name holds use and a capital past its start, which is no hook',
    functionNamedLikeAHookPastItsStartModule,
    { filename: 'status.ts' },
  ),
  ],
  invalid: [
    buildInvalidCase('reports a hooks-only module whose file is not named for a hook', hookOnlyModule, {
      filename: 'hook-file-naming.ts',
      options: CAMEL_CASE,
      errors: [{ messageId: 'rename', line: 1 }],
    }),
    buildInvalidCase(
      'reports a module default-exporting a hook by name, whose file is not named for it',
      defaultExportedHookModule,
      {
        filename: 'keyboard.ts',
        options: CAMEL_CASE,
        errors: [
          {
            messageId: 'rename',
            line: 1,
            data: { hooks: 'useKeyPress', actual: 'keyboard.ts', expected: 'useKeyPress.ts' },
          },
        ],
      },
    ),
    buildInvalidCase(
      'reports a hooks-only module named for its hook in camelCase under the default, naming the kebab-case file',
      floatingPanelHookModule,
      {
        filename: 'useFloatingPanel.ts',
        errors: [
          {
            messageId: 'rename',
            line: 1,
            data: { hooks: 'useFloatingPanel', actual: 'useFloatingPanel.ts', expected: 'use-floating-panel.ts' },
          },
        ],
      },
    ),
    buildInvalidCase(
      'reports a hooks-only module whose file is not named for a hook, naming the kebab-case file',
      floatingPanelHookModule,
      {
        filename: 'floating-panel.ts',
        options: KEBAB_CASE,
        errors: [
          {
            messageId: 'rename',
            line: 1,
            data: { hooks: 'useFloatingPanel', actual: 'floating-panel.ts', expected: 'use-floating-panel.ts' },
          },
        ],
      },
    ),
    buildInvalidCase(
      'applies kebab-case when the options object leaves filenameCase out',
      floatingPanelHookModule,
      {
        filename: 'useFloatingPanel.ts',
        options: [{}],
        errors: [
          {
            messageId: 'rename',
            line: 1,
            data: { hooks: 'useFloatingPanel', actual: 'useFloatingPanel.ts', expected: 'use-floating-panel.ts' },
          },
        ],
      },
    ),
    buildInvalidCase(
      'reports a module default-exporting a hook function, naming the kebab-case file',
      defaultExportedHookFunctionModule,
      {
        filename: 'panel.ts',
        errors: [
          {
            messageId: 'rename',
            line: 1,
            data: { hooks: 'useFloatingPanel', actual: 'panel.ts', expected: 'use-floating-panel.ts' },
          },
        ],
      },
    ),
    buildInvalidCase(
      'reports a module default-exporting a hook by name, naming the kebab-case file',
      defaultExportedHookModule,
      {
        filename: 'keyboard.ts',
        errors: [
          {
            messageId: 'rename',
            line: 1,
            data: { hooks: 'useKeyPress', actual: 'keyboard.ts', expected: 'use-key-press.ts' },
          },
        ],
      },
    ),
    buildInvalidCase(
      'names the kebab-case file of the longest of several hooks',
      twoHookModule,
      {
        filename: 'panels.ts',
        errors: [
          {
            messageId: 'rename',
            line: 1,
            data: { hooks: 'usePanel, useFloatingPanel', actual: 'panels.ts', expected: 'use-floating-panel.ts' },
          },
        ],
      },
    ),
    buildInvalidCase(
      'names a hook holding an acronym with the acronym as one kebab-case word',
      acronymHookModule,
      {
        filename: 'parser.ts',
        errors: [
          {
            messageId: 'rename',
            line: 1,
            data: { hooks: 'useHTMLParser', actual: 'parser.ts', expected: 'use-html-parser.ts' },
          },
        ],
      },
    ),
    buildInvalidCase(
      'reports a hooks-only module named in kebab-case when filenameCase is camelCase, naming the camelCase file',
      floatingPanelHookModule,
      {
        filename: 'use-floating-panel.ts',
        options: CAMEL_CASE,
        errors: [
          {
            messageId: 'rename',
            line: 1,
            data: { hooks: 'useFloatingPanel', actual: 'use-floating-panel.ts', expected: 'useFloatingPanel.ts' },
          },
        ],
      },
    ),
    buildInvalidCase(
      'reports a module exporting a hook beside an enum not named like a component, as beside such a const',
      hookBesideScreamingCaseEnumModule,
      {
        filename: 'status.ts',
        errors: [
          { messageId: 'rename', line: 1, data: { hooks: 'useThing', actual: 'status.ts', expected: 'use-thing.ts' } },
        ],
      },
    ),
    buildInvalidCase(
      'reports a module exporting a hook beside a dotted namespace whose first name is not named like a component, though a later one is',
      hookBesideDottedNamespaceUnderALowercaseNameModule,
      {
        filename: 'status.ts',
        errors: [
          { messageId: 'rename', line: 1, data: { hooks: 'useThing', actual: 'status.ts', expected: 'use-thing.ts' } },
        ],
      },
    ),
    buildInvalidCase(
      'reports a module exporting a hook beside a module named by a string, which binds no name',
      hookBesideStringNamedModule,
      {
        filename: 'status.ts',
        errors: [
          { messageId: 'rename', line: 1, data: { hooks: 'useThing', actual: 'status.ts', expected: 'use-thing.ts' } },
        ],
      },
    ),
    buildInvalidCase(
      'reports a module exporting a hook beside an interface named like a component, since a type names nothing at runtime',
      hookBesideInterfaceModule,
      {
        filename: 'status.ts',
        errors: [
          { messageId: 'rename', line: 1, data: { hooks: 'useThing', actual: 'status.ts', expected: 'use-thing.ts' } },
        ],
      },
    ),
    buildInvalidCase('reports a hooks-only module whose name holds use- after its start', hookOnlyModule, {
      filename: 'shared-use-thing.ts',
      errors: [
        { messageId: 'rename', line: 1, data: { hooks: 'useThing', actual: 'shared-use-thing.ts', expected: 'use-thing.ts' } },
      ],
    }),
    buildInvalidCase('reports a hooks-only module whose file has no extension, naming a file with none', defaultExportedHookModule, {
      filename: 'keyboard',
      errors: [{ messageId: 'rename', line: 1, data: { hooks: 'useKeyPress', actual: 'keyboard', expected: 'use-key-press' } }],
    }),
    buildInvalidCase('reports a hooks-only module whose file stem is one character, keeping its extension', defaultExportedHookModule, {
      filename: 'k.ts',
      errors: [{ messageId: 'rename', line: 1, data: { hooks: 'useKeyPress', actual: 'k.ts', expected: 'use-key-press.ts' } }],
    }),
    buildInvalidCase('reports a module exporting a hook through an export list', hookExportedBySpecifierModule, {
      filename: 'status.ts',
      errors: [{ messageId: 'rename', line: 1, data: { hooks: 'useThing', actual: 'status.ts', expected: 'use-thing.ts' } }],
    }),
    buildInvalidCase(
      'reports a module exporting a hook under a string name, counting it under its local name',
      hookExportedUnderAStringNameModule,
      {
        filename: 'status.ts',
        errors: [{ messageId: 'rename', line: 1, data: { hooks: 'useThing', actual: 'status.ts', expected: 'use-thing.ts' } }],
      },
    ),
    buildInvalidCase('reports a module exporting a hook as a const', hookExportedAsAConstModule, {
      filename: 'status.ts',
      errors: [{ messageId: 'rename', line: 1, data: { hooks: 'useThing', actual: 'status.ts', expected: 'use-thing.ts' } }],
    }),
    buildInvalidCase(
      'reports a module exporting a hook beside a destructured const, which names no export it reads',
      hookBesideDestructuredConstModule,
      {
        filename: 'status.ts',
        errors: [{ messageId: 'rename', line: 1, data: { hooks: 'useThing', actual: 'status.ts', expected: 'use-thing.ts' } }],
      },
    ),
    buildInvalidCase(
      'reports a module exporting a hook beside an inline type specifier named like a component',
      hookBesideInlineTypeSpecifierModule,
      {
        filename: 'status.ts',
        errors: [{ messageId: 'rename', line: 1, data: { hooks: 'useThing', actual: 'status.ts', expected: 'use-thing.ts' } }],
      },
    ),
    buildInvalidCase(
      'reports a module exporting a hook beside a type-only re-export named like a component',
      hookBesideTypeOnlyReexportModule,
      {
        filename: 'status.ts',
        errors: [{ messageId: 'rename', line: 1, data: { hooks: 'useThing', actual: 'status.ts', expected: 'use-thing.ts' } }],
      },
    ),
    buildInvalidCase('reports a module exporting a hook beside an import alias', hookBesideImportAliasModule, {
      filename: 'status.ts',
      errors: [{ messageId: 'rename', line: 1, data: { hooks: 'useThing', actual: 'status.ts', expected: 'use-thing.ts' } }],
    }),
    buildInvalidCase(
      'reports a module exporting two hooks of one length, naming the file for the first',
      twoHooksOfOneLengthModule,
      {
        filename: 'status.ts',
        errors: [
          { messageId: 'rename', line: 1, data: { hooks: 'useAlpha, useOmega', actual: 'status.ts', expected: 'use-alpha.ts' } },
        ],
      },
    ),
  ],
})

describe('hook-file-naming options, as ESLint checks them', () => {
  it('accepts filenameCase camelCase and applies it: a kebab-case file is reported', () => {
    const messages = lintWithHouseRule('hook-file-naming', CAMEL_CASE, floatingPanelHookModule, 'use-floating-panel.js')

    expect(messages.map(({ ruleId }) => ruleId)).toStrictEqual(['house/hook-file-naming'])
  })

  it('accepts filenameCase kebab-case and applies it: a camelCase file is reported', () => {
    const messages = lintWithHouseRule('hook-file-naming', KEBAB_CASE, floatingPanelHookModule, 'useFloatingPanel.js')

    expect(messages.map(({ ruleId }) => ruleId)).toStrictEqual(['house/hook-file-naming'])
  })

  it('refuses a filenameCase other than camelCase and kebab-case', () => {
    expect(() =>
      lintWithHouseRule('hook-file-naming', [{ filenameCase: 'snake_case' }], floatingPanelHookModule, 'use_floating_panel.js'),
    ).toThrow(/"house\/hook-file-naming":\s+Value "snake_case" should be equal to one of the allowed values/u)
  })

  it('refuses an option key other than filenameCase', () => {
    expect(() =>
      lintWithHouseRule('hook-file-naming', [{ fileCase: 'kebab-case' }], floatingPanelHookModule, 'use-floating-panel.js'),
    ).toThrow(/Unexpected property "fileCase"/u)
  })
})

describe('hook-file-naming messages, as a user reads them', () => {
  it('names the hooks, the file and the file to rename it to', () => {
    const messages = lintWithHouseRule('hook-file-naming', [], floatingPanelHookModule, 'floating-panel.js')

    expect(messages.map(({ message }) => message)).toStrictEqual([
      "This file exports hooks (useFloatingPanel) and no component, but is named 'floating-panel.js'. Name it for the hook it provides -- e.g. 'use-floating-panel.js' -- or a reader looking for that hook has no reason to open it.",
    ])
  })
})
