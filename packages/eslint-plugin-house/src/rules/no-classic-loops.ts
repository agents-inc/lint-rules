import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils'

type ClassicLoop = TSESTree.DoWhileStatement | TSESTree.ForInStatement | TSESTree.ForStatement | TSESTree.WhileStatement

const LOOP_KEYWORDS: Readonly<Record<ClassicLoop['type'], string>> = {
  [AST_NODE_TYPES.DoWhileStatement]: 'do…while',
  [AST_NODE_TYPES.ForInStatement]: 'for…in',
  [AST_NODE_TYPES.ForStatement]: 'for',
  [AST_NODE_TYPES.WhileStatement]: 'while',
}

// Not fixable: what replaces a counter or a condition depends on what the loop is for.
export const noClassicLoops = ESLintUtils.RuleCreator.withoutDocs<[], 'classicLoop'>({
  meta: {
    type: 'suggestion',
    docs: { description: 'Disallow for, for…in, while and do…while loops; for…of is allowed' },
    messages: {
      classicLoop: 'Use for…of, or an array method such as map, filter or reduce, instead of a {{loop}} loop.',
    },
    schema: [],
    defaultOptions: [],
  },
  create(context) {
    const report = (node: ClassicLoop): void => {
      context.report({ node, messageId: 'classicLoop', data: { loop: LOOP_KEYWORDS[node.type] } })
    }
    return {
      DoWhileStatement: report,
      ForInStatement: report,
      ForStatement: report,
      WhileStatement: report,
    }
  },
})
