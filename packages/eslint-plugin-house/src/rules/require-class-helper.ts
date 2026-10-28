import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils'

import { calleeNameOf } from '../shared/callee-name.ts'
import { bracedExpressionOf, jsxAttributeName } from '../shared/jsx-attributes.ts'
import { defaultedOption, stringListOptionSchema } from '../shared/rule-options.ts'

// The schema does not require the key: ESLint fills it from meta.defaultOptions when a config omits it.
type ClassHelpers = { helpers?: readonly string[] }

type Options = [ClassHelpers]

const RULE_NAME = 'require-class-helper'
// `class` as well: Preact and Solid take it where React takes className.
const CLASS_ATTRIBUTES: ReadonlySet<string> = new Set(['className', 'class'])
const DEFAULT_CLASS_HELPERS: readonly string[] = ['cn', 'clsx', 'cx', 'cva', 'twMerge', 'classNames', 'classnames']
// cva returns a function, named by convention for what it styles: `buttonVariants`.
const CVA_FUNCTION_SUFFIX = 'Variants'
const HELPER_LIST_SEPARATOR = ', '

// Unwraps what changes nothing rendered: `styles.card!`, `x as string`, `styles?.footer`, `cn?.(…)`.
function unwrappedClassValueOf(expression: Readonly<TSESTree.Expression>): TSESTree.Expression {
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

// A template with nothing interpolated is a string in backticks.
function isPlainClass(value: Readonly<TSESTree.Expression>): boolean {
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

// A cva-made function returns a class whatever helpers a team configures, so its suffix counts
// beside the helpers option.
function isClassHelperName(calleeName: string, helperNames: ReadonlySet<string>): boolean {
  return helperNames.has(calleeName) || calleeName.endsWith(CVA_FUNCTION_SUFFIX)
}

// A helper's own arguments are its business: templates and ternaries inside `cn(…)` are not reported.
function isHelperCall(value: Readonly<TSESTree.Expression>, helperNames: ReadonlySet<string>): boolean {
  if (value.type !== AST_NODE_TYPES.CallExpression) return false
  const name = calleeNameOf(value.callee)
  return name !== null && isClassHelperName(name, helperNames)
}

// Not fixable: which helper a file imports, if it imports one at all, is not the rule's to guess.
export const requireClassHelper = ESLintUtils.RuleCreator.withoutDocs<Options, 'useClassHelper'>({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require className and class to be a string, a name or lookup, or a call to a configured class helper or to a cva-made `*Variants` function',
    },
    messages: {
      useClassHelper:
        'Give {{attribute}} a string, a name, or a call to a class helper ({{helpers}}) or to a cva-made function whose name ends in `Variants`, and compose classes inside that call. A helper drops empty, false and undefined parts; composed by hand they render as stray spaces or the class "undefined".',
    },
    schema: [stringListOptionSchema('helpers')],
    defaultOptions: [{ helpers: DEFAULT_CLASS_HELPERS }],
  },
  create(context, [options]) {
    const helpers = defaultedOption(RULE_NAME, options.helpers)
    const helperNames: ReadonlySet<string> = new Set(helpers)

    return {
      JSXAttribute(node) {
        const attribute = jsxAttributeName(node)
        if (attribute === null || !CLASS_ATTRIBUTES.has(attribute)) return
        // A bare attribute and a quoted string name their class outright.
        const expression = bracedExpressionOf(node)
        if (expression === null || expression.type === AST_NODE_TYPES.JSXEmptyExpression) return
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
