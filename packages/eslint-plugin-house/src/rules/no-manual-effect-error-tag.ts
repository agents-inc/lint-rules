import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils'

import { callReceiving } from '../shared/call-arguments.ts'
import { dottedPropertyNameOf, staticPropertyNameOf } from '../shared/callee-name.ts'
import { isFunctionExpression } from '../shared/function-name.ts'

// A port of anti-slop-effect/no-manual-effect-error-tag (github.com/dmmulroy/anti-slop, commit c44ef22).

type MessageId = 'reason' | 'tag'

const EFFECT_NAMESPACE = 'Effect'
// Effect 3's catchAll, Effect 4's catch, and catchIf in both: each hands its callback failures of every tag.
const BROAD_CATCH_METHODS: ReadonlySet<string> = new Set(['catch', 'catchAll', 'catchIf'])
const EQUALITY_OPERATORS: ReadonlySet<string> = new Set(['==', '===', '!=', '!=='])
const TAG_KEY = '_tag'
const REASON_KEY = 'reason'

function isStringLiteral(node: Readonly<TSESTree.Node>): node is TSESTree.StringLiteral {
  return node.type === AST_NODE_TYPES.Literal && typeof node.value === 'string'
}

function isTagMember(node: Readonly<TSESTree.Node>): node is TSESTree.MemberExpression {
  return staticPropertyNameOf(node) === TAG_KEY
}

function tagMemberComparedWithAString(comparison: Readonly<TSESTree.BinaryExpression>): TSESTree.MemberExpression | null {
  if (!EQUALITY_OPERATORS.has(comparison.operator)) return null
  const { left, right } = comparison
  if (isTagMember(left) && isStringLiteral(right)) return left
  if (isTagMember(right) && isStringLiteral(left)) return right
  return null
}

function isTheEffectNamespace(node: Readonly<TSESTree.Node>): boolean {
  return node.type === AST_NODE_TYPES.Identifier && node.name === EFFECT_NAMESPACE
}

function isBroadEffectCatch(call: Readonly<TSESTree.CallExpression>): boolean {
  const { callee } = call
  if (callee.type !== AST_NODE_TYPES.MemberExpression || !isTheEffectNamespace(callee.object)) return false
  const method = dottedPropertyNameOf(callee)
  return method !== null && BROAD_CATCH_METHODS.has(method)
}

// Only the nearest enclosing function expression counts: a callback nested in the handler tests
// something other than the failure the handler caught. A function declaration does not end the search.
function isInABroadEffectHandler(ancestors: readonly TSESTree.Node[]): boolean {
  const nearestFunction = ancestors.findLast(isFunctionExpression)
  if (nearestFunction === undefined) return false
  const call = callReceiving(nearestFunction, nearestFunction.parent)
  return call !== null && isBroadEffectCatch(call)
}

function messageIdFor(tagMember: Readonly<TSESTree.MemberExpression>): MessageId {
  return staticPropertyNameOf(tagMember.object) === REASON_KEY ? 'reason' : 'tag'
}

// Not fixable: a catchTag call takes the matching branch alone, and what becomes of the others depends on the handler.
export const noManualEffectErrorTag = ESLintUtils.RuleCreator.withoutDocs<[], MessageId>({
  meta: {
    type: 'problem',
    docs: { description: 'Disallow comparing or switching on a `_tag` in the callback of a broad Effect catch: Effect.catch, catchAll or catchIf' },
    messages: {
      tag: 'Use Effect.catchTag or Effect.catchTags instead of manually discriminating a tagged error in a broad Effect catch handler.',
      reason:
        'Use Effect.catchReason or Effect.catchReasons instead of manually discriminating a tagged `reason` in a broad Effect catch handler.',
    },
    schema: [],
    defaultOptions: [],
  },
  create(context) {
    function reportIfInABroadEffectHandler(node: Readonly<TSESTree.BinaryExpression | TSESTree.SwitchStatement>, tagMember: Readonly<TSESTree.MemberExpression>): void {
      if (isInABroadEffectHandler(context.sourceCode.getAncestors(node))) {
        context.report({ node, messageId: messageIdFor(tagMember) })
      }
    }
    return {
      BinaryExpression(node) {
        const tagMember = tagMemberComparedWithAString(node)
        if (tagMember !== null) reportIfInABroadEffectHandler(node, tagMember)
      },
      SwitchStatement(node) {
        if (isTagMember(node.discriminant)) reportIfInABroadEffectHandler(node, node.discriminant)
      },
    }
  },
})
