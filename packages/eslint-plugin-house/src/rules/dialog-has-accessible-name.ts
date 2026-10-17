import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils'

import { findJsxAttribute, isJsxAttributeNamedIn, plainAttributesOf } from '../shared/jsx-attributes.ts'
import { unqualifiedTagOf } from '../shared/jsx-elements.ts'

const DIALOG_ROLES: ReadonlySet<string> = new Set(['dialog', 'alertdialog'])
// `title` is a real accessible-name source: the accname algorithm falls through to it.
const DIALOG_NAME_ATTRIBUTES: ReadonlySet<string> = new Set(['aria-label', 'aria-labelledby', 'title'])

type Dialog = { node: TSESTree.JSXAttribute | TSESTree.JSXTagNameExpression; what: string }

// The string an attribute renders, or null when it is dynamic. role={`dialog`} renders `role="dialog"`.
function literalValueOf(attribute: TSESTree.JSXAttribute): string | null {
  const { value } = attribute
  if (value === null) return null
  if (value.type === AST_NODE_TYPES.Literal) return typeof value.value === 'string' ? value.value : null
  if (value.type !== AST_NODE_TYPES.JSXExpressionContainer) return null
  const { expression } = value
  if (expression.type === AST_NODE_TYPES.Literal) return typeof expression.value === 'string' ? expression.value : null
  if (expression.type === AST_NODE_TYPES.TemplateLiteral && expression.expressions.length === 0) {
    return expression.quasis.map((quasi) => quasi.value.cooked).join('')
  }
  return null
}

// An explicit role replaces the intrinsic one both ways; a dynamic role is not provably a dialog.
function dialogOf(element: TSESTree.JSXOpeningElement): Dialog | null {
  const roleAttribute = findJsxAttribute(element, 'role')
  if (roleAttribute === null) {
    return unqualifiedTagOf(element) === 'dialog' ? { node: element.name, what: '<dialog>' } : null
  }
  const role = literalValueOf(roleAttribute)
  return role !== null && DIALOG_ROLES.has(role) ? { node: roleAttribute, what: `role="${role}"` } : null
}

// `aria-label=""` names nothing. Any other value, dynamic ones included, is taken at its word.
function isAccessibleName(attribute: TSESTree.JSXAttribute): boolean {
  if (!isJsxAttributeNamedIn(attribute, DIALOG_NAME_ATTRIBUTES)) return false
  const value = literalValueOf(attribute)
  return value === null || value.trim() !== ''
}

// Not fixable: the name is content only the author has, and `aria-label="dialog"` helps nobody.
export const dialogHasAccessibleName = ESLintUtils.RuleCreator.withoutDocs<[], 'unnamed'>({
  meta: {
    type: 'problem',
    docs: { description: 'Require an accessible name on <dialog> and role="dialog"/"alertdialog"' },
    messages: {
      unnamed:
        'This {{what}} has no accessible name. Add aria-labelledby pointing at the id of its heading, or aria-label="What the dialog is for" -- a screen reader announces an unnamed dialog as just "dialog".',
    },
    schema: [],
    defaultOptions: [],
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        // A spread may forward the name from props: a deliberate blind spot.
        const attributes = plainAttributesOf(node)
        if (attributes === null) return
        const dialog = dialogOf(node)
        if (dialog === null || attributes.some(isAccessibleName)) return
        context.report({ node: dialog.node, messageId: 'unnamed', data: { what: dialog.what } })
      },
    }
  },
})
