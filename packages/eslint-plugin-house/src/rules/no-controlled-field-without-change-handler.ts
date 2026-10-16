import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils'

import {
  findLastJsxAttribute,
  isJsxAttribute,
  isJsxAttributeNamedIn,
  jsxAttributeName,
  plainAttributesOf,
} from '../shared/jsx-attributes.ts'
import { formFieldTagOf } from '../shared/jsx-elements.ts'

// onInput fires on the same interactions; the Capture pair are the same events one phase earlier.
const CHANGE_HANDLERS: ReadonlySet<string> = new Set(['onChange', 'onInput', 'onChangeCapture', 'onInputCapture'])
// Input types whose `value` is not text the user edits: a button's caption, a hidden payload, or what
// a radio or checkbox submits. A frozen `checked={x}` goes unreported: a different bug.
const VALUE_IS_NOT_THE_CONTENT: ReadonlySet<string> = new Set([
  'submit',
  'button',
  'reset',
  'image',
  'hidden',
  'radio',
  'checkbox',
])
// Deliberately not typeable, or explicitly uncontrolled.
const OPTS_OUT: ReadonlySet<string> = new Set(['readOnly', 'disabled', 'defaultValue'])

// Only a literal `type` can be judged; `type={x}` is assumed to need a handler.
function staticStringOf(attribute: TSESTree.JSXAttribute): string | null {
  const { value } = attribute
  if (value?.type === AST_NODE_TYPES.Literal) return typeof value.value === 'string' ? value.value : null
  if (value?.type === AST_NODE_TYPES.JSXExpressionContainer && value.expression.type === AST_NODE_TYPES.Literal) {
    return typeof value.expression.value === 'string' ? value.expression.value : null
  }
  return null
}

function isChangeHandler(attribute: TSESTree.JSXAttribute | TSESTree.JSXSpreadAttribute): boolean {
  return isJsxAttribute(attribute) && isJsxAttributeNamedIn(attribute, CHANGE_HANDLERS)
}

// The handler, an opt-out, or a `type` whose value is not the field's content.
function exemptsTheField(attribute: TSESTree.JSXAttribute): boolean {
  if (isJsxAttributeNamedIn(attribute, CHANGE_HANDLERS) || isJsxAttributeNamedIn(attribute, OPTS_OUT)) return true
  if (jsxAttributeName(attribute) !== 'type') return false
  const type = staticStringOf(attribute)
  return type !== null && VALUE_IS_NOT_THE_CONTENT.has(type)
}

// `value={undefined}` and `value={null}` are how a field opts back out of being controlled.
function isUncontrolledValue(attribute: TSESTree.JSXAttribute): boolean {
  if (attribute.value?.type !== AST_NODE_TYPES.JSXExpressionContainer) return false
  const { expression } = attribute.value
  return (
    (expression.type === AST_NODE_TYPES.Identifier && expression.name === 'undefined') ||
    (expression.type === AST_NODE_TYPES.Literal && expression.value === null)
  )
}

// React's change event bubbles, so `<form onChange={save}>` drives every field it renders. Any JSX
// ancestor counts, across the arrows and calls between them: `<form onChange>{rows.map(r => <input />)}`.
function hasHandlerOnAncestor(ancestors: readonly TSESTree.Node[]): boolean {
  return ancestors.some(
    (ancestor) =>
      ancestor.type === AST_NODE_TYPES.JSXElement && ancestor.openingElement.attributes.some(isChangeHandler),
  )
}

// Not fixable: the fix is a state setter, and adding readOnly would silence the rule and keep the bug.
export const noControlledFieldWithoutChangeHandler = ESLintUtils.RuleCreator.withoutDocs<[], 'frozen'>({
  meta: {
    type: 'problem',
    docs: { description: 'Require onChange on a controlled input, textarea or select' },
    messages: {
      frozen:
        '<{{element}} value={…}> has no onChange, so typing in it does nothing -- React resets the value on every render. Add onChange to drive the state, or use defaultValue if the field should be uncontrolled, or readOnly if it is display-only.',
    },
    schema: [],
    defaultOptions: [],
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        // Intrinsic elements only: `<Input value={x} />` may wire its own handler.
        const element = formFieldTagOf(node)
        if (element === null) return
        // A spread may carry the handler.
        const attributes = plainAttributesOf(node)
        if (attributes === null || attributes.some(exemptsTheField)) return
        const value = findLastJsxAttribute(attributes, 'value')
        if (value === null || isUncontrolledValue(value)) return
        if (hasHandlerOnAncestor(context.sourceCode.getAncestors(node.parent))) return
        context.report({ node: value, messageId: 'frozen', data: { element } })
      },
    }
  },
})
