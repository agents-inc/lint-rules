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

/** The first attribute carrying one of these names. A spread never matches: nothing here can see inside it. */
export function findJsxAttribute(
  element: TSESTree.JSXOpeningElement,
  ...names: readonly string[]
): TSESTree.JSXAttribute | null {
  return (
    element.attributes.filter(isJsxAttribute).find((attribute) => {
      const name = jsxAttributeName(attribute)
      return name !== null && names.includes(name)
    }) ?? null
  )
}

/** `type="hidden"` exactly as written: `type={'hidden'}` and a dynamic type are not read. */
export function hasLiteralHiddenType(element: TSESTree.JSXOpeningElement): boolean {
  const type = findJsxAttribute(element, 'type')
  return type?.value?.type === AST_NODE_TYPES.Literal && type.value.value === 'hidden'
}
