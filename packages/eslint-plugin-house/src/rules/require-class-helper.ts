import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils'

import { calleeNameOf } from '../shared/callee-name.ts'
import { jsxAttributeName } from '../shared/jsx-attributes.ts'

// The schema does not require the key: ESLint fills it from meta.defaultOptions when a config omits it.
type ClassHelpers = { helpers?: readonly string[] }

type Options = [ClassHelpers]

// `class` as well: Preact and Solid take it where React takes className.
const CLASS_ATTRIBUTES: ReadonlySet<string> = new Set(['className', 'class'])
const DEFAULT_CLASS_HELPERS: readonly string[] = ['cn', 'clsx', 'cx', 'cva', 'twMerge']
const HELPER_LIST_SEPARATOR = ', '

function filledClassHelpersOf({ helpers }: ClassHelpers): Required<ClassHelpers> {
  if (helpers === undefined) {
    throw new Error('require-class-helper ran without meta.defaultOptions applied to its options')
  }
  return { helpers }
}

// What a value is beneath the wrappers that change nothing it renders: `styles.card!`, `className as
// string` and `styles?.footer` are the lookups they wrap, and `cn?.(…)` is a call to cn.
function unwrappedClassValueOf(expression: TSESTree.Expression): TSESTree.Expression {
  switch (expression.type) {
    case AST_NODE_TYPES.ChainExpression:
    case AST_NODE_TYPES.TSAsExpression:
    case AST_NODE_TYPES.TSNonNullExpression:
    case AST_NODE_TYPES.TSSatisfiesExpression: {
      return unwrappedClassValueOf(expression.expression)
    }
    default: {
      return expression
    }
  }
}

// A class written out or looked up, which composes nothing. A template with nothing interpolated is
// a string in backticks.
function isPlainClass(value: TSESTree.Expression): boolean {
  switch (value.type) {
    case AST_NODE_TYPES.Literal:
    case AST_NODE_TYPES.Identifier:
    case AST_NODE_TYPES.MemberExpression: {
      return true
    }
    case AST_NODE_TYPES.TemplateLiteral: {
      return value.expressions.length === 0
    }
    default: {
      return false
    }
  }
}

// A helper's own arguments are its business: templates and ternaries inside `cn(…)` are not reported.
function isHelperCall(value: TSESTree.Expression, helperNames: ReadonlySet<string>): boolean {
  if (value.type !== AST_NODE_TYPES.CallExpression) return false
  const name = calleeNameOf(value.callee)
  return name !== null && helperNames.has(name)
}

// Not fixable: which helper a file imports, if it imports one at all, is not the rule's to guess.
export const requireClassHelper = ESLintUtils.RuleCreator.withoutDocs<Options, 'useClassHelper'>({
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require className and class to be a string, a name or lookup, or a call to a configured class helper',
    },
    messages: {
      useClassHelper:
        'Give {{attribute}} a string, a name, or a call to a class helper ({{helpers}}), and compose classes inside that call. A helper drops empty, false and undefined parts; composed by hand they render as stray spaces or the class "undefined".',
    },
    schema: [
      {
        type: 'object',
        properties: { helpers: { type: 'array', items: { type: 'string' } } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ helpers: DEFAULT_CLASS_HELPERS }],
  },
  create(context, [options]) {
    const { helpers } = filledClassHelpersOf(options)
    const helperNames: ReadonlySet<string> = new Set(helpers)

    return {
      JSXAttribute(node) {
        const attribute = jsxAttributeName(node)
        if (attribute === null || !CLASS_ATTRIBUTES.has(attribute)) return
        // A bare attribute and a quoted string name their class outright.
        const { value } = node
        if (value === null || value.type !== AST_NODE_TYPES.JSXExpressionContainer) return
        const { expression } = value
        if (expression.type === AST_NODE_TYPES.JSXEmptyExpression) return
        const classValue = unwrappedClassValueOf(expression)
        if (isPlainClass(classValue) || isHelperCall(classValue, helperNames)) return
        context.report({
          node: expression,
          messageId: 'useClassHelper',
          data: { attribute, helpers: helpers.join(HELPER_LIST_SEPARATOR) },
        })
      },
    }
  },
})
