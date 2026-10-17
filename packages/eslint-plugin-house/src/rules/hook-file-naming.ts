import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils'

import { isHookName } from '../shared/hook-name.ts'
import { defaultedOption } from '../shared/rule-options.ts'

const FILENAME_CASES = ['camelCase', 'kebab-case'] as const

type FilenameCase = (typeof FILENAME_CASES)[number]

// The schema requires no key: ESLint fills one a config omits from meta.defaultOptions.
type FileNaming = { filenameCase?: FilenameCase }

type Options = [FileNaming]

type FileName = { base: string; stem: string; extension: string }

type FilenameConvention = {
  isHookFileStem: (stem: string) => boolean
  hookFileStemOf: (hookName: string) => string
}

const RULE_NAME = 'hook-file-naming'
const DEFAULT_FILENAME_CASE: FilenameCase = 'kebab-case'
// PascalCase means [A-Z][a-z]: SCREAMING_CASE constants are not components.
const COMPONENT_NAME = /^[A-Z][a-z]/
const KEBAB_CASE_HOOK_NAME = /^use-[a-z]/
// A capital starts a word after a lowercase letter or digit, and so does an acronym's last capital
// before a lowercase letter: `useHTMLParser` is `use-html-parser`.
const WORD_START_AFTER_LOWERCASE = /(?<=[a-z\d])(?=[A-Z])/g
const WORD_START_AFTER_ACRONYM = /(?<=[A-Z])(?=[A-Z][a-z])/g
const WORD_SEPARATOR = '-'
const BARREL_STEM = 'index'
const FILENAME_CONVENTIONS: Record<FilenameCase, FilenameConvention> = {
  camelCase: { isHookFileStem: isHookName, hookFileStemOf: (hookName) => hookName },
  'kebab-case': { isHookFileStem: (stem) => KEBAB_CASE_HOOK_NAME.test(stem), hookFileStemOf: kebabCaseOf },
}

function kebabCaseOf(camelCaseName: string): string {
  return camelCaseName
    .replaceAll(WORD_START_AFTER_LOWERCASE, WORD_SEPARATOR)
    .replaceAll(WORD_START_AFTER_ACRONYM, WORD_SEPARATOR)
    .toLowerCase()
}

// ESLint names code it was handed without a path `<input>` or `<text>`.
function isVirtualFile(filename: string): boolean {
  return filename === '' || filename.startsWith('<')
}

function fileNameOf(path: string): FileName {
  const base = path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1)
  const dot = base.indexOf('.')
  return dot === -1
    ? { base, stem: base, extension: '' }
    : { base, stem: base.slice(0, dot), extension: base.slice(dot) }
}

function isComponentName(name: string): boolean {
  return COMPONENT_NAME.test(name)
}

function declaredValueNames(declaration: TSESTree.NamedExportDeclarations | null): string[] {
  if (declaration === null) return []
  switch (declaration.type) {
    case AST_NODE_TYPES.FunctionDeclaration:
    case AST_NODE_TYPES.ClassDeclaration: {
      return declaration.id === null ? [] : [declaration.id.name]
    }
    case AST_NODE_TYPES.VariableDeclaration: {
      return declaration.declarations.flatMap((declarator) =>
        declarator.id.type === AST_NODE_TYPES.Identifier ? [declarator.id.name] : [],
      )
    }
    default: {
      return []
    }
  }
}

function identifierName(node: TSESTree.Identifier | TSESTree.StringLiteral): string | null {
  return node.type === AST_NODE_TYPES.Identifier ? node.name : null
}

// `export { useThing as 'use thing' }` has no identifier to export under, so it counts under its local name.
function exportedName(specifier: TSESTree.ExportSpecifier): string | null {
  return identifierName(specifier.exported) ?? identifierName(specifier.local)
}

// Types name nothing at runtime, so a type export never makes a module look mixed.
function valueNamesExportedBy(node: TSESTree.ExportNamedDeclaration): string[] {
  if (node.exportKind === 'type') return []
  const specifierNames = node.specifiers
    .filter((specifier) => specifier.exportKind !== 'type')
    .map(exportedName)
    .filter((name) => name !== null)
  return [...declaredValueNames(node.declaration), ...specifierNames]
}

function defaultExportName(declaration: TSESTree.ExportDefaultDeclaration['declaration']): string | null {
  if ('id' in declaration && declaration.id !== null && declaration.id.type === AST_NODE_TYPES.Identifier) {
    return declaration.id.name
  }
  return declaration.type === AST_NODE_TYPES.Identifier ? declaration.name : null
}

// The composed hook the others feed. Only a hint for the message.
function longestName(names: readonly string[]): string {
  return names.reduce((longest, name) => (name.length > longest.length ? name : longest))
}

export const hookFileNaming = ESLintUtils.RuleCreator.withoutDocs<Options, 'rename'>({
  meta: {
    type: 'suggestion',
    docs: {
      description: 'A module that exports hooks and no component must be named for one of its hooks, in the configured case',
    },
    messages: {
      rename:
        "This file exports hooks ({{hooks}}) and no component, but is named '{{actual}}'. Name it for the hook it provides -- e.g. '{{expected}}' -- or a reader looking for that hook has no reason to open it.",
    },
    schema: [
      {
        type: 'object',
        properties: { filenameCase: { type: 'string', enum: [...FILENAME_CASES] } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ filenameCase: DEFAULT_FILENAME_CASE }],
  },
  create(context, [options]) {
    if (isVirtualFile(context.filename)) return {}
    const convention = FILENAME_CONVENTIONS[defaultedOption(RULE_NAME, options.filenameCase)]
    const { base, stem, extension } = fileNameOf(context.filename)
    // A barrel names nothing; unicorn/no-barrel-files owns that case.
    if (stem === BARREL_STEM || convention.isHookFileStem(stem)) return {}

    const exportedValues: string[] = []

    return {
      ExportNamedDeclaration(node) {
        exportedValues.push(...valueNamesExportedBy(node))
      },
      ExportDefaultDeclaration(node) {
        const name = defaultExportName(node.declaration)
        if (name !== null) exportedValues.push(name)
      },
      'Program:exit'(node) {
        const hooks = exportedValues.filter(isHookName)
        if (hooks.length === 0) return
        if (exportedValues.some(isComponentName)) return
        context.report({
          node,
          messageId: 'rename',
          data: {
            hooks: hooks.join(', '),
            actual: base,
            expected: convention.hookFileStemOf(longestName(hooks)) + extension,
          },
        })
      },
    }
  },
})
