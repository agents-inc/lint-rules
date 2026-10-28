import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils'

import {
  findLastJsxAttribute,
  fixedTextOf,
  isJsxAttributeNamedIn,
  plainAttributesOf,
} from '../shared/jsx-attributes.ts'
import { formFieldTagOf } from '../shared/jsx-elements.ts'

// An id counts as a label: it is almost always there for a `<label htmlFor>` this rule cannot see.
const FIELD_NAME_ATTRIBUTES: ReadonlySet<string> = new Set(['aria-label', 'aria-labelledby', 'title', 'id'])
const LABEL_TAG = /label$/iu

function isNamingAttribute(attribute: Readonly<TSESTree.JSXAttribute>): boolean {
  return isJsxAttributeNamedIn(attribute, FIELD_NAME_ATTRIBUTES)
}

// The tag as written: `<Form.Label>` ends in the segment that matters.
function tagNameOf(name: Readonly<TSESTree.JSXTagNameExpression>): string | null {
  if (name.type === AST_NODE_TYPES.JSXMemberExpression) return name.property.name
  return name.type === AST_NODE_TYPES.JSXIdentifier ? name.name : null
}

// A field inside a `<label>` is labelled implicitly, and any wrapper whose name ends in "label" is
// taken at its word.
function isLabelElement(node: Readonly<TSESTree.Node>): boolean {
  if (node.type !== AST_NODE_TYPES.JSXElement) return false
  const tagName = tagNameOf(node.openingElement.name)
  return tagName !== null && LABEL_TAG.test(tagName)
}

// Not fixable: copying the placeholder into an aria-label would silence the rule and label nothing.
export const noPlaceholderOnlyField = ESLintUtils.RuleCreator.withoutDocs<[], 'placeholderOnly'>({
  meta: {
    type: 'problem',
    docs: { description: 'Disallow a form control whose only accessible name is its placeholder' },
    messages: {
      placeholderOnly:
        "The placeholder is this <{{tag}}>'s only accessible name, and it disappears as soon as the user types. Give it an id and a <label htmlFor> beside it, or an aria-label where no visible label fits.",
    },
    schema: [],
    defaultOptions: [],
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        // Native tags only: `<Input placeholder>` may render its own <label>, and untyped lint cannot follow it.
        const tag = formFieldTagOf(node)
        if (tag === null) return
        // A spread may carry the aria-label, and nothing here can see inside it.
        const attributes = plainAttributesOf(node)
        if (attributes === null || attributes.some(isNamingAttribute)) return
        const placeholder = findLastJsxAttribute(attributes, 'placeholder')
        // `placeholder=""`, in any form, supplies no name at all: an unnamed field, which this message would misdescribe.
        if (placeholder === null || fixedTextOf(placeholder) === '') return
        if (context.sourceCode.getAncestors(node).some(isLabelElement)) return
        context.report({ node: placeholder, messageId: 'placeholderOnly', data: { tag } })
      },
    }
  },
})
