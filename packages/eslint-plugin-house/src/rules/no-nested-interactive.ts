import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils'

import { findJsxAttribute, hasLiteralHiddenType } from '../shared/jsx-attributes.ts'
import { unqualifiedTagOf } from '../shared/jsx-elements.ts'

type BoundaryTag = 'a' | 'button' | 'form'

// What each boundary may not contain. The same-tag pairs are the ones the HTML parser re-emits as
// siblings; the form controls inside a button stay put but cannot be operated.
const FORBIDDEN_INSIDE: Readonly<Record<BoundaryTag, ReadonlySet<string>>> = {
  button: new Set(['button', 'input', 'select', 'textarea']),
  a: new Set(['a']),
  form: new Set(['form']),
}
// Inside these, any onClick is a second click target. A form is a submit boundary, not a click target.
const CLICK_SWALLOWERS: ReadonlySet<BoundaryTag> = new Set(['button', 'a'])
const INTRINSIC_TAG = /^[a-z]/

// Intrinsic elements only: `<Button>` may render anything, and untyped lint cannot tell what.
function intrinsicTagOf(element: TSESTree.JSXElement): string | null {
  const tag = unqualifiedTagOf(element.openingElement)
  return tag !== null && INTRINSIC_TAG.test(tag) ? tag : null
}

// `type="hidden"` can take neither click nor focus, so it is legal inside a button.
function isHiddenInput(tag: string, element: TSESTree.JSXElement): boolean {
  return tag === 'input' && hasLiteralHiddenType(element.openingElement)
}

// An `<a>` is a link only with an href; without one it is a styled span. This misses `<a><a href/></a>`,
// which the parser also re-emits, to stay off those spans.
function boundaryOf(tag: string, element: TSESTree.JSXElement): BoundaryTag | null {
  if (tag === 'a') return findJsxAttribute(element.openingElement, 'href') === null ? null : 'a'
  return tag === 'button' || tag === 'form' ? tag : null
}

export const noNestedInteractive = ESLintUtils.RuleCreator.withoutDocs<[], 'handler' | 'reparented' | 'swallowed'>({
  meta: {
    type: 'problem',
    docs: { description: 'Disallow an interactive element nested inside another interactive element' },
    messages: {
      reparented:
        'Nesting <{{inner}}> inside <{{outer}}> is invalid HTML -- the parser closes the outer <{{outer}}> and re-emits this one as its sibling, so the click lands on a control the JSX never described. Make them siblings deliberately, or demote the outer <{{outer}}> to a plain element and move its handler here.',
      swallowed:
        'A <{{inner}}> inside a <button> cannot be operated reliably -- the button takes the click and the focus. Move the <{{inner}}> out of the <button> and make them siblings.',
      handler:
        'This onClick is inside <{{outer}}>, which already owns the click -- it fires the <{{outer}}> too unless the handler stops propagation, and a control nested this way cannot be reached by keyboard. Move the <{{inner}}> out of the enclosing <{{outer}}> and make them siblings.',
    },
    schema: [],
    defaultOptions: [],
  },
  create(context) {
    // Enclosing boundaries, innermost last. Nesting is read lexically: JSX passed as a prop or
    // through a portal is treated as rendering in place.
    const boundaries: BoundaryTag[] = []

    const reportNesting = (tag: string, element: TSESTree.JSXElement): void => {
      const outer = boundaries.findLast((boundary) => FORBIDDEN_INSIDE[boundary].has(tag))
      if (outer !== undefined) {
        context.report({
          node: element.openingElement.name,
          messageId: tag === outer ? 'reparented' : 'swallowed',
          data: { inner: tag, outer },
        })
        return
      }
      const swallower = boundaries.findLast((boundary) => CLICK_SWALLOWERS.has(boundary))
      if (swallower === undefined) return
      const onClick = findJsxAttribute(element.openingElement, 'onClick')
      if (onClick !== null) {
        context.report({ node: onClick, messageId: 'handler', data: { inner: tag, outer: swallower } })
      }
    }

    return {
      JSXElement(node) {
        const tag = intrinsicTagOf(node)
        if (tag === null) return
        if (!isHiddenInput(tag, node)) reportNesting(tag, node)
        const boundary = boundaryOf(tag, node)
        if (boundary !== null) boundaries.push(boundary)
      },
      'JSXElement:exit'(node) {
        const tag = intrinsicTagOf(node)
        if (tag !== null && boundaryOf(tag, node) !== null) boundaries.pop()
      },
    }
  },
})
