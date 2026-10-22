import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils'

export type BracedExpression = TSESTree.JSXExpressionContainer['expression']

export function isJsxAttribute(
  attribute: TSESTree.JSXAttribute | TSESTree.JSXSpreadAttribute,
): attribute is TSESTree.JSXAttribute {
  return attribute.type === AST_NODE_TYPES.JSXAttribute
}

/** The attribute's name, or null for a namespaced one such as `xlink:href`. */
export function jsxAttributeName(attribute: TSESTree.JSXAttribute): string | null {
  return attribute.name.type === AST_NODE_TYPES.JSXIdentifier ? attribute.name.name : null
}

export function isJsxAttributeNamedIn(attribute: TSESTree.JSXAttribute, names: ReadonlySet<string>): boolean {
  const name = jsxAttributeName(attribute)
  return name !== null && names.has(name)
}

/** Every attribute the element is written with, or null when one is a spread, which may carry anything. */
export function plainAttributesOf(element: TSESTree.JSXOpeningElement): TSESTree.JSXAttribute[] | null {
  const { attributes } = element
  return attributes.every(isJsxAttribute) ? attributes : null
}

/** The first attribute carrying one of these names. A spread never matches: nothing here can see inside it. */
export function findJsxAttribute(
  element: TSESTree.JSXOpeningElement,
  ...names: readonly string[]
): TSESTree.JSXAttribute | null {
  const wanted: ReadonlySet<string> = new Set(names)
  return element.attributes.filter(isJsxAttribute).find((attribute) => isJsxAttributeNamedIn(attribute, wanted)) ?? null
}

/** The last one wins when a name is written twice. */
export function findLastJsxAttribute(
  attributes: readonly TSESTree.JSXAttribute[],
  name: string,
): TSESTree.JSXAttribute | null {
  return attributes.findLast((attribute) => jsxAttributeName(attribute) === name) ?? null
}

// A template with nothing interpolated is one stretch of text.
function uninterpolatedTextOf(template: TSESTree.TemplateLiteral): string | null {
  if (template.expressions.length > 0) return null
  const [text] = template.quasis
  if (text === undefined) throw new Error('A template literal with nothing interpolated parsed with no text')
  // `cooked` is null only for a bad escape in a tagged template, so here it is the text.
  return text.value.cooked
}

function fixedStringOf(expression: TSESTree.Expression | TSESTree.JSXEmptyExpression): string | null {
  if (expression.type === AST_NODE_TYPES.Literal) return typeof expression.value === 'string' ? expression.value : null
  return expression.type === AST_NODE_TYPES.TemplateLiteral ? uninterpolatedTextOf(expression) : null
}

/** The text the source fixes: `x="a"`, `x={'a'}` and `` x={`a`} `` read `a`; anything else, bare `x` too, is null. */
export function fixedTextOf(attribute: TSESTree.JSXAttribute): string | null {
  const { value } = attribute
  if (value === null) return null
  if (value.type === AST_NODE_TYPES.Literal) return fixedStringOf(value)
  return value.type === AST_NODE_TYPES.JSXExpressionContainer ? fixedStringOf(value.expression) : null
}

/** What `x={…}` holds; null for a bare or quoted attribute. */
export function bracedExpressionOf(attribute: TSESTree.JSXAttribute): BracedExpression | null {
  const { value } = attribute
  return value?.type === AST_NODE_TYPES.JSXExpressionContainer ? value.expression : null
}

/** A `type` fixed as `hidden` in any form `fixedTextOf` reads; a dynamic type is not read. */
export function hasHiddenType(element: TSESTree.JSXOpeningElement): boolean {
  const type = findJsxAttribute(element, 'type')
  return type !== null && fixedTextOf(type) === 'hidden'
}
