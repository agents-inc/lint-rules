import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils'

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

/** `type="hidden"` exactly as written: `type={'hidden'}` and a dynamic type are not read. */
export function hasLiteralHiddenType(element: TSESTree.JSXOpeningElement): boolean {
  const type = findJsxAttribute(element, 'type')
  return type?.value?.type === AST_NODE_TYPES.Literal && type.value.value === 'hidden'
}
