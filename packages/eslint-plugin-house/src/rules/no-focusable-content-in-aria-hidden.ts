import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils'

import { childNodesOf } from '../shared/child-nodes.ts'
import { findJsxAttribute, fixedTextOf, hasHiddenType } from '../shared/jsx-attributes.ts'
import { unqualifiedTagOf } from '../shared/jsx-elements.ts'

type RenderedJsx = TSESTree.JSXElement | TSESTree.JSXFragment

type BracedExpression = TSESTree.JSXExpressionContainer['expression']

// A tabIndex this rule cannot read is `unknown`, not absent: `tabIndex={active ? 0 : -1}` is deliberate.
type TabIndex = number | 'absent' | 'unknown'

// In the tab order with no tabIndex of their own.
const FOCUSABLE_TAGS: ReadonlySet<string> = new Set(['button', 'select', 'textarea'])
// Focusable only with an href.
const FOCUSABLE_WITH_HREF_TAGS: ReadonlySet<string> = new Set(['a', 'area'])
// What a message calls an element whose tag is not a plain name, such as `<Menu.Item>`.
const UNNAMED_TAG = 'element'

// What `x={…}` holds; null for a bare or quoted attribute.
function bracedExpressionOf(attribute: TSESTree.JSXAttribute): BracedExpression | null {
  const { value } = attribute
  return value?.type === AST_NODE_TYPES.JSXExpressionContainer ? value.expression : null
}

function isBracedTrue(attribute: TSESTree.JSXAttribute): boolean {
  const expression = bracedExpressionOf(attribute)
  return expression?.type === AST_NODE_TYPES.Literal && expression.value === true
}

// Only `x`, `x={true}` and the text "true" render true. A dynamic value is unknowable, and unknown is silent.
function rendersTrue(attribute: TSESTree.JSXAttribute): boolean {
  return attribute.value === null || fixedTextOf(attribute) === 'true' || isBracedTrue(attribute)
}

function ariaHiddenTrueOf(element: TSESTree.JSXOpeningElement): TSESTree.JSXAttribute | null {
  const ariaHidden = findJsxAttribute(element, 'aria-hidden')
  return ariaHidden !== null && rendersTrue(ariaHidden) ? ariaHidden : null
}

function isAriaHidden(element: TSESTree.JSXOpeningElement): boolean {
  return ariaHiddenTrueOf(element) !== null
}

function isInert(element: TSESTree.JSXOpeningElement): boolean {
  return findJsxAttribute(element, 'inert') !== null
}

function finiteOr(value: number): TabIndex {
  return Number.isFinite(value) ? value : 'unknown'
}

// `tabIndex={-1}` parses as a UnaryExpression, not a negative Literal.
function tabIndexInBraces(expression: BracedExpression): TabIndex {
  if (expression.type === AST_NODE_TYPES.Literal) return finiteOr(Number(expression.value))
  if (
    expression.type === AST_NODE_TYPES.UnaryExpression &&
    expression.operator === '-' &&
    expression.argument.type === AST_NODE_TYPES.Literal
  ) {
    return finiteOr(-Number(expression.argument.value))
  }
  return 'unknown'
}

function tabIndexOf(element: TSESTree.JSXOpeningElement): TabIndex {
  const attribute = findJsxAttribute(element, 'tabIndex', 'tabindex')
  if (attribute === null) return 'absent'
  const text = fixedTextOf(attribute)
  if (text !== null) return finiteOr(Number(text))
  const expression = bracedExpressionOf(attribute)
  return expression === null ? 'unknown' : tabIndexInBraces(expression)
}

function displayedTagOf(element: TSESTree.JSXOpeningElement): string {
  return unqualifiedTagOf(element) ?? UNNAMED_TAG
}

function isFocusableElement(element: TSESTree.JSXOpeningElement): boolean {
  // Any form of these takes the element out of the tab order, `disabled={busy}` included.
  if (findJsxAttribute(element, 'disabled', 'hidden') !== null) return false
  // An explicit tabIndex overrides the element's default in both directions.
  const tabIndex = tabIndexOf(element)
  if (tabIndex === 'unknown') return false
  if (tabIndex !== 'absent') return tabIndex >= 0
  const tag = unqualifiedTagOf(element)
  if (tag === null) return false
  if (FOCUSABLE_TAGS.has(tag)) return true
  if (FOCUSABLE_WITH_HREF_TAGS.has(tag)) return findJsxAttribute(element, 'href') !== null
  return tag === 'input' && !hasHiddenType(element)
}

// The JSX an expression renders as children, without descending into it. A JSX attribute's value
// (`<Modal footer={<button />}>`) may render anywhere, so it does not count.
function jsxRenderedBy(node: TSESTree.Node): RenderedJsx[] {
  if (node.type === AST_NODE_TYPES.JSXElement || node.type === AST_NODE_TYPES.JSXFragment) return [node]
  return childNodesOf(node).flatMap(jsxRenderedBy)
}

function renderedChildrenOf(child: TSESTree.JSXChild): RenderedJsx[] {
  if (child.type === AST_NODE_TYPES.JSXElement || child.type === AST_NODE_TYPES.JSXFragment) return [child]
  if (child.type === AST_NODE_TYPES.JSXExpressionContainer) return jsxRenderedBy(child.expression)
  return []
}

// An inert or always-hidden ancestor already covers its subtree; a dynamic `aria-hidden={busy}` does not.
function coversItsSubtree(node: TSESTree.Node): boolean {
  return node.type === AST_NODE_TYPES.JSXElement && (isInert(node.openingElement) || isAriaHidden(node.openingElement))
}

// Descendants only: a focusable sibling of a decorative aria-hidden wrapper is correct code. Inert
// is inherited, so an inert element prunes its subtree.
function firstFocusableDescendant(element: RenderedJsx): TSESTree.JSXOpeningElement | null {
  for (const candidate of element.children.flatMap(renderedChildrenOf)) {
    if (candidate.type === AST_NODE_TYPES.JSXElement) {
      if (isInert(candidate.openingElement)) continue
      if (isFocusableElement(candidate.openingElement)) return candidate.openingElement
    }
    const deeper = firstFocusableDescendant(candidate)
    if (deeper !== null) return deeper
  }
  return null
}

export const noFocusableContentInAriaHidden = ESLintUtils.RuleCreator.withoutDocs<[], 'focusable' | 'self'>({
  meta: {
    type: 'problem',
    docs: { description: 'Disallow an aria-hidden element that is focusable or contains a focusable element' },
    messages: {
      focusable:
        'This element is aria-hidden but contains a focusable <{{descendant}}>. Keyboard users tab into something screen readers say is not there -- drop aria-hidden if the content is real, or add `inert` here (tabIndex={-1} on the descendant if you cannot).',
      self: 'This <{{tag}}> is aria-hidden but is itself focusable. Keyboard users tab into something screen readers say is not there -- drop aria-hidden if the control is real, or take it out of the tab order with tabIndex={-1}.',
    },
    schema: [],
    defaultOptions: [],
  },
  create(context) {
    return {
      JSXElement(node) {
        const opening = node.openingElement
        const ariaHidden = ariaHiddenTrueOf(opening)
        if (ariaHidden === null) return
        // `inert` is the fix: it takes the whole subtree out of the tab order.
        if (isInert(opening) || context.sourceCode.getAncestors(node).some(coversItsSubtree)) return

        if (isFocusableElement(opening)) {
          context.report({ node: ariaHidden, messageId: 'self', data: { tag: displayedTagOf(opening) } })
          return
        }
        const descendant = firstFocusableDescendant(node)
        if (descendant === null) return
        context.report({ node: ariaHidden, messageId: 'focusable', data: { descendant: displayedTagOf(descendant) } })
      },
    }
  },
})
