import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils'

const FORM_FIELD_TAGS: ReadonlySet<string> = new Set(['input', 'textarea', 'select'])

/** The tag when it is one plain name, as in `<input>` and `<Button>`; null for `<Form.Input>` and `<svg:rect>`. */
export function unqualifiedTagOf(element: Readonly<TSESTree.JSXOpeningElement>): string | null {
  return element.name.type === AST_NODE_TYPES.JSXIdentifier ? element.name.name : null
}

/** The tag of a native `<input>`, `<textarea>` or `<select>`; null for any other element, `<Input>` included. */
export function formFieldTagOf(element: Readonly<TSESTree.JSXOpeningElement>): string | null {
  const tag = unqualifiedTagOf(element)
  return tag !== null && FORM_FIELD_TAGS.has(tag) ? tag : null
}
