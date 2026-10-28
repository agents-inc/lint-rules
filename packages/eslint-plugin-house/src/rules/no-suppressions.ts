import { AST_TOKEN_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils'

// Reported in line comments too: ESLint reads only the -line and -next-line forms there, but oxlint
// reads `// eslint-disable` as a file-level disable.
const SUPPRESSION_LABELS: ReadonlySet<string> = new Set([
  'eslint-disable',
  'eslint-disable-line',
  'eslint-disable-next-line',
  'eslint-enable',
  'oxlint-disable',
  'oxlint-disable-line',
  'oxlint-disable-next-line',
  'oxlint-enable',
])
// `/* eslint no-debugger: off */`. Neither engine reads rule config from a line comment, so
// `// eslint runs after oxlint` is prose.
const RULE_CONFIG_LABEL = 'eslint'
const WORD_END = /\s|$/u

// The engines read a directive's label as the comment's first word, so a ` -- reason` is irrelevant
// and prose naming a directive (`// eslint-disabled until…`) is not one.
function labelOf(comment: Readonly<TSESTree.Comment>): string {
  const text = comment.value.trimStart()
  return text.slice(0, text.search(WORD_END))
}

function isSuppression(comment: Readonly<TSESTree.Comment>): boolean {
  const label = labelOf(comment)
  return SUPPRESSION_LABELS.has(label) || (comment.type === AST_TOKEN_TYPES.Block && label === RULE_CONFIG_LABEL)
}

// Not fixable: deleting the comment surfaces the reports it hid, which need the code fixed by hand.
export const noSuppressions = ESLintUtils.RuleCreator.withoutDocs<[], 'suppression'>({
  meta: {
    type: 'suggestion',
    docs: { description: 'Disallow comments that disable, re-enable or configure lint rules' },
    messages: {
      suppression: 'Comments that disable or configure lint rules are banned. Fix the code, or set the rule in the lint config.',
    },
    schema: [],
    defaultOptions: [],
  },
  create(context) {
    const { sourceCode } = context
    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          if (isSuppression(comment)) context.report({ node: comment, messageId: 'suppression' })
        }
      },
    }
  },
})
