import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils'

import { isJsxAttribute, jsxAttributeName } from '../shared/jsx-attributes.ts'

// Native tags only: `<Input placeholder>` may render its own <label>, and untyped lint cannot follow it.
const NAMEABLE_TAGS: ReadonlySet<string> = new Set(['input', 'textarea', 'select'])
// An id counts as a label: it is almost always there for a `<label htmlFor>` this rule cannot see.
const FIELD_NAME_ATTRIBUTES: ReadonlySet<string> = new Set(['aria-label', 'aria-labelledby', 'title', 'id'])
const LABEL_TAG = /label$/i

function isNamingAttribute(attribute: TSESTree.JSXAttribute): boolean {
  const name = jsxAttributeName(attribute)
  return name !== null && FIELD_NAME_ATTRIBUTES.has(name)
}

// `placeholder=""` supplies no name at all: an unnamed field, which this message would misdescribe.
function isEmptyLiteral(attribute: TSESTree.JSXAttribute): boolean {
  return attribute.value?.type === AST_NODE_TYPES.Literal && attribute.value.value === ''
}

// The tag as written: `<Form.Label>` ends in the segment that matters.
function tagNameOf(name: TSESTree.JSXTagNameExpression): string | null {
  if (name.type === AST_NODE_TYPES.JSXMemberExpression) return name.property.name
  return name.type === AST_NODE_TYPES.JSXIdentifier ? name.name : null
}

// `<label>Email <input placeholder="…" /></label>` is labelled implicitly. Any wrapper whose name ends
// in "label" (<Label>, <FormLabel>, <Form.Label>) is taken at its word.
function isLabelElement(node: TSESTree.Node): boolean {
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
        if (node.name.type !== AST_NODE_TYPES.JSXIdentifier || !NAMEABLE_TAGS.has(node.name.name)) return
        const { attributes } = node
        // A spread may carry the aria-label, and nothing here can see inside it.
        if (!attributes.every(isJsxAttribute)) return
        if (attributes.some(isNamingAttribute)) return
        const placeholder = attributes.findLast((attribute) => jsxAttributeName(attribute) === 'placeholder')
        if (placeholder === undefined || isEmptyLiteral(placeholder)) return
        if (context.sourceCode.getAncestors(node).some(isLabelElement)) return
        context.report({ node: placeholder, messageId: 'placeholderOnly', data: { tag: node.name.name } })
      },
    }
  },
})
